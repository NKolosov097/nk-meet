import { StyleSheet } from "react-native"

import { StatusBar } from "expo-status-bar"

import { SafeAreaView } from "react-native-safe-area-context"

import { BACKGROUND_COLORS } from "@/constants/colors"

import { ControlBar } from "./ControlBar"
import { MeetingInfoBanner } from "./MeetingInfoBanner"
import { useRegisterActiveRoomDisconnect } from "./useRegisterActiveRoomDisconnect"
import { useSharedMeetingStartedAt } from "./useSharedMeetingStartedAt"
import { VideoConference } from "./VideoConference"

interface ActiveRoomProps {
  // Company of the room this call belongs to, published to the active-room registry
  company: string
  // Slug of the room this call belongs to, published to the active-room registry
  roomSlug: string
  // Called when the app (not the user) ends this call for an incoming room link
  onForcedDisconnect: VoidFunction
}

export const ActiveRoom = ({
  company,
  roomSlug,
  onForcedDisconnect,
}: ActiveRoomProps) => {
  useRegisterActiveRoomDisconnect(company, roomSlug, onForcedDisconnect)
  const startedAt = useSharedMeetingStartedAt()

  return (
    <SafeAreaView testID="active-room" style={styles.roomContainer}>
      <MeetingInfoBanner roomSlug={roomSlug} startedAt={startedAt} />
      <VideoConference />
      <ControlBar company={company} />
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
