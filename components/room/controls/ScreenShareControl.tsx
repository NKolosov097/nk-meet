import { useCallback, useRef, useState, type ComponentRef } from "react"
import {
  Alert,
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
  // Prepares an unpublished iOS capture track and publishes it only after ReplayKit is ready
  onStartIosScreenShare: (
    waitForBroadcastReady: () => Promise<void>,
  ) => Promise<void>
  // Whether the toggle is mid-flight and should reject taps
  disabled: boolean
}

// The manager only exists in an iOS binary that links ReplayKit, so its
// presence doubles as the capability check for the broadcast picker.
interface BroadcastPickerManager {
  // Presents ReplayKit and resolves only after the extension starts.
  present: (reactTag: number) => Promise<void>
}

const isPickerCanceled = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (("code" in error && error.code === "broadcast_cancelled") ||
    ("name" in error && error.name === "NotAllowedError") ||
    ("message" in error && error.message === "NotAllowedError"))

const isTransportFailure = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "broadcast_transport_failed"

export const ScreenShareControl = ({
  isScreenShareEnabled,
  onToggleScreenShare,
  onStartIosScreenShare,
  disabled,
}: ScreenShareControlProps) => {
  const pickerRef = useRef<BroadcastPicker>(null)
  const isPresentingPicker = useRef(false)
  const [pickerPending, setPickerPending] = useState(false)
  const controlDisabled = disabled || pickerPending
  const accessibilityState: AccessibilityState = { disabled: controlDisabled }

  // iOS publishes screen capture from a broadcast extension, which the user has
  // to start from the system picker before the track can be published.
  const handlePress = useCallback(async (): Promise<void> => {
    if (isPresentingPicker.current) return

    if (isScreenShareEnabled || Platform.OS !== "ios") {
      onToggleScreenShare()
      return
    }

    isPresentingPicker.current = true
    setPickerPending(true)
    try {
      const broadcastPickerManager = NativeModules.BroadcastPicker as
        BroadcastPickerManager | undefined
      const pickerTag = findNodeHandle(pickerRef.current)

      if (!broadcastPickerManager || pickerTag === null) {
        throw new Error("iOS broadcast picker is not linked")
      }

      await onStartIosScreenShare(() =>
        broadcastPickerManager.present(pickerTag),
      )
    } catch (error) {
      if (isPickerCanceled(error)) return

      console.error("Error opening the broadcast picker: ", error)
      Alert.alert(
        "Screen sharing unavailable",
        isTransportFailure(error)
          ? "Could not start the iOS screen-sharing transport."
          : "Could not open the iOS broadcast picker.",
      )
    } finally {
      isPresentingPicker.current = false
      setPickerPending(false)
    }
  }, [isScreenShareEnabled, onStartIosScreenShare, onToggleScreenShare])

  return (
    <>
      <TouchableOpacity
        style={[
          styles.controlButton,
          isScreenShareEnabled ? styles.activeButton : null,
          controlDisabled ? styles.disabledButton : null,
        ]}
        onPress={handlePress}
        disabled={controlDisabled}
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
