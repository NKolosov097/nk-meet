import React, { useCallback, useEffect, useState } from "react"
import { Alert, Pressable, StyleSheet, View } from "react-native"

import { useRoomContext } from "@livekit/react-native"
import { Track } from "livekit-client"

import { CameraDisabledIcon, CameraIcon } from "@/components/icons"
import { DeviceDropdown } from "@/components/room/controls/DeviceDropdown"
import { MediaDeviceButton } from "@/components/room/controls/MediaDeviceButton"
import {
  initializeActiveMediaDevice,
  subscribeToMediaDevicesChanged,
  useActiveMediaDevice,
} from "@/components/room/controls/useActiveMediaDevice"
import { useBoundedDeviceDropdownLayout } from "@/components/room/controls/useBoundedDeviceDropdownLayout"
import { BACKGROUND_COLORS } from "@/constants/colors"

interface VideoDevice {
  // Browser-assigned identifier for this device
  deviceId: string
  // Human-readable device name shown in the dropdown
  label: string
  // Always "videoinput" — narrows this to a camera device
  kind: "videoinput"
}

interface CameraControlProps {
  // Whether the local camera is currently enabled
  isVideoEnabled: boolean
  // Toggles the local camera on/off
  onToggleVideo: VoidFunction
  // Whether the video toggle is mid-flight and should reject taps
  disabled: boolean
  // Whether the camera device dropdown is currently open
  isDropdownVisible: boolean
  // Opens/closes the camera device dropdown
  onToggleDropdown: VoidFunction
  // Closes the camera device dropdown
  onCloseDropdown: VoidFunction
  // Optional label displayed between the state icon and dropdown
  text?: string
}

export const CameraControl = ({
  isVideoEnabled,
  onToggleVideo,
  disabled,
  isDropdownVisible,
  onToggleDropdown,
  onCloseDropdown,
  text,
}: CameraControlProps) => {
  const room = useRoomContext()
  const [videoDevices, setVideoDevices] = useState<VideoDevice[]>([])
  const selectedVideoDevice = useActiveMediaDevice(room, Track.Source.Camera)
  const {
    containerRef,
    onContainerLayout,
    dropdownPositionStyle,
    overlayStyle,
  } = useBoundedDeviceDropdownLayout(isDropdownVisible)

  // Close the dropdown list on a click outside its area
  const handleOutsidePress = useCallback(() => {
    onCloseDropdown()
  }, [onCloseDropdown])

  // Get the list of video devices
  const loadVideoDevices = useCallback(async () => {
    try {
      if (navigator?.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const deviceList = devices
          .filter(device => device.kind === "videoinput")
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
            kind: device.kind as "videoinput",
          }))

        setVideoDevices(deviceList)
        await initializeActiveMediaDevice(room, Track.Source.Camera, deviceList)
      }
    } catch (error) {
      console.error("Error loading video devices: ", error)
    }
  }, [room])

  useEffect(() => {
    loadVideoDevices()

    return subscribeToMediaDevicesChanged(room, loadVideoDevices)
  }, [room, loadVideoDevices])

  const handleDeviceSelect = useCallback(
    async (deviceId: string) => {
      try {
        if (!room) return

        // Switch the camera
        await room.switchActiveDevice("videoinput", deviceId)
        onCloseDropdown()
      } catch (error) {
        console.error("Error switching camera: ", error)
        Alert.alert("Error", "Failed to switch camera")
      }
    },
    [room, onCloseDropdown],
  )

  return (
    <>
      <View
        ref={containerRef}
        style={styles.container}
        onLayout={onContainerLayout}
      >
        <MediaDeviceButton
          icon={isVideoEnabled ? <CameraIcon /> : <CameraDisabledIcon />}
          text={text}
          onToggle={onToggleVideo}
          onToggleDropdown={onToggleDropdown}
          toggleAccessibilityLabel={
            isVideoEnabled ? "Turn off camera" : "Turn on camera"
          }
          dropdownAccessibilityLabel="Select camera"
          disabled={disabled}
          isDropdownVisible={isDropdownVisible}
        />

        {/* Camera dropdown list */}
        {isDropdownVisible && (
          <DeviceDropdown
            sections={[
              {
                title: "Select camera",
                items: videoDevices.map(device => ({
                  deviceId: device.deviceId,
                  label: device.label,
                  selected: selectedVideoDevice === device.deviceId,
                  onPress: () => handleDeviceSelect(device.deviceId),
                })),
              },
            ]}
            emptyMessage="No cameras found"
            positionStyle={dropdownPositionStyle}
          />
        )}
      </View>

      {/* Overlay to close the list on a click outside its area */}
      {isDropdownVisible && (
        <Pressable
          style={[styles.overlay, overlayStyle]}
          onPress={handleOutsidePress}
          accessibilityLabel="Close camera list"
          accessibilityRole="button"
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    zIndex: 999,
  },
  overlay: {
    position: "absolute",
    backgroundColor: BACKGROUND_COLORS.transparent,
    zIndex: 998,
  },
})
