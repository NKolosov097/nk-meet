import {
  decodeReactionMessage,
  encodeReactionMessage,
  HAND_RAISED_ATTRIBUTE,
  hasHandRaisedAttribute,
  QUICK_REACTIONS,
  REACTION_TOPIC,
  readHandRaisedAttribute,
  type ReactionMessage,
} from "./reactions"

const encodeJson = (value: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(value))

test("round-trips the Proofix quick-reaction contract", () => {
  const message: ReactionMessage = {
    type: "ephemeral",
    reactionId: "alice:1:1",
    reaction: "thumbsUp",
    participant: "alice",
  }

  expect(REACTION_TOPIC).toBe("reaction-topic")
  expect(HAND_RAISED_ATTRIBUTE).toBe("nk-meet.handRaised")
  expect(decodeReactionMessage(encodeReactionMessage(message))).toEqual(message)
})

test("accepts the Proofix raised-hand compatibility contract", () => {
  const message: ReactionMessage = {
    type: "raiseHand",
    isHandRaised: false,
    participant: "alice",
  }

  expect(decodeReactionMessage(encodeReactionMessage(message))).toEqual(message)
})

test("exposes exactly the six quick reaction choices", () => {
  expect(QUICK_REACTIONS).toEqual({
    hooray: { glyph: "🥳", label: "Celebrate" },
    thumbsUp: { glyph: "👍", label: "Thumbs up" },
    thumbsDown: { glyph: "👎", label: "Thumbs down" },
    heart: { glyph: "❤️", label: "Heart" },
    smile: { glyph: "😁", label: "Smile" },
    cry: { glyph: "😭", label: "Cry" },
  })
})

test.each([
  ["malformed JSON", new TextEncoder().encode("{")],
  ["an array", encodeJson([])],
  ["an oversized payload", new Uint8Array(1025)],
  ["an unknown type", encodeJson({ type: "unknown", participant: "alice" })],
  [
    "the default pseudo-reaction",
    encodeJson({
      type: "ephemeral",
      reactionId: "alice:1:1",
      reaction: "default",
      participant: "alice",
    }),
  ],
  [
    "raiseHand as a quick reaction",
    encodeJson({
      type: "ephemeral",
      reactionId: "alice:1:1",
      reaction: "raiseHand",
      participant: "alice",
    }),
  ],
  [
    "an empty reaction id",
    encodeJson({
      type: "ephemeral",
      reactionId: "",
      reaction: "heart",
      participant: "alice",
    }),
  ],
  [
    "an overlong reaction id",
    encodeJson({
      type: "ephemeral",
      reactionId: "a".repeat(129),
      reaction: "heart",
      participant: "alice",
    }),
  ],
  [
    "a non-boolean hand value",
    encodeJson({
      type: "raiseHand",
      isHandRaised: "true",
      participant: "alice",
    }),
  ],
  [
    "a missing quick-reaction participant",
    encodeJson({
      type: "ephemeral",
      reactionId: "alice:1:1",
      reaction: "heart",
    }),
  ],
  [
    "an empty raised-hand participant",
    encodeJson({ type: "raiseHand", isHandRaised: true, participant: "" }),
  ],
])("rejects %s", (_description, payload) => {
  expect(decodeReactionMessage(payload)).toBeNull()
})

test("reads raised hands only from the exact authoritative value", () => {
  expect(readHandRaisedAttribute({ "nk-meet.handRaised": "true" })).toBe(true)
  expect(readHandRaisedAttribute({ "nk-meet.handRaised": "" })).toBe(false)
  expect(readHandRaisedAttribute({ "nk-meet.handRaised": "false" })).toBe(false)
})

test("distinguishes an absent hand attribute from a present lowered marker", () => {
  expect(hasHandRaisedAttribute({})).toBe(false)
  expect(hasHandRaisedAttribute({ "nk-meet.handRaised": "" })).toBe(true)
})
