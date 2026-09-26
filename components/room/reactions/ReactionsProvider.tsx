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
const MAX_SEEN_REACTION_IDS_PER_PARTICIPANT = 100

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

const ReactionsContext = createContext<ReactionsContextValue>({
  participants: {},
  canSendQuickReactions: false,
  canUpdateHand: false,
  isHandUpdatePending: false,
  sendQuickReaction: () => undefined,
  toggleHand: () => undefined,
})

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
  // Rehydrates authoritative hand state while retaining current transient reactions.
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
  // Keeps room-event callbacks synchronized with the latest rendered state.
  const participantsRef = useRef(participants)
  const seenReactionIdsRef = useRef(new Map<string, Map<string, number>>())
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const lastQuickReactionAtRef = useRef(Number.NEGATIVE_INFINITY)
  const reactionCounterRef = useRef(0)
  const handUpdatePendingRef = useRef(false)
  const [isHandUpdatePending, setIsHandUpdatePending] = useState(false)
  const [permissions, setPermissions] = useState(localParticipant.permissions)

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
    const timer = timersRef.current.get(identity)
    if (timer) clearTimeout(timer)
    timersRef.current.delete(identity)
    seenReactionIdsRef.current.delete(identity)
  }, [])

  const pruneExpired = useCallback(
    (now: number) => {
      const next = Object.fromEntries(
        Object.entries(participantsRef.current).map(([identity, state]) => {
          const ephemeralReactions = state.ephemeralReactions.filter(
            reaction => reaction.expiresAt > now,
          )
          return [identity, { ...state, ephemeralReactions }]
        }),
      )
      replaceParticipants(next)
    },
    [replaceParticipants],
  )

  // Uses one timer per participant to advance through absolute reaction expiries.
  const scheduleCleanup = useCallback(
    function scheduleParticipantCleanup(identity: string) {
      if (timersRef.current.has(identity)) return
      const seenIds = seenReactionIdsRef.current.get(identity)
      if (!seenIds?.size) return

      const nextExpiry = Math.min(...seenIds.values())
      const timer = setTimeout(
        () => {
          timersRef.current.delete(identity)
          const now = Date.now()
          const currentIds = seenReactionIdsRef.current.get(identity)
          for (const [id, expiresAt] of currentIds ?? []) {
            if (expiresAt <= now) currentIds?.delete(id)
          }
          if (currentIds?.size === 0) {
            seenReactionIdsRef.current.delete(identity)
          }
          pruneExpired(now)
          scheduleParticipantCleanup(identity)
        },
        Math.max(0, nextExpiry - Date.now()),
      )
      timersRef.current.set(identity, timer)
    },
    [pruneExpired],
  )

  // Prunes stale ids before enforcing dedupe bounds and the five-item display cap.
  const addReaction = useCallback(
    (identity: string, reaction: EphemeralReaction): boolean => {
      const now = Date.now()
      const ids =
        seenReactionIdsRef.current.get(identity) ?? new Map<string, number>()
      let removedExpiredId = false
      for (const [id, expiresAt] of ids) {
        if (expiresAt <= now) {
          ids.delete(id)
          removedExpiredId = true
        }
      }
      if (removedExpiredId) {
        const timer = timersRef.current.get(identity)
        if (timer) clearTimeout(timer)
        timersRef.current.delete(identity)
        if (ids.size === 0) {
          seenReactionIdsRef.current.delete(identity)
        } else {
          scheduleCleanup(identity)
        }
      }
      if (ids.has(reaction.id)) return false
      if (ids.size >= MAX_SEEN_REACTION_IDS_PER_PARTICIPANT) return false

      ids.set(reaction.id, reaction.expiresAt)
      seenReactionIdsRef.current.set(identity, ids)
      const current = participantsRef.current
      const existing = current[identity] ?? {
        isHandRaised: false,
        ephemeralReactions: [],
      }
      const reactions = [
        ...existing.ephemeralReactions.filter(
          existingReaction => existingReaction.expiresAt > now,
        ),
        reaction,
      ]
      const ephemeralReactions = reactions.slice(
        -MAX_LIVE_REACTIONS_PER_PARTICIPANT,
      )

      replaceParticipants({
        ...current,
        [identity]: { ...existing, ephemeralReactions },
      })
      scheduleCleanup(identity)
      return true
    },
    [replaceParticipants, scheduleCleanup],
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

      // Authoritative attributes override the legacy packet when the marker exists.
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

  // Owns the room-level participant listeners and all reaction timer cleanup.
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
    const onPermissionsChanged = (
      _previousPermissions: Participant["permissions"],
      participant: Participant,
    ) => {
      if (participant.identity === localParticipant.identity) {
        setPermissions(participant.permissions)
      }
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
    room.on(RoomEvent.ParticipantPermissionsChanged, onPermissionsChanged)
    room.on(RoomEvent.Reconnected, onReconnected)
    const timers = timersRef.current

    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, onAttributesChanged)
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected)
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
      room.off(RoomEvent.ParticipantPermissionsChanged, onPermissionsChanged)
      room.off(RoomEvent.Reconnected, onReconnected)
      for (const identity of timers.keys()) {
        clearParticipantTimers(identity)
      }
    }
  }, [
    clearParticipantTimers,
    localParticipant.identity,
    replaceParticipants,
    room,
    setHand,
  ])

  const canSendQuickReactions = permissions?.canPublishData === true
  const canUpdateHand =
    canSendQuickReactions && permissions?.canUpdateMetadata === true

  // Throttles and displays locally before publishing the compatibility packet.
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

  // Serializes optimistic hand writes; attributes commit before compatibility data.
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
  return useContext(ReactionsContext)
}
