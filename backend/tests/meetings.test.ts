import { test } from "node:test"
import {
  deepEqual,
  equal,
  notEqual,
  ok,
  rejects,
  throws,
} from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import { AccessToken, TokenVerifier } from "livekit-server-sdk"
import { createMeetings } from "../src/meetings.ts"
import { liveKit } from "../src/livekit.ts"
import type { LiveParticipant } from "../src/livekit.ts"
import { deferred, fixture } from "./fixtures.ts"

test("creation stores protected codes and versions across restart, rejects malformed codes and unknown rooms", async t => {
  const f = fixture(t)
  for (const code of [
    undefined,
    "0000-1111",
    "123",
    "１２３４５６７８",
    12345678,
  ])
    throws(() => f.meetings.create(code, "source"), { code: "INVALID_REQUEST" })
  const room = f.room()
  equal(room.company, "nkolosov")
  ok(/^[a-f0-9]{12}$/.test(room.slug))
  notEqual(
    Buffer.from(f.store.room(room.company, room.slug)!.ciphertext).toString(),
    "00001111",
  )
  f.restart()
  deepEqual(f.meetings.get(room.company, room.slug), room)
  try {
    deepEqual(
      await f.meetings.verify(room.company, room.slug, "00001111", "source"),
      { codeVersion: 1 },
    )
    await rejects(
      f.meetings.join(
        "nkolosov",
        "old-link",
        "Guest",
        "participant",
        undefined,
        "source",
      ),
      { code: "ROOM_NOT_FOUND" },
    )
    await rejects(
      f.meetings.verify("nkolosov", "old-link", "00001111", "source"),
      { code: "ROOM_NOT_FOUND" },
    )
  } catch (error) {
    throw error
  }
  equal(f.store.room("nkolosov", "old-link"), undefined)
  equal(f.tokens.length, 0)
})

test("manual joins get unpredictable identities and host-only capabilities; verify issues no token", async t => {
  const f = fixture(t)
  const room = f.room()
  try {
    await f.meetings.verify(room.company, room.slug, "00001111", "source")
    equal(f.tokens.length, 0)
    const guest = await f.meetings.join(
      room.company,
      room.slug,
      " Guest ",
      "participant",
      undefined,
      "source",
    )
    const host = await f.meetings.join(
      room.company,
      room.slug,
      "Host",
      "host",
      "00001111",
      "source",
    )
    equal(guest.role, "participant")
    equal(guest.hostAccess, undefined)
    equal(guest.codeVersion, undefined)
    equal(host.role, "host")
    equal(host.codeVersion, 1)
    ok(host.hostAccess?.length === 43)
    notEqual(host.participantIdentity, guest.participantIdentity)
    equal(f.tokens[0].name, "Guest")
    equal(f.tokens[0].room, `${room.company}--${room.slug}`)
    await rejects(
      f.meetings.join(
        room.company,
        room.slug,
        "Host",
        "host",
        "11111111",
        "source",
      ),
      { code: "INVALID_HOST_CODE" },
    )
    await rejects(
      f.meetings.join(
        room.company,
        room.slug,
        "Host",
        "host",
        undefined,
        "source",
      ),
      { code: "INVALID_REQUEST" },
    )
    equal(f.tokens.length, 2)
  } catch (error) {
    throw error
  }
})

test("rotation requires current code/version, validates replacement, and same code is a no-op", async t => {
  const f = fixture(t)
  const room = f.room()
  try {
    await rejects(
      f.meetings.rotate(
        room.company,
        room.slug,
        "00001111",
        "0000-2222",
        1,
        "source",
      ),
      { code: "INVALID_REQUEST" },
    )
    await rejects(
      f.meetings.rotate(
        room.company,
        room.slug,
        "11111111",
        "00002222",
        1,
        "source",
      ),
      { code: "INVALID_HOST_CODE" },
    )
    deepEqual(
      await f.meetings.rotate(
        room.company,
        room.slug,
        "00001111",
        "00001111",
        1,
        "source",
      ),
      { codeVersion: 1 },
    )
    deepEqual(
      await f.meetings.rotate(
        room.company,
        room.slug,
        "00001111",
        "00002222",
        1,
        "source",
      ),
      { codeVersion: 2 },
    )
    f.restart()
    await rejects(
      f.meetings.verify(room.company, room.slug, "00001111", "source"),
      { code: "INVALID_HOST_CODE" },
    )
    await rejects(
      f.meetings.rotate(
        room.company,
        room.slug,
        "00002222",
        "00003333",
        1,
        "source",
      ),
      { code: "CODE_CHANGED" },
    )
    deepEqual(
      await f.meetings.verify(room.company, room.slug, "00002222", "source"),
      { codeVersion: 2 },
    )
  } catch (error) {
    throw error
  }
  equal(f.notifications.length, 0)
})

test("in-flight signing orders before rotation; old code fails after commit, concurrent rotations have one winner", async t => {
  const f = fixture(t)
  const room = f.room()
  const signing = deferred<string>()
  const entered = deferred<void>()
  f.live.token = () => {
    entered.resolve()
    return signing.promise
  }
  try {
    const join = f.meetings.join(
      room.company,
      room.slug,
      "Host",
      "host",
      "00001111",
      "source",
    )
    await entered.promise
    const rotate = f.meetings.rotate(
      room.company,
      room.slug,
      "00001111",
      "00002222",
      1,
      "source",
    )
    equal(f.store.room(room.company, room.slug)!.codeVersion, 1)
    signing.resolve("issued-before-rotation")
    equal((await join).codeVersion, 1)
    equal((await rotate).codeVersion, 2)
    await rejects(
      f.meetings.join(
        room.company,
        room.slug,
        "Host",
        "host",
        "00001111",
        "source",
      ),
      { code: "INVALID_HOST_CODE" },
    )
    const results = await Promise.allSettled([
      f.meetings.rotate(
        room.company,
        room.slug,
        "00002222",
        "00003333",
        2,
        "source",
      ),
      f.meetings.rotate(
        room.company,
        room.slug,
        "00002222",
        "00004444",
        2,
        "source",
      ),
    ])
    equal(results.filter(result => result.status === "fulfilled").length, 1)
    equal(f.store.room(room.company, room.slug)!.codeVersion, 3)
  } catch (error) {
    throw error
  }
})

test("host capability remains scoped and requires ACTIVE exact identity; recovery does not revoke it", async t => {
  const f = fixture(t)
  const room = f.room()
  const other = f.room()
  try {
    const host = await f.meetings.join(
      room.company,
      room.slug,
      "Host",
      "host",
      "00001111",
      "source",
    )
    const access = host.hostAccess!
    await rejects(f.meetings.reveal(other.company, other.slug, access), {
      code: "INVALID_HOST_ACCESS",
    })
    await rejects(f.meetings.reveal(room.company, room.slug, "fake"), {
      code: "INVALID_HOST_ACCESS",
    })
    await rejects(f.meetings.reveal(room.company, room.slug, access), {
      code: "HOST_NOT_ACTIVE",
    })
    f.participants.push({ identity: host.participantIdentity, active: false })
    await rejects(f.meetings.version(room.company, room.slug, access), {
      code: "HOST_NOT_ACTIVE",
    })
    f.participants[0].active = true
    deepEqual(await f.meetings.version(room.company, room.slug, access), {
      codeVersion: 1,
    })
    await f.meetings.rotate(
      room.company,
      room.slug,
      "00001111",
      "00002222",
      1,
      "source",
    )
    deepEqual(await f.meetings.reveal(room.company, room.slug, access), {
      hostCode: "00002222",
      codeVersion: 2,
    })
    f.participants.length = 0
    await rejects(f.meetings.reveal(room.company, room.slug, access), {
      code: "HOST_NOT_ACTIVE",
    })
    f.participants.push({ identity: host.participantIdentity, active: true })
    deepEqual(await f.meetings.version(room.company, room.slug, access), {
      codeVersion: 2,
    })
    await f.meetings.revoke(room.company, room.slug, access)
    await f.meetings.revoke(room.company, room.slug, access)
    await rejects(f.meetings.reveal(room.company, room.slug, access), {
      code: "INVALID_HOST_ACCESS",
    })
    const fresh = await f.meetings.join(
      room.company,
      room.slug,
      "Host",
      "host",
      "00002222",
      "source",
    )
    notEqual(fresh.participantIdentity, host.participantIdentity)
    notEqual(fresh.hostAccess, access)
  } catch (error) {
    throw error
  }
})

test("revocation concurrent with provider lookup prevents reveal and spoofed identity is denied", async t => {
  const f = fixture(t)
  const room = f.room()
  try {
    const host = await f.meetings.join(
      room.company,
      room.slug,
      "Host",
      "host",
      "00001111",
      "source",
    )
    const present = deferred<LiveParticipant>()
    const entered = deferred<void>()
    f.live.participant = () => {
      entered.resolve()
      return present.promise
    }
    const reveal = f.meetings.reveal(room.company, room.slug, host.hostAccess!)
    await entered.promise
    await f.meetings.revoke(room.company, room.slug, host.hostAccess!)
    present.resolve({ identity: host.participantIdentity, active: true })
    await rejects(reveal, { code: "INVALID_HOST_ACCESS" })
    const fresh = await f.meetings.join(
      room.company,
      room.slug,
      "Host",
      "host",
      "00001111",
      "source",
    )
    f.live.participant = () =>
      Promise.resolve({ identity: "spoofed-host", active: true })
    await rejects(
      f.meetings.reveal(room.company, room.slug, fresh.hostAccess!),
      { code: "HOST_NOT_ACTIVE" },
    )
  } catch (error) {
    throw error
  }
})

test("notification targets only active nonrevoked hosts and carries no code; failure does not undo rotation", async t => {
  const f = fixture(t)
  const room = f.room()
  try {
    const first = await f.meetings.join(
      room.company,
      room.slug,
      "Host 1",
      "host",
      "00001111",
      "source",
    )
    const second = await f.meetings.join(
      room.company,
      room.slug,
      "Host 2",
      "host",
      "00001111",
      "source",
    )
    const revoked = await f.meetings.join(
      room.company,
      room.slug,
      "Host 3",
      "host",
      "00001111",
      "source",
    )
    const guest = await f.meetings.join(
      room.company,
      room.slug,
      "Guest",
      "participant",
      undefined,
      "source",
    )
    f.participants.push(
      ...[first, second, revoked, guest].map(item => ({
        identity: item.participantIdentity,
        active: true,
      })),
    )
    await f.meetings.revoke(room.company, room.slug, revoked.hostAccess!)
    await f.meetings.rotate(
      room.company,
      room.slug,
      "00001111",
      "00002222",
      1,
      "source",
    )
    deepEqual(f.notifications, [
      {
        room: `${room.company}--${room.slug}`,
        identities: [first.participantIdentity, second.participantIdentity],
        version: 2,
      },
    ])
    f.live.notify = () => Promise.reject(new Error("provider failure secret"))
    deepEqual(
      await f.meetings.rotate(
        room.company,
        room.slug,
        "00002222",
        "00003333",
        2,
        "source",
      ),
      { codeVersion: 3 },
    )
    deepEqual(
      await f.meetings.version(room.company, room.slug, first.hostAccess!),
      { codeVersion: 3 },
    )
    deepEqual(
      await f.meetings.reveal(room.company, room.slug, first.hostAccess!),
      { hostCode: "00003333", codeVersion: 3 },
    )
  } catch (error) {
    throw error
  }
})

test("notification latency does not hold room queue after commit", async t => {
  const f = fixture(t)
  const room = f.room()
  const listed = deferred<LiveParticipant[]>()
  const entered = deferred<void>()
  f.live.participants = () => {
    entered.resolve()
    return listed.promise
  }
  try {
    const rotation = f.meetings.rotate(
      room.company,
      room.slug,
      "00001111",
      "00002222",
      1,
      "source",
    )
    await entered.promise
    deepEqual(
      await f.meetings.verify(room.company, room.slug, "00002222", "source"),
      { codeVersion: 2 },
    )
    listed.resolve([])
    await rotation
    equal(f.notifications.length, 0)
  } catch (error) {
    throw error
  }
})

test("shared persisted room budget counts successful verification, host join and changes; expiry unlocks", async t => {
  const f = fixture(t)
  const room = f.room()
  try {
    await f.meetings.join(
      room.company,
      room.slug,
      "Host",
      "host",
      "00001111",
      "source",
    )
    await f.meetings.rotate(
      room.company,
      room.slug,
      "00001111",
      "00001111",
      1,
      "other-source",
    )
    for (let i = 0; i < 18; i++)
      await f.meetings.verify(
        room.company,
        room.slug,
        "00001111",
        `source-${i}`,
      )
    f.restart()
    await rejects(
      f.meetings.verify(room.company, room.slug, "00001111", "new-source"),
      { code: "RATE_LIMITED", retryAfter: 900 },
    )
    f.advance(899000)
    await rejects(
      f.meetings.join(
        room.company,
        room.slug,
        "Host",
        "host",
        "00001111",
        "source",
      ),
      { code: "RATE_LIMITED", retryAfter: 1 },
    )
    f.advance(1000)
    deepEqual(
      await f.meetings.verify(room.company, room.slug, "00001111", "source"),
      { codeVersion: 1 },
    )
  } catch (error) {
    throw error
  }
})

test("parallel guesses cannot exceed room budget; source budget spans rooms and survives restart", async t => {
  const f = fixture(t)
  const room = f.room()
  try {
    const guesses = await Promise.allSettled(
      Array.from({ length: 25 }, (_, i) =>
        f.meetings.verify(room.company, room.slug, "11111111", `source-${i}`),
      ),
    )
    equal(
      guesses.filter(
        result =>
          result.status === "rejected" &&
          result.reason.code === "INVALID_HOST_CODE",
      ).length,
      20,
    )
    equal(
      guesses.filter(
        result =>
          result.status === "rejected" && result.reason.code === "RATE_LIMITED",
      ).length,
      5,
    )
    const rooms = [f.room(), f.room(), f.room(), f.room()]
    for (const candidate of rooms.slice(0, 3))
      for (let i = 0; i < 20; i++)
        await f.meetings.verify(
          candidate.company,
          candidate.slug,
          "00001111",
          "same-source",
        )
    f.restart()
    await rejects(
      f.meetings.verify(
        rooms[3].company,
        rooms[3].slug,
        "00001111",
        "same-source",
      ),
      { code: "RATE_LIMITED" },
    )
  } catch (error) {
    throw error
  }
})

test("creation, guest and global limits expire without extending rejected attempts", async t => {
  const f = fixture(t)
  const room = f.room()
  for (let i = 0; i < 4; i++) f.room()
  throws(() => f.room(), { code: "RATE_LIMITED", retryAfter: 3600 })
  try {
    for (let i = 0; i < 60; i++)
      await f.meetings.join(
        room.company,
        room.slug,
        "Guest",
        "participant",
        undefined,
        "guest-source",
      )
    await rejects(
      f.meetings.join(
        room.company,
        room.slug,
        "Guest",
        "participant",
        undefined,
        "guest-source",
      ),
      { code: "RATE_LIMITED", retryAfter: 60 },
    )
    for (let i = 0; i < 120; i++) f.meetings.request("api-source")
    throws(() => f.meetings.request("api-source"), { code: "RATE_LIMITED" })
    f.advance(60000)
    f.meetings.request("api-source")
    await f.meetings.join(
      room.company,
      room.slug,
      "Guest",
      "participant",
      undefined,
      "guest-source",
    )
    f.advance(3540000)
    f.room()
  } catch (error) {
    throw error
  }
})

test("failed signing and record persistence return no credentials; tampering/wrong key fail closed", async t => {
  const f = fixture(t)
  const room = f.room()
  try {
    f.live.token = () => Promise.reject(new Error("sign failed"))
    await rejects(
      f.meetings.join(
        room.company,
        room.slug,
        "Host",
        "host",
        "00001111",
        "source",
      ),
    )
    equal(f.store.hosts(room.company, room.slug).length, 0)
    f.live.token = () => Promise.resolve("secret-token")
    const original = f.store.addAccess
    f.store.addAccess = () => {
      throw new Error("storage failed")
    }
    await rejects(
      f.meetings.join(
        room.company,
        room.slug,
        "Host",
        "host",
        "00001111",
        "source",
      ),
    )
    equal(f.store.hosts(room.company, room.slug).length, 0)
    f.store.addAccess = original
    const wrongKey = createMeetings(f.store, Buffer.alloc(32, 43), f.live)
    await rejects(
      wrongKey.verify(room.company, room.slug, "00001111", "source"),
    )
    const db = new DatabaseSync(f.path)
    db.prepare("UPDATE rooms SET ciphertext=? WHERE company=? AND slug=?").run(
      Buffer.alloc(8),
      room.company,
      room.slug,
    )
    db.close()
    await rejects(
      f.meetings.verify(room.company, room.slug, "00001111", "source"),
    )
  } catch (error) {
    throw error
  }
})

test("real SDK JWT grants are minimal, room-scoped, signed and expire in five minutes", async () => {
  const live = liveKit(
    "wss://meet.example",
    "https://meet.example",
    "api-key",
    "secret-at-least-thirty-two-characters",
  )
  try {
    const token = await live.token(
      "nkolosov--meeting",
      "server-identity",
      "Host",
    )
    const verifier = new TokenVerifier(
      "api-key",
      "secret-at-least-thirty-two-characters",
    )
    const claims = await verifier.verify(token)
    equal(claims.sub, "server-identity")
    deepEqual(claims.video, {
      roomJoin: true,
      room: "nkolosov--meeting",
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    })
    equal(Number(claims.exp) - Number(claims.nbf), 300)
    const expiredToken = new AccessToken(
      "api-key",
      "secret-at-least-thirty-two-characters",
      { identity: "expired", ttl: -60 },
    )
    expiredToken.addGrant({ roomJoin: true, room: "nkolosov--meeting" })
    await rejects(verifier.verify(await expiredToken.toJwt(), 0))
    const expired = liveKit(
      "wss://meet.example",
      "https://meet.example",
      "wrong-key",
      "other-secret-at-least-thirty-two-characters",
    )
    await rejects(
      verifier.verify(
        await expired.token("nkolosov--meeting", "identity", "Guest"),
      ),
    )
  } catch (error) {
    throw error
  }
})
