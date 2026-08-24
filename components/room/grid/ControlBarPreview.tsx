import { StyleSheet, View } from "react-native"

import { CameraIcon, DisconnectIcon, MicIcon } from "@/components/icons"
import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"

// Dev-only, non-functional stand-in for ControlBar (components/room/ControlBar.tsx).
// The real ControlBar needs a live LiveKit Room via RoomContext, which GridPreview
// doesn't have — this just reserves the same footprint so the grid preview reflects
// the real available height.
export const ControlBarPreview = () => (
  <View
    testID="control-bar-preview"
    style={styles.controlsContainer}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
  >
    <View style={styles.controlButton}>
      <MicIcon />
    </View>

    <View style={styles.controlButton}>
      <CameraIcon />
    </View>

    <View
      testID="control-bar-preview-disconnect"
      style={[styles.controlButton, styles.disconnectButton]}
    >
      <DisconnectIcon color={TEXT_COLORS.onDanger} />
    </View>
  </View>
)

const styles = StyleSheet.create({
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: BACKGROUND_COLORS.tertiary,
  },
  controlButton: {
    backgroundColor: BACKGROUND_COLORS.secondary,
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUSES.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  disconnectButton: {
    backgroundColor: BACKGROUND_COLORS.dangerAction,
  },
})
