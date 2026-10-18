import { randomBytes, randomUUID } from "node:crypto"
import {
  decryptCode,
  encryptCode,
  hashAccess,
  matchesCode,
  newAccess,
} from "./credentials.ts"
import { roomName, withTimeout } from "./livekit.ts"
import type { LiveKit } from "./livekit.ts"
import type { Budget, Room, Store } from "./store.ts"

export class ApiError extends Error {
  status: number
  code: string
  retryAfter?: number
  constructor(
    status: number,
    code: string,
    message: string,
    retryAfter?: number,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

export function validCode(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{8}$/.test(value)
}
export function validSegment(value: string): boolean {
  return value.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}
export function invalidRequest(): never {
  throw new ApiError(400, "INVALID_REQUEST", "Invalid request")
}

export function createMeetings(
  store: Store,
  key: Uint8Array,
  live: LiveKit,
  now: () => number = Date.now,
) {
  // shortcut: one process owns room ordering; use shared locking before adding replicas or workers.
  const queues = new Map<string, Promise<void>>()
  async function ordered<T>(
    company: string,
    slug: string,
    operation: () => Promise<T> | T,
  ): Promise<T> {
    const name = roomName(company, slug)
    const previous = queues.get(name) ?? Promise.resolve()
    let release: VoidFunction = () => {}
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const tail = previous.then(() => gate)
    queues.set(name, tail)
    try {
      await previous
      return await operation()
    } catch (error) {
      throw error
    } finally {
      release()
      if (queues.get(name) === tail) queues.delete(name)
    }
  }
  function requireRoom(company: string, slug: string): Room {
    if (!validSegment(company) || !validSegment(slug)) invalidRequest()
    const room = store.room(company, slug)
    if (!room) throw new ApiError(404, "ROOM_NOT_FOUND", "Room not found")
    return room
  }
  function consume(budgets: Budget[]) {
    const retry = store.consume(budgets, now())
    if (retry)
      throw new ApiError(
        429,
        "RATE_LIMITED",
        "Too many attempts. Try again later.",
        retry,
      )
  }
  function verify(room: Room, code: unknown, source: string) {
    if (!validCode(code)) invalidRequest()
    consume([
      {
        scope: "host-room",
        key: roomName(room.company, room.slug),
        limit: 20,
        windowMs: 900000,
      },
      { scope: "host-source", key: source, limit: 60, windowMs: 900000 },
    ])
    if (
      !matchesCode(
        decryptCode(key, room.company, room.slug, room.codeVersion, room),
        code,
      )
    )
      throw new ApiError(401, "INVALID_HOST_CODE", "Invalid host code")
  }
  function requireAccess(
    company: string,
    slug: string,
    access: string,
  ): string {
    const identity = store.access(hashAccess(access), company, slug)
    if (!identity)
      throw new ApiError(401, "INVALID_HOST_ACCESS", "Invalid host access")
    return identity
  }
  async function activeRead(
    company: string,
    slug: string,
    access: string,
    reveal: boolean,
  ) {
    requireRoom(company, slug)
    const identity = requireAccess(company, slug, access)
    try {
      const participant = await withTimeout(
        live.participant(roomName(company, slug), identity),
      )
      if (
        !participant ||
        participant.identity !== identity ||
        !participant.active
      )
        throw new ApiError(
          409,
          "HOST_NOT_ACTIVE",
          "Host is not active. Try again after reconnecting.",
        )
      return await ordered(company, slug, () => {
        requireAccess(company, slug, access)
        const room = requireRoom(company, slug)
        return reveal
          ? {
              codeVersion: room.codeVersion,
              hostCode: decryptCode(key, company, slug, room.codeVersion, room),
            }
          : { codeVersion: room.codeVersion }
      })
    } catch (error) {
      throw error
    }
  }
  return {
    store,
    request(source: string) {
      consume([
        { scope: "api-source", key: source, limit: 120, windowMs: 60000 },
      ])
    },
    get(company: string, slug: string) {
      requireRoom(company, slug)
      return { company, slug }
    },
    create(code: unknown, source: string) {
      if (!validCode(code)) invalidRequest()
      consume([
        { scope: "create-source", key: source, limit: 5, windowMs: 3600000 },
      ])
      const company = "nkolosov"
      for (;;) {
        const slug = randomBytes(6).toString("hex")
        if (
          store.create(
            company,
            slug,
            encryptCode(key, company, slug, 1, code),
            now(),
          )
        )
          return { company, slug }
      }
    },
    async join(
      company: string,
      slug: string,
      displayName: unknown,
      mode: unknown,
      code: unknown,
      source: string,
    ) {
      requireRoom(company, slug)
      if (
        typeof displayName !== "string" ||
        displayName.length > 80 ||
        !displayName.trim() ||
        (mode !== "host" && mode !== "participant")
      )
        invalidRequest()
      if (mode === "host" && !validCode(code)) invalidRequest()
      try {
        return await ordered(company, slug, async () => {
          const room = requireRoom(company, slug)
          if (mode === "host") verify(room, code, source)
          else
            consume([
              {
                scope: "guest-source",
                key: source,
                limit: 60,
                windowMs: 60000,
              },
            ])
          const participantIdentity = randomUUID()
          try {
            const participantToken = await withTimeout(
              live.token(
                roomName(company, slug),
                participantIdentity,
                displayName.trim(),
              ),
            )
            if (mode === "participant")
              return {
                serverUrl: live.serverUrl,
                participantToken,
                participantIdentity,
                role: "participant" as const,
              }
            const hostAccess = newAccess()
            store.addAccess(
              hashAccess(hostAccess),
              company,
              slug,
              participantIdentity,
              now(),
            )
            return {
              serverUrl: live.serverUrl,
              participantToken,
              participantIdentity,
              role: "host" as const,
              codeVersion: room.codeVersion,
              hostAccess,
            }
          } catch (error) {
            throw error
          }
        })
      } catch (error) {
        throw error
      }
    },
    async verify(company: string, slug: string, code: unknown, source: string) {
      try {
        return await ordered(company, slug, () => {
          const room = requireRoom(company, slug)
          verify(room, code, source)
          return { codeVersion: room.codeVersion }
        })
      } catch (error) {
        throw error
      }
    },
    async rotate(
      company: string,
      slug: string,
      current: unknown,
      replacement: unknown,
      expected: unknown,
      source: string,
    ) {
      requireRoom(company, slug)
      if (
        !validCode(current) ||
        !validCode(replacement) ||
        typeof expected !== "number" ||
        !Number.isSafeInteger(expected) ||
        expected < 1
      )
        invalidRequest()
      try {
        const result = await ordered(company, slug, () => {
          const room = requireRoom(company, slug)
          verify(room, current, source)
          if (room.codeVersion !== expected)
            throw new ApiError(
              409,
              "CODE_CHANGED",
              "Host code changed. Verify the current code again.",
            )
          if (current === replacement)
            return { codeVersion: room.codeVersion, changed: false }
          const codeVersion = room.codeVersion + 1
          store.rotate(
            room,
            encryptCode(key, company, slug, codeVersion, replacement),
            codeVersion,
          )
          return { codeVersion, changed: true }
        })
        if (result.changed) {
          const notify = async () => {
            try {
              const participants = await live.participants(
                roomName(company, slug),
              )
              const hosts = new Set(store.hosts(company, slug))
              const identities = participants
                .filter(
                  participant =>
                    participant.active && hosts.has(participant.identity),
                )
                .map(participant => participant.identity)
              if (identities.length)
                await live.notify(
                  roomName(company, slug),
                  identities,
                  result.codeVersion,
                )
            } catch (error) {
              throw error
            }
          }
          try {
            await withTimeout(notify())
          } catch {
            /* Committed rotations remain successful; protected version reads catch up. */
          }
        }
        return { codeVersion: result.codeVersion }
      } catch (error) {
        throw error
      }
    },
    async version(company: string, slug: string, access: string) {
      try {
        return await activeRead(company, slug, access, false)
      } catch (error) {
        throw error
      }
    },
    async reveal(company: string, slug: string, access: string) {
      try {
        return await activeRead(company, slug, access, true)
      } catch (error) {
        throw error
      }
    },
    async revoke(company: string, slug: string, access: string) {
      try {
        await ordered(company, slug, () => {
          requireRoom(company, slug)
          store.revoke(hashAccess(access), company, slug)
        })
      } catch (error) {
        throw error
      }
    },
  }
}

export type Meetings = ReturnType<typeof createMeetings>
