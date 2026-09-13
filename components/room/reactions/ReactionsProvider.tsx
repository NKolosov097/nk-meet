import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react"
import { AccessibilityInfo, Alert } from "react-native"

import {
  useDataChannel,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/react-native"
import { RoomEvent, type Participant } from "livekit-client"

import {
  decodeReactionMessage,
  encodeReactionMessage,
  HAND_RAISED_ATTRIBUTE,
  hasHandRaisedAttribute,
  QUICK_REACTIONS,
  REACTION_TOPIC,
  readHandRaisedAttribute,
  type QuickReactionType,
} from "./reactions"

const QUICK_REACTION_THROTTLE_MS = 300
const QUICK_REACTION_LIFETIME_MS = 2_000
const MAX_LIVE_REACTIONS_PER_PARTICIPANT = 5

export interface EphemeralReaction {
  // Sender-scoped id used to suppress live duplicates.
  id: string
  // Quick reaction catalog key.
  type: QuickReactionType
  // Absolute expiry timestamp in milliseconds.
  expiresAt: number
}

export interface ParticipantReactionState {
  // Current raised-hand state.
  isHandRaised: boolean
  // Unexpired quick reactions in arrival order.
  ephemeralReactions: EphemeralReaction[]
}

interface ReactionsContextValue {
  // Reaction state keyed by participant identity.
  participants: Record<string, ParticipantReactionState>
  // Whether the local participant may publish quick reactions.
  canSendQuickReactions: boolean
  // Whether the local participant may publish hand state.
  canUpdateHand: boolean
  // Whether an authoritative hand update is in flight.
  isHandUpdatePending: boolean
  // Publishes a quick reaction.
  sendQuickReaction: (type: QuickReactionType) => void
  // Toggles the local raised-hand state.
  toggleHand: VoidFunction
}

const ReactionsContext = createContext<ReactionsContextValue | undefined>(
  undefined,
)

const participantState = (
  source: Participant,
  ephemeralReactions: EphemeralReaction[] = [],
): ParticipantReactionState => ({
  isHandRaised: readHandRaisedAttribute(source.attributes),
  ephemeralReactions,
})

const currentParticipants = (
  localParticipant: Participant,
  remoteParticipants: Iterable<Participant>,
  previous: Record<string, ParticipantReactionState> = {},
): Record<string, ParticipantReactionState> =>
  Object.fromEntries(
    [localParticipant, ...remoteParticipants].map(participant => [
      participant.identity,
      participantState(
        participant,
        previous[participant.identity]?.ephemeralReactions,
      ),
    ]),
  )

export const ReactionsProvider = ({ children }: PropsWithChildren) => {
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()
  const [participants, setParticipants] = useState<
    Record<string, ParticipantReactionState>
  >(() =>
    currentParticipants(
      room.localParticipant,
      room.remoteParticipants.values(),
    ),
  )
  const participantsRef = useRef(participants)
  const reactionIdsRef = useRef(new Map<string, Set<string>>())
  const timersRef = useRef(
    new Map<string, Map<string, ReturnType<typeof setTimeout>>>(),
  )
  const lastQuickReactionAtRef = useRef(Number.NEGATIVE_INFINITY)
  const reactionCounterRef = useRef(0)
  const handUpdatePendingRef = useRef(false)
  const [isHandUpdatePending, setIsHandUpdatePending] = useState(false)

  const replaceParticipants = useCallback(
    (next: Record<string, ParticipantReactionState>) => {
      participantsRef.current = next
      setParticipants(next)
    },
    [],
  )

  const setHand = useCallback(
    (identity: string, isHandRaised: boolean) => {
      const current = participantsRef.current
      replaceParticipants({
        ...current,
        [identity]: {
          isHandRaised,
          ephemeralReactions: current[identity]?.ephemeralReactions ?? [],
        },
      })
    },
    [replaceParticipants],
  )

  const clearParticipantTimers = useCallback((identity: string) => {
    for (const timer of timersRef.current.get(identity)?.values() ?? []) {
      clearTimeout(timer)
    }
    timersRef.current.delete(identity)
    reactionIdsRef.current.delete(identity)
  }, [])

  const pruneExpired = useCallback(
    (now: number) => {
      const next = Object.fromEntries(
        Object.entries(participantsRef.current).map(([identity, state]) => {
          const ephemeralReactions = state.ephemeralReactions.filter(
            reaction => reaction.expiresAt > now,
          )
          reactionIdsRef.current.set(
            identity,
            new Set(ephemeralReactions.map(reaction => reaction.id)),
          )
          return [identity, { ...state, ephemeralReactions }]
        }),
      )
      replaceParticipants(next)
    },
    [replaceParticipants],
  )

  const scheduleExpiry = useCallback(
    (identity: string, reaction: EphemeralReaction) => {
      const timer = setTimeout(
        () => {
          timersRef.current.get(identity)?.delete(reaction.id)
          pruneExpired(Date.now())
        },
        Math.max(0, reaction.expiresAt - Date.now()),
      )
      const timers = timersRef.current.get(identity) ?? new Map()
      timers.set(reaction.id, timer)
      timersRef.current.set(identity, timers)
    },
    [pruneExpired],
  )

  const addReaction = useCallback(
    (identity: string, reaction: EphemeralReaction): boolean => {
      const ids = reactionIdsRef.current.get(identity) ?? new Set<string>()
      if (ids.has(reaction.id)) return false

      ids.add(reaction.id)
      reactionIdsRef.current.set(identity, ids)
      const current = participantsRef.current
      const existing = current[identity] ?? {
        isHandRaised: false,
        ephemeralReactions: [],
      }
      const reactions = [...existing.ephemeralReactions, reaction]
      const ephemeralReactions = reactions.slice(
        -MAX_LIVE_REACTIONS_PER_PARTICIPANT,
      )

      for (const removed of reactions.slice(
        0,
        -MAX_LIVE_REACTIONS_PER_PARTICIPANT,
      )) {
        const timer = timersRef.current.get(identity)?.get(removed.id)
        if (timer) clearTimeout(timer)
        timersRef.current.get(identity)?.delete(removed.id)
        ids.delete(removed.id)
      }

      replaceParticipants({
        ...current,
        [identity]: { ...existing, ephemeralReactions },
      })
      scheduleExpiry(identity, reaction)
      return true
    },
    [replaceParticipants, scheduleExpiry],
  )

  const onDataMessage = useCallback(
    ({ payload, from }: { payload: Uint8Array; from?: Participant }) => {
      if (!from?.identity) return
      const message = decodeReactionMessage(payload)
      if (!message) return

      if (message.type === "ephemeral") {
        const accepted = addReaction(from.identity, {
          id: message.reactionId,
          type: message.reaction,
          expiresAt: Date.now() + QUICK_REACTION_LIFETIME_MS,
        })
        if (accepted) {
          AccessibilityInfo.announceForAccessibility(
            `${from.name || from.identity} reacted with ${QUICK_REACTIONS[message.reaction].label}`,
          )
        }
        return
      }

      setHand(
        from.identity,
        hasHandRaisedAttribute(from.attributes)
          ? readHandRaisedAttribute(from.attributes)
          : message.isHandRaised,
      )
    },
    [addReaction, setHand],
  )

  const { send } = useDataChannel(REACTION_TOPIC, onDataMessage)

  useEffect(() => {
    const onAttributesChanged = (
      _changedAttributes: Record<string, string>,
      participant: Participant,
    ) =>
      setHand(
        participant.identity,
        readHandRaisedAttribute(participant.attributes),
      )
    const onParticipantConnected = (participant: Participant) =>
      setHand(
        participant.identity,
        readHandRaisedAttribute(participant.attributes),
      )
    const onParticipantDisconnected = (participant: Participant) => {
      clearParticipantTimers(participant.identity)
      const { [participant.identity]: _removed, ...remaining } =
        participantsRef.current
      replaceParticipants(remaining)
    }
    const onReconnected = () => {
      const next = currentParticipants(
        room.localParticipant,
        room.remoteParticipants.values(),
        participantsRef.current,
      )
      for (const identity of Object.keys(participantsRef.current)) {
        if (!next[identity]) clearParticipantTimers(identity)
      }
      replaceParticipants(next)
    }

    room.on(RoomEvent.ParticipantAttributesChanged, onAttributesChanged)
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected)
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
    room.on(RoomEvent.Reconnected, onReconnected)
    const timers = timersRef.current

    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, onAttributesChanged)
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected)
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
      room.off(RoomEvent.Reconnected, onReconnected)
      for (const identity of timers.keys()) {
        clearParticipantTimers(identity)
      }
    }
  }, [clearParticipantTimers, replaceParticipants, room, setHand])

  const permissions = localParticipant.permissions
  const canSendQuickReactions = permissions?.canPublishData === true
  const canUpdateHand =
    canSendQuickReactions && permissions?.canUpdateMetadata === true

  const sendQuickReaction = useCallback(
    (type: QuickReactionType) => {
      const identity = localParticipant.identity
      const now = Date.now()
      if (
        !identity ||
        !canSendQuickReactions ||
        now - lastQuickReactionAtRef.current < QUICK_REACTION_THROTTLE_MS
      ) {
        return
      }

      lastQuickReactionAtRef.current = now
      reactionCounterRef.current += 1
      const id = `${identity}:${now}:${reactionCounterRef.current}`
      addReaction(identity, {
        id,
        type,
        expiresAt: now + QUICK_REACTION_LIFETIME_MS,
      })

      const publish = async (): Promise<void> => {
        try {
          await send(
            encodeReactionMessage({
              type: "ephemeral",
              reactionId: id,
              reaction: type,
              participant: identity,
            }),
            { reliable: true },
          )
        } catch (error) {
          console.error("Failed to send reaction", error)
        }
      }
      publish()
    },
    [addReaction, canSendQuickReactions, localParticipant.identity, send],
  )

  const toggleHand = useCallback(() => {
    const identity = localParticipant.identity
    if (!identity || !canUpdateHand || handUpdatePendingRef.current) return

    const nextValue = !participantsRef.current[identity]?.isHandRaised
    handUpdatePendingRef.current = true
    setIsHandUpdatePending(true)
    setHand(identity, nextValue)

    const publish = async (): Promise<void> => {
      try {
        try {
          await localParticipant.setAttributes({
            [HAND_RAISED_ATTRIBUTE]: nextValue ? "true" : "",
          })
        } catch (error) {
          setHand(
            identity,
            readHandRaisedAttribute(localParticipant.attributes),
          )
          console.error("Failed to update hand", error)
          Alert.alert("Hand update failed", "Could not update your hand status")
          return
        }

        try {
          await send(
            encodeReactionMessage({
              type: "raiseHand",
              isHandRaised: nextValue,
              participant: identity,
            }),
            { reliable: true },
          )
        } catch (error) {
          console.error("Failed to send hand compatibility update", error)
        }
      } finally {
        handUpdatePendingRef.current = false
        setIsHandUpdatePending(false)
      }
    }
    publish()
  }, [canUpdateHand, localParticipant, send, setHand])

  const value = useMemo<ReactionsContextValue>(
    () => ({
      participants,
      canSendQuickReactions,
      canUpdateHand,
      isHandUpdatePending,
      sendQuickReaction,
      toggleHand,
    }),
    [
      canSendQuickReactions,
      canUpdateHand,
      isHandUpdatePending,
      participants,
      sendQuickReaction,
      toggleHand,
    ],
  )

  return (
    <ReactionsContext.Provider value={value}>
      {children}
    </ReactionsContext.Provider>
  )
}

export const useReactions = (): ReactionsContextValue => {
  const value = useContext(ReactionsContext)
  if (!value)
    throw new Error("useReactions must be used within ReactionsProvider")
  return value
}
