import { env } from "@/constants/env"

export interface MeetingEntry {
  // LiveKit connection URL returned by the backend
  serverUrl: string
  // Fresh room-scoped participant token
  participantToken: string
  // Server-assigned identity for this entry
  participantIdentity: string
  // Server-authorized application role
  role: "participant" | "host"
  // Initial notification version baseline
  codeVersion?: number
  // Memory-only host capability
  hostAccess?: string
}
export interface RoomIdentity {
  // Registered company
  company: string
  // Registered room slug
  slug: string
}
export interface CodeVersion {
  // Confirmed current code version
  codeVersion: number
}
export interface RevealedHostCode extends CodeVersion {
  // Current canonical eight-digit code
  hostCode: string
}
export const backendRequest = async <T>(
  path: string,
  method = "GET",
  body?: object,
  hostAccess?: string,
): Promise<T> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(
      env.backendUrl.replace(/\/$/, "") + "/v1/rooms" + path,
      {
        method,
        signal: controller.signal,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(hostAccess ? { Authorization: "Bearer " + hostAccess } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    )
    if (response.status === 204) return undefined as T
    const result = await response.json()
    if (!response.ok) {
      const retryAfter = response.headers.get("Retry-After")
      const message =
        typeof result?.error?.message === "string"
          ? result.error.message
          : "Request failed. Please retry."
      throw new Error(
        retryAfter
          ? message + " Retry in " + retryAfter + " seconds."
          : message,
      )
    }
    const versionValid =
      Number.isSafeInteger(result?.codeVersion) && result.codeVersion > 0
    const roomValid =
      typeof result?.company === "string" &&
      typeof result?.slug === "string" &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.company) &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug)
    const joinValid =
      typeof result?.serverUrl === "string" &&
      /^wss?:\/\//.test(result.serverUrl) &&
      typeof result?.participantToken === "string" &&
      result.participantToken.length > 0 &&
      typeof result?.participantIdentity === "string" &&
      result.participantIdentity.length > 0 &&
      (result.role === "participant"
        ? result.hostAccess === undefined && result.codeVersion === undefined
        : result.role === "host" &&
          typeof result.hostAccess === "string" &&
          result.hostAccess.length > 0 &&
          versionValid)
    const valid = path.endsWith("/join")
      ? joinValid &&
        body !== undefined &&
        "mode" in body &&
        result.role === body.mode
      : path.endsWith("/host-code") && method === "GET"
        ? versionValid &&
          typeof result.hostCode === "string" &&
          /^[0-9]{8}$/.test(result.hostCode)
        : path.endsWith("/verify") ||
            path.endsWith("/version") ||
            method === "PUT"
          ? versionValid
          : roomValid
    if (!valid) throw new Error("Invalid backend response. Please retry.")
    return result as T
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError")
      throw new Error("Request timed out. Please retry.")
    throw cause
  } finally {
    clearTimeout(timeout)
  }
}
export const roomPath = (company: string, slug: string): string =>
  "/" + encodeURIComponent(company) + "/" + encodeURIComponent(slug)
export const getRoom = (company: string, slug: string): Promise<RoomIdentity> =>
  backendRequest(roomPath(company, slug))
export const createRoom = (hostCode: string): Promise<RoomIdentity> =>
  backendRequest("", "POST", { hostCode })
export const fetchParticipantToken = (
  displayName: string,
  company: string,
  slug: string,
  hostCode?: string,
): Promise<MeetingEntry> =>
  backendRequest(
    roomPath(company, slug) + "/join",
    "POST",
    hostCode !== undefined
      ? { displayName, mode: "host", hostCode }
      : { displayName, mode: "participant" },
  )
export const verifyHostCode = (
  company: string,
  slug: string,
  hostCode: string,
): Promise<CodeVersion> =>
  backendRequest(roomPath(company, slug) + "/settings/verify", "POST", {
    hostCode,
  })
export const changeHostCode = (
  company: string,
  slug: string,
  currentHostCode: string,
  newHostCode: string,
  expectedVersion: number,
): Promise<CodeVersion> =>
  backendRequest(roomPath(company, slug) + "/host-code", "PUT", {
    currentHostCode,
    newHostCode,
    expectedVersion,
  })
export const getHostCodeVersion = (
  company: string,
  slug: string,
  hostAccess: string,
): Promise<CodeVersion> =>
  backendRequest(
    roomPath(company, slug) + "/host-code/version",
    "GET",
    undefined,
    hostAccess,
  )
export const revealHostCode = (
  company: string,
  slug: string,
  hostAccess: string,
): Promise<RevealedHostCode> =>
  backendRequest(
    roomPath(company, slug) + "/host-code",
    "GET",
    undefined,
    hostAccess,
  )
export const revokeHostAccess = async (
  company: string,
  slug: string,
  hostAccess: string,
): Promise<void> => {
  try {
    await backendRequest(
      roomPath(company, slug) + "/host-access",
      "DELETE",
      undefined,
      hostAccess,
    )
  } catch {
    /* Cleanup failure must not block exit. */
  }
}
