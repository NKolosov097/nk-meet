import { mkdtempSync, rmSync } from "node:fs"
import { join, resolve, sep } from "node:path"
import { tmpdir } from "node:os"
import type { TestContext } from "node:test"
import { createMeetings } from "../src/meetings.ts"
import { openStore } from "../src/store.ts"
import type { LiveKit, LiveParticipant } from "../src/livekit.ts"

export function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "nk-backend-"))
  const path = join(directory, "rooms.sqlite")
  const key = Buffer.alloc(32, 42)
  const participants: LiveParticipant[] = []
  const notifications: {
    room: string
    identities: string[]
    version: number
  }[] = []
  const tokens: { room: string; identity: string; name: string }[] = []
  const live: LiveKit = {
    serverUrl: "wss://meet.example",
    token(room, identity, name) {
      tokens.push({ room, identity, name })
      return Promise.resolve("recipient-token")
    },
    participant(_room, identity) {
      return Promise.resolve(
        participants.find(item => item.identity === identity),
      )
    },
    participants() {
      return Promise.resolve(participants)
    },
    notify(room, identities, version) {
      notifications.push({ room, identities, version })
      return Promise.resolve()
    },
  }
  let time = 1000000
  let store = openStore(path)
  let meetings = createMeetings(store, key, live, () => time)
  t.after(() => {
    store.close()
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep))
      throw new Error("Unexpected fixture path")
    rmSync(directory, { recursive: true })
  })
  return {
    path,
    key,
    live,
    participants,
    notifications,
    tokens,
    get store() {
      return store
    },
    get meetings() {
      return meetings
    },
    advance(milliseconds: number) {
      time += milliseconds
    },
    restart() {
      store.close()
      store = openStore(path)
      meetings = createMeetings(store, key, live, () => time)
    },
    room(source = "source") {
      return meetings.create("00001111", source)
    },
  }
}

export function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return { promise, resolve }
}
