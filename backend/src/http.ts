import { createServer } from "node:http"
import { isIP } from "node:net"
import type { IncomingMessage, ServerResponse } from "node:http"
import { ApiError, invalidRequest, validSegment } from "./meetings.ts"
import type { Meetings } from "./meetings.ts"

export interface HttpOptions {
  // Exact allowed web origins; native requests omit Origin.
  origins: string[]
  // Trust only an overwriting loopback proxy's X-Real-IP.
  trustLocalProxy: boolean
}

export function requestSource(
  request: IncomingMessage,
  trustLocalProxy: boolean,
): string {
  const address = request.socket.remoteAddress ?? "unknown"
  const normalized = address.replace(/^::ffff:/, "")
  const forwarded = request.headers["x-real-ip"]
  if (
    trustLocalProxy &&
    (normalized === "127.0.0.1" || normalized === "::1") &&
    typeof forwarded === "string"
  ) {
    // Validate the single proxy value rather than interpreting a forwarded chain.
    if (isIP(forwarded)) return forwarded.replace(/^::ffff:/, "")
  }
  return normalized
}

function json(response: ServerResponse, status: number, body?: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  response.end(body === undefined ? undefined : JSON.stringify(body))
}

function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
      request.headers["content-type"] ?? "",
    )
  )
    invalidRequest()
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    let failed = false
    request.on("data", (chunk: Buffer) => {
      size += chunk.length
      if (size > 4096) {
        failed = true
        chunks.length = 0
        reject(new ApiError(400, "INVALID_REQUEST", "Invalid request"))
      } else if (!failed) chunks.push(chunk)
    })
    request.on("error", () =>
      reject(new ApiError(400, "INVALID_REQUEST", "Invalid request")),
    )
    request.on("aborted", () =>
      reject(new ApiError(400, "INVALID_REQUEST", "Invalid request")),
    )
    request.on("end", () => {
      if (failed) return
      try {
        const value: unknown = JSON.parse(
          Buffer.concat(chunks).toString("utf8"),
        )
        if (!value || typeof value !== "object" || Array.isArray(value))
          invalidRequest()
        resolve(value as Record<string, unknown>)
      } catch {
        reject(new ApiError(400, "INVALID_REQUEST", "Invalid request"))
      }
    })
  })
}

function fields(value: Record<string, unknown>, expected: string[]) {
  const keys = Object.keys(value)
  if (
    keys.length !== expected.length ||
    keys.some(key => !expected.includes(key))
  )
    invalidRequest()
}

function access(request: IncomingMessage): string {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
    request.headers.authorization ?? "",
  )
  if (!match)
    throw new ApiError(401, "INVALID_HOST_ACCESS", "Invalid host access")
  return match[1]
}

export function createHttpServer(meetings: Meetings, options: HttpOptions) {
  async function handle(request: IncomingMessage, response: ServerResponse) {
    try {
      const source = requestSource(request, options.trustLocalProxy)
      const origin = request.headers.origin
      if (origin) {
        if (!options.origins.includes(origin)) invalidRequest()
        response.setHeader("Access-Control-Allow-Origin", origin)
        response.setHeader("Access-Control-Expose-Headers", "Retry-After")
        response.setHeader("Vary", "Origin")
      }
      if (request.url?.startsWith("/v1/")) meetings.request(source)
      if (request.method === "OPTIONS") {
        const method = request.headers["access-control-request-method"]
        const headers = request.headers["access-control-request-headers"]
        if (
          !origin ||
          typeof method !== "string" ||
          !["GET", "POST", "PUT", "DELETE"].includes(method)
        )
          invalidRequest()
        if (
          headers &&
          (typeof headers !== "string" ||
            headers
              .split(",")
              .some(
                header =>
                  !["content-type", "authorization"].includes(
                    header.trim().toLowerCase(),
                  ),
              ))
        )
          invalidRequest()
        response.setHeader(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE",
        )
        response.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization",
        )
        json(response, 204)
        return
      }
      if (request.url === "/healthz" && request.method === "GET") {
        meetings.store.health()
        json(response, 200, { ok: true })
        return
      }
      if (request.url === "/v1/rooms" && request.method === "POST") {
        const value = await body(request)
        fields(value, ["hostCode"])
        json(response, 201, meetings.create(value.hostCode, source))
        return
      }
      const match =
        /^\/v1\/rooms\/([^/]+)\/([^/]+)(\/join|\/settings\/verify|\/host-code\/version|\/host-code|\/host-access)?$/.exec(
          request.url ?? "",
        )
      if (!match || !validSegment(match[1]) || !validSegment(match[2]))
        invalidRequest()
      const [, company, slug, operation = ""] = match
      // Registry lookup precedes every route operation; no join can claim a legacy room.
      const room = meetings.get(company, slug)
      if (!operation && request.method === "GET") {
        json(response, 200, room)
        return
      }
      if (operation === "/join" && request.method === "POST") {
        const value = await body(request)
        fields(
          value,
          value.mode === "host"
            ? ["displayName", "mode", "hostCode"]
            : ["displayName", "mode"],
        )
        json(
          response,
          200,
          await meetings.join(
            company,
            slug,
            value.displayName,
            value.mode,
            value.hostCode,
            source,
          ),
        )
        return
      }
      if (operation === "/settings/verify" && request.method === "POST") {
        const value = await body(request)
        fields(value, ["hostCode"])
        json(
          response,
          200,
          await meetings.verify(company, slug, value.hostCode, source),
        )
        return
      }
      if (operation === "/host-code" && request.method === "PUT") {
        const value = await body(request)
        fields(value, ["currentHostCode", "newHostCode", "expectedVersion"])
        json(
          response,
          200,
          await meetings.rotate(
            company,
            slug,
            value.currentHostCode,
            value.newHostCode,
            value.expectedVersion,
            source,
          ),
        )
        return
      }
      if (operation === "/host-code/version" && request.method === "GET") {
        json(
          response,
          200,
          await meetings.version(company, slug, access(request)),
        )
        return
      }
      if (operation === "/host-code" && request.method === "GET") {
        json(
          response,
          200,
          await meetings.reveal(company, slug, access(request)),
        )
        return
      }
      if (operation === "/host-access" && request.method === "DELETE") {
        await meetings.revoke(company, slug, access(request))
        json(response, 204)
        return
      }
      invalidRequest()
    } catch (error) {
      const safe =
        error instanceof ApiError
          ? error
          : new ApiError(
              503,
              "SERVICE_UNAVAILABLE",
              "Service unavailable. Try again.",
            )
      if (safe.retryAfter)
        response.setHeader("Retry-After", String(safe.retryAfter))
      json(response, safe.status, {
        error: { code: safe.code, message: safe.message },
      })
    }
  }
  const server = createServer((request, response) => {
    void handle(request, response)
  })
  server.headersTimeout = 10000
  server.requestTimeout = 15000
  return server
}
