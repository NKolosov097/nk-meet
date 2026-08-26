import { useCallback, useEffect, useState } from "react"

import { useRoomContext } from "@livekit/react-native"
import { RoomEvent, type Participant } from "livekit-client"

export const MEETING_STARTED_AT_ATTRIBUTE = "nk-meet.meeting-started-at"

const participantStartedAt = (participant: Participant): number | undefined => {
  const value = Number(participant.attributes[MEETING_STARTED_AT_ATTRIBUTE])
  return Number.isFinite(value) && value > 0 ? value : undefined
}

const earliestStartedAt = (participants: Participant[]): number | undefined => {
  const timestamps = participants
    .map(participantStartedAt)
    .filter((value): value is number => value !== undefined)

  return timestamps.length > 0 ? Math.min(...timestamps) : undefined
}

export const useSharedMeetingStartedAt = (): number => {
  // Client clocks make this a best-effort baseline until the backend supplies server time.
  const room = useRoomContext()
  const [startedAt, setStartedAt] = useState<number>(() => {
    const participants = [
      room.localParticipant,
      ...room.remoteParticipants.values(),
    ]
    return earliestStartedAt(participants) ?? Date.now()
  })

  const synchronizeStartedAt = useCallback((): void => {
    const participants = [
      room.localParticipant,
      ...room.remoteParticipants.values(),
    ]
    const canonicalStartedAt = Math.min(
      startedAt,
      earliestStartedAt(participants) ?? startedAt,
    )

    setStartedAt(canonicalStartedAt)

    if (participantStartedAt(room.localParticipant) === canonicalStartedAt) {
      return
    }

    const publishStartedAt = async (): Promise<void> => {
      try {
        await room.localParticipant.setAttributes({
          [MEETING_STARTED_AT_ATTRIBUTE]: String(canonicalStartedAt),
        })
      } catch (error) {
        console.error("Failed to synchronize meeting start time: ", error)
      }
    }

    publishStartedAt()
  }, [room, startedAt])

  useEffect(() => {
    synchronizeStartedAt()
    room.on(RoomEvent.ParticipantAttributesChanged, synchronizeStartedAt)
    room.on(RoomEvent.ParticipantConnected, synchronizeStartedAt)

    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, synchronizeStartedAt)
      room.off(RoomEvent.ParticipantConnected, synchronizeStartedAt)
    }
  }, [room, synchronizeStartedAt])

  return startedAt
}
