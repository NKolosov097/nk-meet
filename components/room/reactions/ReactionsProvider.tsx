import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react"

import {
  useDataChannel,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/react-native"
import { RoomEvent, type Participant } from "livekit-client"

import {
  decodeReactionMessage,
  hasHandRaisedAttribute,
  QUICK_REACTIONS,
  REACTION_TOPIC,
  readHandRaisedAttribute,
  type QuickReactionType,
} from "./reactions"

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
): Record<string, ParticipantReactionState> =>
  Object.fromEntries(
    [localParticipant, ...remoteParticipants].map(participant => [
      participant.identity,
      participantState(participant),
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

  const setHand = useCallback((identity: string, isHandRaised: boolean) => {
    setParticipants(current => ({
      ...current,
      [identity]: {
        isHandRaised,
        ephemeralReactions: current[identity]?.ephemeralReactions ?? [],
      },
    }))
  }, [])

  const onDataMessage = useCallback(
    ({ payload, from }: { payload: Uint8Array; from?: Participant }) => {
      if (!from) return
      const message = decodeReactionMessage(payload)
      if (!message || message.type !== "raiseHand") return

      setHand(
        from.identity,
        hasHandRaisedAttribute(from.attributes)
          ? readHandRaisedAttribute(from.attributes)
          : message.isHandRaised,
      )
    },
    [setHand],
  )

  useDataChannel(REACTION_TOPIC, onDataMessage)

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
    const onParticipantDisconnected = (participant: Participant) =>
      setParticipants(current => {
        const { [participant.identity]: _removed, ...remaining } = current
        return remaining
      })
    const onReconnected = () =>
      setParticipants(
        currentParticipants(
          room.localParticipant,
          room.remoteParticipants.values(),
        ),
      )

    room.on(RoomEvent.ParticipantAttributesChanged, onAttributesChanged)
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected)
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
    room.on(RoomEvent.Reconnected, onReconnected)

    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, onAttributesChanged)
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected)
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
      room.off(RoomEvent.Reconnected, onReconnected)
    }
  }, [room, setHand])

  const permissions = localParticipant.permissions
  const canSendQuickReactions = permissions?.canPublishData === true
  const value = useMemo<ReactionsContextValue>(
    () => ({
      participants,
      canSendQuickReactions,
      canUpdateHand:
        canSendQuickReactions && permissions?.canUpdateMetadata === true,
      isHandUpdatePending: false,
      sendQuickReaction: type => {
        if (Object.prototype.hasOwnProperty.call(QUICK_REACTIONS, type)) return
      },
      toggleHand: () => undefined,
    }),
    [canSendQuickReactions, participants, permissions?.canUpdateMetadata],
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
