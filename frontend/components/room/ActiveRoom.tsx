import { StyleSheet } from "react-native"

import { StatusBar } from "expo-status-bar"

import { SafeAreaView } from "react-native-safe-area-context"

import { BACKGROUND_COLORS } from "@/constants/colors"

import { ControlBar } from "./ControlBar"
import { HostCodeNotice } from "./HostCodeNotice"
import { MeetingInfoBanner } from "./MeetingInfoBanner"
import { ReactionsProvider } from "./reactions/ReactionsProvider"
import { useRegisterActiveRoomDisconnect } from "./useRegisterActiveRoomDisconnect"
import { useSharedMeetingStartedAt } from "./useSharedMeetingStartedAt"
import { VideoConference } from "./VideoConference"

import type { MeetingEntry } from "@/services/livekitToken"

interface ActiveRoomProps {
  // Company of the room this call belongs to, published to the active-room registry
  company: string
  // Slug of the room this call belongs to, published to the active-room registry
  roomSlug: string
  // Called when the app (not the user) ends this call for an incoming room link
  onForcedDisconnect: VoidFunction
  // Authorized entry retained only while this room is mounted
  entry?: MeetingEntry
}

export const ActiveRoom = ({
  company,
  roomSlug,
  onForcedDisconnect,
  entry,
}: ActiveRoomProps) => {
  useRegisterActiveRoomDisconnect(company, roomSlug, onForcedDisconnect)
  const startedAt = useSharedMeetingStartedAt()

  return (
    <SafeAreaView testID="active-room" style={styles.roomContainer}>
      <MeetingInfoBanner roomSlug={roomSlug} startedAt={startedAt} />
      {entry?.role === "host" && entry.hostAccess && (
        <HostCodeNotice company={company} slug={roomSlug} entry={entry} />
      )}
      <ReactionsProvider>
        <VideoConference />
        <ControlBar company={company} />
      </ReactionsProvider>
      <StatusBar style="light" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  roomContainer: {
    flex: 1,
    backgroundColor: BACKGROUND_COLORS.black,
  },
})
