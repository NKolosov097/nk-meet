import { useCallback, useRef, useState } from "react"
import { Alert, StyleSheet, TouchableOpacity, View } from "react-native"

import { useLocalParticipant, useRoomContext } from "@livekit/react-native"
import { Track } from "livekit-client"

import { DisconnectIcon } from "@/components/icons"
import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"

import { CompanyIcon } from "./CompanyIcon"
import { ConfirmDisconnectModal } from "./ConfirmDisconnectModal"
import { CameraControl } from "./controls/CameraControl"
import { MicrophoneControl } from "./controls/MicrophoneControl"

type DeviceDropdownSource = Track.Source.Camera | Track.Source.Microphone

interface ControlBarProps {
  // Canonical company id whose icon is shown alongside the room controls
  company: string
}

export const ControlBar = ({ company }: ControlBarProps) => {
  const room = useRoomContext()
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } =
    useLocalParticipant()
  const isTogglingMicrophone = useRef<boolean>(false)
  const [isMicrophoneToggling, setIsMicrophoneToggling] = useState(false)
  const isTogglingCamera = useRef<boolean>(false)
  const [isCameraToggling, setIsCameraToggling] = useState(false)
  const [openDeviceDropdown, setOpenDeviceDropdown] =
    useState<DeviceDropdownSource | null>(null)
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState(false)

  const toggleDeviceDropdown = useCallback(
    (source: DeviceDropdownSource): void => {
      setOpenDeviceDropdown(current => (current === source ? null : source))
    },
    [],
  )

  const toggleMute = useCallback(async (): Promise<void> => {
    if (isTogglingMicrophone.current) return

    isTogglingMicrophone.current = true
    setIsMicrophoneToggling(true)

    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
    } catch (error) {
      console.error("Error toggling microphone: ", error)
      Alert.alert("Error", "Failed to toggle microphone")
    } finally {
      isTogglingMicrophone.current = false
      setIsMicrophoneToggling(false)
    }
  }, [localParticipant, isMicrophoneEnabled])

  const toggleVideo = useCallback(async (): Promise<void> => {
    if (isTogglingCamera.current) return

    isTogglingCamera.current = true
    setIsCameraToggling(true)

    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled)
    } catch (error) {
      console.error("Error toggling camera: ", error)
      Alert.alert("Error", "Failed to toggle camera")
    } finally {
      isTogglingCamera.current = false
      setIsCameraToggling(false)
    }
  }, [localParticipant, isCameraEnabled])

  const requestDisconnect = useCallback((): void => {
    setIsConfirmingDisconnect(true)
  }, [])

  const cancelDisconnect = useCallback((): void => {
    setIsConfirmingDisconnect(false)
  }, [])

  const disconnect = useCallback(async (): Promise<void> => {
    if (!room) return

    try {
      await room.disconnect()
    } catch (error) {
      console.error("Error disconnecting: ", error)
    } finally {
      setIsConfirmingDisconnect(false)
    }
  }, [room])

  return (
    <>
      <View style={styles.controlsContainer} testID="control-bar-row">
        {/* Company icon identifying which company/tenant this room belongs to */}
        <CompanyIcon company={company} />

        {/* Microphone control component with a dropdown list */}
        <MicrophoneControl
          isMuted={!isMicrophoneEnabled}
          onToggleMute={toggleMute}
          disabled={isMicrophoneToggling}
          isDropdownVisible={openDeviceDropdown === Track.Source.Microphone}
          onToggleDropdown={() => toggleDeviceDropdown(Track.Source.Microphone)}
          onCloseDropdown={() => setOpenDeviceDropdown(null)}
        />

        {/* Camera control component with a dropdown list */}
        <CameraControl
          isVideoEnabled={isCameraEnabled}
          onToggleVideo={toggleVideo}
          disabled={isCameraToggling}
          isDropdownVisible={openDeviceDropdown === Track.Source.Camera}
          onToggleDropdown={() => toggleDeviceDropdown(Track.Source.Camera)}
          onCloseDropdown={() => setOpenDeviceDropdown(null)}
        />

        {/* Disconnect button */}
        <TouchableOpacity
          style={[styles.controlButton, styles.disconnectButton]}
          onPress={requestDisconnect}
          accessibilityLabel="Disconnect from room"
          accessibilityRole="button"
        >
          <DisconnectIcon color={TEXT_COLORS.onDanger} />
        </TouchableOpacity>
      </View>

      <ConfirmDisconnectModal
        visible={isConfirmingDisconnect}
        onConfirm={disconnect}
        onCancel={cancelDisconnect}
      />
    </>
  )
}

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
    borderRadius: BORDER_RADIUSES.medium,
    justifyContent: "center",
    alignItems: "center",
  },
  disconnectButton: {
    backgroundColor: BACKGROUND_COLORS.dangerAction,
  },
})
