import { StyleSheet } from "react-native"

import { StatusBar } from "expo-status-bar"

import { SafeAreaView } from "react-native-safe-area-context"

import { BACKGROUND_COLORS } from "@/constants/colors"

import { ControlBar } from "./ControlBar"
import { useRegisterActiveRoomDisconnect } from "./useRegisterActiveRoomDisconnect"
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

  return (
    <SafeAreaView style={styles.roomContainer}>
      <VideoConference />
      <ControlBar />
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
