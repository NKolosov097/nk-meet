export const REACTION_TOPIC = "reaction-topic"
export const HAND_RAISED_ATTRIBUTE = "nk-meet.handRaised"

export const QUICK_REACTIONS = {
  hooray: { glyph: "🥳", label: "Celebrate" },
  thumbsUp: { glyph: "👍", label: "Thumbs up" },
  thumbsDown: { glyph: "👎", label: "Thumbs down" },
  heart: { glyph: "❤️", label: "Heart" },
  smile: { glyph: "😁", label: "Smile" },
  cry: { glyph: "😭", label: "Cry" },
} as const

export type QuickReactionType = keyof typeof QUICK_REACTIONS

export interface EphemeralReactionMessage {
  // Identifies a transient quick-reaction packet.
  type: "ephemeral"
  // Sender-scoped id used to suppress live duplicates.
  reactionId: string
  // Quick reaction catalog key.
  reaction: QuickReactionType
  // Proofix compatibility identity; receivers do not trust it.
  participant: string
}

export interface RaiseHandReactionMessage {
  // Identifies a raised-hand compatibility packet.
  type: "raiseHand"
  // Compatibility hand state for senders without attributes.
  isHandRaised: boolean
  // Proofix compatibility identity; receivers do not trust it.
  participant: string
}

export type ReactionMessage =
  EphemeralReactionMessage | RaiseHandReactionMessage

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isQuickReaction = (value: unknown): value is QuickReactionType =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(QUICK_REACTIONS, value)

export const encodeReactionMessage = (message: ReactionMessage): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(message))

export const decodeReactionMessage = (
  payload: Uint8Array,
): ReactionMessage | null => {
  // Treats the data channel as untrusted and returns only validated wire shapes.
  if (payload.byteLength > 1024) return null

  let value: unknown
  try {
    value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(payload),
    )
  } catch {
    return null
  }

  if (
    !isObject(value) ||
    typeof value.participant !== "string" ||
    !value.participant
  ) {
    return null
  }

  if (value.type === "ephemeral") {
    return typeof value.reactionId === "string" &&
      value.reactionId.length > 0 &&
      value.reactionId.length <= 128 &&
      isQuickReaction(value.reaction)
      ? {
          type: value.type,
          reactionId: value.reactionId,
          reaction: value.reaction,
          participant: value.participant,
        }
      : null
  }

  return value.type === "raiseHand" && typeof value.isHandRaised === "boolean"
    ? {
        type: value.type,
        isHandRaised: value.isHandRaised,
        participant: value.participant,
      }
    : null
}

export const hasHandRaisedAttribute = (
  attributes: Readonly<Record<string, string>>,
): boolean =>
  Object.prototype.hasOwnProperty.call(attributes, HAND_RAISED_ATTRIBUTE)

export const readHandRaisedAttribute = (
  attributes: Readonly<Record<string, string>>,
): boolean => attributes[HAND_RAISED_ATTRIBUTE] === "true"
