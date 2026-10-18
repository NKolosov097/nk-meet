import { test } from "node:test"
import { deepEqual, equal, ok } from "node:assert/strict"
import { once } from "node:events"
import { IncomingMessage } from "node:http"
import { Socket } from "node:net"
import type { AddressInfo } from "node:net"
import { createHttpServer, requestSource } from "../src/http.ts"
import { liveKit } from "../src/livekit.ts"
import { fixture } from "./fixtures.ts"

test("HTTP exact contract validates bodies, canonical paths and safe errors without claiming rooms", async t => {
  const f = fixture(t)
  const server = createHttpServer(f.meetings, {
    origins: ["https://web.example"],
    trustLocalProxy: false,
  })
  server.listen(0, "127.0.0.1")
  try {
    await once(server, "listening")
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    t.after(() => {
      server.closeAllConnections()
      server.close()
    })
    const request = (
      path: string,
      method = "GET",
      value?: unknown,
      headers?: Record<string, string>,
    ) =>
      fetch(base + path, {
        method,
        headers: {
          ...(value === undefined
            ? {}
            : { "Content-Type": "application/json" }),
          ...headers,
        },
        body:
          value === undefined
            ? undefined
            : typeof value === "string"
              ? value
              : JSON.stringify(value),
      })
    equal((await request("/healthz")).status, 200)
    for (const value of [
      {},
      { hostCode: "0000-1111" },
      { hostCode: "00001111", company: "nkolosov-1" },
      [],
      "broken",
    ])
      equal((await request("/v1/rooms", "POST", value)).status, 400)
    equal(
      (await request("/v1/rooms", "POST", { hostCode: "0".repeat(5000) }))
        .status,
      400,
    )
    equal(
      (await fetch(base + "/v1/rooms", { method: "POST", body: "{}" })).status,
      400,
    )
    const created = await request("/v1/rooms", "POST", { hostCode: "00001111" })
    equal(created.status, 201)
    equal(created.headers.get("cache-control"), "no-store")
    const room = await created.json()
    equal(room.company, "nkolosov")
    ok(!JSON.stringify(room).includes("00001111"))
    const path = `/v1/rooms/${room.company}/${room.slug}`
    deepEqual(await (await request(path)).json(), room)
    const absent = await request("/v1/rooms/nkolosov/old-link/join", "POST", {
      displayName: "Guest",
      mode: "participant",
    })
    equal(absent.status, 404)
    deepEqual(await absent.json(), {
      error: { code: "ROOM_NOT_FOUND", message: "Room not found" },
    })
    equal(f.store.room("nkolosov", "old-link"), undefined)
    for (const invalid of [
      "/v1/rooms/Nkolosov/test",
      "/v1/rooms/nkolosov/%74est",
      "/v1/rooms/nkolosov/a--b",
      "/v1/rooms/nkolosov/" + "a".repeat(65),
    ])
      equal((await request(invalid)).status, 400)
    for (const value of [
      {
        displayName: "Host",
        mode: "host",
        hostCode: "00001111",
        identity: "spoofed",
      },
      { displayName: "Host", mode: "participant", role: "host" },
      { displayName: "Host", mode: "participant", hostCode: "00001111" },
      { displayName: " ", mode: "participant" },
      { displayName: "a".repeat(81), mode: "participant" },
    ])
      equal((await request(path + "/join", "POST", value)).status, 400)
    const verified = await request(path + "/settings/verify", "POST", {
      hostCode: "00001111",
    })
    deepEqual(await verified.json(), { codeVersion: 1 })
    equal(f.tokens.length, 0)
    const guest = await (
      await request(path + "/join", "POST", {
        displayName: "Guest",
        mode: "participant",
      })
    ).json()
    equal(guest.role, "participant")
    equal(guest.hostAccess, undefined)
    equal(guest.codeVersion, undefined)
    equal((await request(path + "/host-code")).status, 401)
    const host = await (
      await request(path + "/join", "POST", {
        displayName: "Host",
        mode: "host",
        hostCode: "00001111",
      })
    ).json()
    const authorization = { Authorization: `Bearer ${host.hostAccess}` }
    equal(
      (await request(path + "/host-code", "GET", undefined, authorization))
        .status,
      409,
    )
    f.participants.push({ identity: host.participantIdentity, active: true })
    const rotated = await request(path + "/host-code", "PUT", {
      currentHostCode: "00001111",
      newHostCode: "00002222",
      expectedVersion: 1,
    })
    deepEqual(await rotated.json(), { codeVersion: 2 })
    deepEqual(
      await (
        await request(
          path + "/host-code/version",
          "GET",
          undefined,
          authorization,
        )
      ).json(),
      { codeVersion: 2 },
    )
    deepEqual(
      await (
        await request(path + "/host-code", "GET", undefined, authorization)
      ).json(),
      { hostCode: "00002222", codeVersion: 2 },
    )
    equal(
      (await request(path + "/host-access", "DELETE", undefined, authorization))
        .status,
      204,
    )
    equal(
      (await request(path + "/host-access", "DELETE", undefined, authorization))
        .status,
      204,
    )
    equal(
      (await request(path + "/host-code", "GET", undefined, authorization))
        .status,
      401,
    )
    f.live.token = () => Promise.reject(new Error("secret-code-token-sql"))
    const failed = await request(path + "/join", "POST", {
      displayName: "Host",
      mode: "host",
      hostCode: "00002222",
    })
    equal(failed.status, 503)
    ok(!(await failed.text()).includes("secret-code-token-sql"))
    f.live.participant = () =>
      Promise.reject(new Error("secret-provider-error"))
    for (let i = 0; i < 20; i++)
      await request(path + "/settings/verify", "POST", { hostCode: "11111111" })
    const limited = await request(path + "/settings/verify", "POST", {
      hostCode: "00002222",
    })
    equal(limited.status, 429)
    ok(Number(limited.headers.get("retry-after")) > 0)
    f.store.health = () => {
      throw new Error("SQL secret")
    }
    equal((await request("/healthz")).status, 503)
  } catch (error) {
    throw error
  }
})

test("CORS permits exact origins/required headers, denies others and supports origin-free native requests", async t => {
  const f = fixture(t)
  const room = f.room()
  const server = createHttpServer(f.meetings, {
    origins: ["https://web.example"],
    trustLocalProxy: false,
  })
  server.listen(0, "127.0.0.1")
  try {
    await once(server, "listening")
    t.after(() => {
      server.closeAllConnections()
      server.close()
    })
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/rooms/${room.company}/${room.slug}`
    equal((await fetch(url)).status, 200)
    const allowed = await fetch(url, {
      headers: { Origin: "https://web.example" },
    })
    equal(
      allowed.headers.get("access-control-allow-origin"),
      "https://web.example",
    )
    equal(allowed.headers.get("access-control-expose-headers"), "Retry-After")
    equal(
      (await fetch(url, { headers: { Origin: "https://web.example.evil" } }))
        .status,
      400,
    )
    equal(
      (
        await fetch(url, {
          method: "OPTIONS",
          headers: {
            Origin: "https://web.example",
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "Content-Type, Authorization",
          },
        })
      ).status,
      204,
    )
    equal(
      (
        await fetch(url, {
          method: "OPTIONS",
          headers: {
            Origin: "https://web.example",
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "X-Identity",
          },
        })
      ).status,
      400,
    )
    equal((await fetch(url, { method: "PATCH" })).status, 400)
    for (let i = 0; i < 120; i++) await fetch(url)
    const limited = await fetch(url, {
      headers: { Origin: "https://web.example" },
    })
    equal(limited.status, 429)
    equal(
      limited.headers.get("access-control-allow-origin"),
      "https://web.example",
    )
    equal(limited.headers.get("access-control-expose-headers"), "Retry-After")
    ok(Number(limited.headers.get("retry-after")) > 0)
  } catch (error) {
    throw error
  }
})

test("source ignores spoofed forwarding unless explicitly trusted loopback proxy; normalizes mapped IPv4", () => {
  const socket = new Socket()
  const request = new IncomingMessage(socket)
  Object.defineProperty(socket, "remoteAddress", {
    value: "::ffff:203.0.113.1",
    configurable: true,
  })
  request.headers["x-real-ip"] = "198.51.100.2"
  request.headers["x-forwarded-for"] = "198.51.100.3"
  equal(requestSource(request, false), "203.0.113.1")
  equal(requestSource(request, true), "203.0.113.1")
  Object.defineProperty(socket, "remoteAddress", {
    value: "127.0.0.1",
    configurable: true,
  })
  equal(requestSource(request, false), "127.0.0.1")
  equal(requestSource(request, true), "198.51.100.2")
  request.headers["x-real-ip"] = "999.999.999.999"
  equal(requestSource(request, true), "127.0.0.1")
  request.headers["x-real-ip"] = "::ffff:198.51.100.2"
  equal(requestSource(request, true), "198.51.100.2")
})

test("pinned SDK adapter recognizes ACTIVE, missing presence and reliable targeted code-free data", async t => {
  const original = globalThis.fetch
  t.after(() => {
    globalThis.fetch = original
  })
  const requests: { method: string; body: Record<string, unknown> }[] = []
  globalThis.fetch = (input, options) => {
    const method = String(input).split("/").at(-1)!
    requests.push({ method, body: JSON.parse(String(options?.body)) })
    if (method === "GetParticipant")
      return Promise.resolve(
        new Response(JSON.stringify({ identity: "host", state: "ACTIVE" })),
      )
    if (method === "ListParticipants")
      return Promise.resolve(
        new Response(
          JSON.stringify({
            participants: [
              { identity: "host", state: "ACTIVE" },
              { identity: "recovering", state: "JOINED" },
            ],
          }),
        ),
      )
    return Promise.resolve(new Response("{}"))
  }
  const live = liveKit(
    "wss://meet.example",
    "https://meet.example",
    "api-key",
    "api-secret",
  )
  try {
    deepEqual(await live.participant("nkolosov--meeting", "host"), {
      identity: "host",
      active: true,
    })
    deepEqual(await live.participants("nkolosov--meeting"), [
      { identity: "host", active: true },
      { identity: "recovering", active: false },
    ])
    await live.notify("nkolosov--meeting", [], 2)
    equal(requests.length, 2)
    await live.notify("nkolosov--meeting", ["host"], 2)
    const sent = requests[2].body
    deepEqual(sent.destinationIdentities, ["host"])
    equal(sent.topic, "nk.host-code.changed")
    deepEqual(JSON.parse(Buffer.from(String(sent.data), "base64").toString()), {
      codeVersion: 2,
    })
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({ code: "not_found", msg: "Participant not found" }),
          { status: 404 },
        ),
      )
    equal(await live.participant("nkolosov--meeting", "host"), undefined)
  } catch (error) {
    throw error
  }
})
