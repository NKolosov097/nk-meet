import { useCallback, useRef, type ComponentRef } from "react"
import {
  findNodeHandle,
  NativeModules,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  type AccessibilityState,
} from "react-native"

import { ScreenCapturePickerView } from "@livekit/react-native-webrtc"

import { ScreenShareIcon, ScreenShareStopIcon } from "@/components/icons"
import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"

type BroadcastPicker = ComponentRef<typeof ScreenCapturePickerView>

interface ScreenShareControlProps {
  // Whether the local participant is currently publishing a screen-share track
  isScreenShareEnabled: boolean
  // Starts or stops the local screen share
  onToggleScreenShare: VoidFunction
  // Whether the toggle is mid-flight and should reject taps
  disabled: boolean
}

// The manager only exists in an iOS binary that links ReplayKit, so its
// presence doubles as the capability check for the broadcast picker.
const broadcastPickerManager = NativeModules.ScreenCapturePickerViewManager as
  { show: (reactTag: number) => Promise<void> } | undefined

export const ScreenShareControl = ({
  isScreenShareEnabled,
  onToggleScreenShare,
  disabled,
}: ScreenShareControlProps) => {
  const pickerRef = useRef<BroadcastPicker>(null)
  const accessibilityState: AccessibilityState = { disabled }

  // iOS publishes screen capture from a broadcast extension, which the user has
  // to start from the system picker before the track can be published.
  const presentBroadcastPicker = useCallback(async (): Promise<void> => {
    if (!broadcastPickerManager) return

    try {
      const pickerTag = findNodeHandle(pickerRef.current)

      if (pickerTag !== null) {
        await broadcastPickerManager.show(pickerTag)
      }
    } catch (error) {
      console.error("Error opening the broadcast picker: ", error)
    }
  }, [])

  const handlePress = useCallback(async (): Promise<void> => {
    if (!isScreenShareEnabled) {
      await presentBroadcastPicker()
    }

    onToggleScreenShare()
  }, [isScreenShareEnabled, onToggleScreenShare, presentBroadcastPicker])

  return (
    <>
      <TouchableOpacity
        style={[
          styles.controlButton,
          isScreenShareEnabled ? styles.activeButton : null,
          disabled ? styles.disabledButton : null,
        ]}
        onPress={handlePress}
        disabled={disabled}
        accessibilityLabel={
          isScreenShareEnabled
            ? "Stop sharing your screen"
            : "Share your screen"
        }
        accessibilityRole="button"
        accessibilityState={accessibilityState}
      >
        {isScreenShareEnabled ? (
          <ScreenShareStopIcon color={TEXT_COLORS.onPrimary} />
        ) : (
          <ScreenShareIcon />
        )}
      </TouchableOpacity>

      {/* Off-screen host for the ReplayKit picker; iOS-only and never visible */}
      {Platform.OS === "ios" && (
        <View
          style={styles.hiddenPicker}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <ScreenCapturePickerView ref={pickerRef} />
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  controlButton: {
    backgroundColor: BACKGROUND_COLORS.secondary,
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUSES.medium,
    justifyContent: "center",
    alignItems: "center",
  },
  activeButton: {
    backgroundColor: BACKGROUND_COLORS.primary,
  },
  disabledButton: {
    opacity: 0.4,
  },
  hiddenPicker: {
    width: 0,
    height: 0,
    overflow: "hidden",
  },
})
