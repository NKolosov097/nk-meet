import React, { useCallback, useEffect, useState } from "react"
import { Alert, Pressable, StyleSheet, View } from "react-native"

import { useRoomContext } from "@livekit/react-native"
import { Track } from "livekit-client"

import { MicDisabledIcon, MicIcon } from "@/components/icons"
import {
  DeviceDropdown,
  type DeviceDropdownSection,
} from "@/components/room/controls/DeviceDropdown"
import { MediaDeviceButton } from "@/components/room/controls/MediaDeviceButton"
import {
  initializeActiveMediaDevice,
  subscribeToMediaDevicesChanged,
  useActiveMediaDevice,
} from "@/components/room/controls/useActiveMediaDevice"
import { useBoundedDeviceDropdownLayout } from "@/components/room/controls/useBoundedDeviceDropdownLayout"
import { BACKGROUND_COLORS } from "@/constants/colors"

interface AudioDevice {
  // Browser-assigned identifier for this device
  deviceId: string
  // Human-readable device name shown in the dropdown
  label: string
  // Whether this is a microphone input or a speaker output
  kind: "audioinput" | "audiooutput"
}

interface MicrophoneControlProps {
  // Whether the local microphone is currently muted
  isMuted: boolean
  // Toggles the local microphone mute state
  onToggleMute: VoidFunction
  // Whether the mute toggle is mid-flight and should reject taps
  disabled: boolean
  // Whether the microphone device dropdown is currently open
  isDropdownVisible: boolean
  // Opens/closes the microphone device dropdown
  onToggleDropdown: VoidFunction
  // Closes the microphone device dropdown
  onCloseDropdown: VoidFunction
  // Optional label displayed between the state icon and dropdown
  text?: string
}

export const MicrophoneControl = ({
  isMuted,
  onToggleMute,
  disabled,
  isDropdownVisible,
  onToggleDropdown,
  onCloseDropdown,
  text,
}: MicrophoneControlProps) => {
  const room = useRoomContext()
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([])
  const selectedInputDevice = useActiveMediaDevice(
    room,
    Track.Source.Microphone,
  )
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>("")
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

  // Get the list of audio devices
  const loadAudioDevices = useCallback(async () => {
    try {
      if (navigator?.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const deviceList = devices
          .filter(
            device =>
              device.kind === "audioinput" || device.kind === "audiooutput",
          )
          .map(device => ({
            deviceId: device.deviceId,
            label:
              device.label ||
              `${device.kind === "audioinput" ? "Microphone" : "Speaker"} ${device.deviceId.slice(0, 8)}`,
            kind: device.kind as "audioinput" | "audiooutput",
          }))

        setAudioDevices(deviceList)
        await initializeActiveMediaDevice(
          room,
          Track.Source.Microphone,
          deviceList.filter(device => device.kind === "audioinput"),
        )
      }
    } catch (error) {
      console.error("Error loading audio devices: ", error)
    }
  }, [room])

  useEffect(() => {
    loadAudioDevices()

    return subscribeToMediaDevicesChanged(room, loadAudioDevices)
  }, [room, loadAudioDevices])

  const handleDeviceSelect = useCallback(
    async (deviceId: string, kind: "audioinput" | "audiooutput") => {
      try {
        if (!room) return

        if (kind === "audioinput") {
          // Switch the microphone
          await room.switchActiveDevice("audioinput", deviceId)
        } else {
          // Switch the speakers
          await room.switchActiveDevice("audiooutput", deviceId)
          setSelectedOutputDevice(deviceId)
        }

        onCloseDropdown()
      } catch (error) {
        console.error("Error switching audio device: ", error)
        Alert.alert("Error", "Failed to switch audio device")
      }
    },
    [room, onCloseDropdown],
  )

  const inputDevices = audioDevices.filter(
    device => device.kind === "audioinput",
  )
  const outputDevices = audioDevices.filter(
    device => device.kind === "audiooutput",
  )
  const hasInputAndOutput = inputDevices.length > 0 && outputDevices.length > 0
  const dropdownSections: DeviceDropdownSection[] = hasInputAndOutput
    ? [
        {
          title: "Select speakers",
          items: outputDevices.map(device => ({
            deviceId: device.deviceId,
            label: device.label,
            selected: selectedOutputDevice === device.deviceId,
            onPress: () => handleDeviceSelect(device.deviceId, device.kind),
          })),
        },
        {
          title: "Select microphone",
          items: inputDevices.map(device => ({
            deviceId: device.deviceId,
            label: device.label,
            selected: selectedInputDevice === device.deviceId,
            onPress: () => handleDeviceSelect(device.deviceId, device.kind),
          })),
        },
      ]
    : [
        {
          title: "Select microphone",
          items: audioDevices.map(device => ({
            deviceId: device.deviceId,
            label: `${device.label} (${device.kind === "audioinput" ? "Input" : "Output"})`,
            selected:
              (device.kind === "audioinput" &&
                selectedInputDevice === device.deviceId) ||
              (device.kind === "audiooutput" &&
                selectedOutputDevice === device.deviceId),
            onPress: () => handleDeviceSelect(device.deviceId, device.kind),
          })),
        },
      ]

  return (
    <>
      <View
        ref={containerRef}
        style={styles.container}
        onLayout={onContainerLayout}
      >
        <MediaDeviceButton
          icon={isMuted ? <MicDisabledIcon /> : <MicIcon />}
          text={text}
          onToggle={onToggleMute}
          onToggleDropdown={onToggleDropdown}
          toggleAccessibilityLabel={
            isMuted ? "Unmute microphone" : "Mute microphone"
          }
          dropdownAccessibilityLabel="Select audio device"
          disabled={disabled}
          isDropdownVisible={isDropdownVisible}
        />

        {/* Device dropdown list */}
        {isDropdownVisible && (
          <DeviceDropdown
            sections={dropdownSections}
            emptyMessage="No audio devices found"
            positionStyle={dropdownPositionStyle}
          />
        )}
      </View>

      {/* Overlay to close the list on a click outside its area */}
      {isDropdownVisible && (
        <Pressable
          style={[styles.overlay, overlayStyle]}
          onPress={handleOutsidePress}
          accessibilityLabel="Close device list"
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
    zIndex: 1000,
  },
  overlay: {
    position: "absolute",
    backgroundColor: BACKGROUND_COLORS.transparent,
    zIndex: 999,
  },
})
