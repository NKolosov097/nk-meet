import assert from "node:assert/strict"
import test from "node:test"

import { Track } from "livekit-client"

import { getTrackKey } from "./trackKey.ts"

test("combines participant identity and track source", () => {
  const track = {
    participant: { identity: "ada" },
    source: Track.Source.Camera,
  } as never

  assert.equal(getTrackKey(track), `ada-${Track.Source.Camera}`)
})

test("distinguishes camera and screen-share entries for the same participant", () => {
  const camera = {
    participant: { identity: "ada" },
    source: Track.Source.Camera,
  } as never
  const screenShare = {
    participant: { identity: "ada" },
    source: Track.Source.ScreenShare,
  } as never

  assert.notEqual(getTrackKey(camera), getTrackKey(screenShare))
})

test("distinguishes different participants on the same source", () => {
  const ada = {
    participant: { identity: "ada" },
    source: Track.Source.Camera,
  } as never
  const grace = {
    participant: { identity: "grace" },
    source: Track.Source.Camera,
  } as never

  assert.notEqual(getTrackKey(ada), getTrackKey(grace))
})
