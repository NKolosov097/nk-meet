import React, { useCallback, useEffect, useState } from "react"
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"

import { useRoomContext } from "@livekit/react-native"
import { Track } from "livekit-client"

import { MicDisabledIcon, MicIcon } from "@/components/icons"
import { MediaDeviceButton } from "@/components/room/controls/MediaDeviceButton"
import {
  initializeActiveMediaDevice,
  subscribeToMediaDevicesChanged,
  useActiveMediaDevice,
} from "@/components/room/controls/useActiveMediaDevice"
import { useBoundedDeviceDropdownLayout } from "@/components/room/controls/useBoundedDeviceDropdownLayout"
import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import {
  BACKGROUND_COLORS,
  TEXT_COLORS,
  SHADOW_COLORS,
} from "@/constants/colors"

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
          <View style={[styles.dropdownContainer, dropdownPositionStyle]}>
            <ScrollView style={styles.deviceList}>
              {hasInputAndOutput ? (
                <>
                  {/* Output devices section */}
                  <Text style={styles.sectionTitle}>Select speakers</Text>
                  {outputDevices.map(device => (
                    <TouchableOpacity
                      key={device.deviceId}
                      style={[
                        styles.deviceItem,
                        selectedOutputDevice === device.deviceId
                          ? styles.selectedDevice
                          : undefined,
                      ]}
                      onPress={() =>
                        handleDeviceSelect(device.deviceId, "audiooutput")
                      }
                    >
                      <Text style={styles.deviceLabel}>{device.label}</Text>
                    </TouchableOpacity>
                  ))}

                  {/* Input devices section */}
                  <Text
                    style={[styles.sectionTitle, styles.sectionTitleSecond]}
                  >
                    Select microphone
                  </Text>
                  {inputDevices.map(device => (
                    <TouchableOpacity
                      key={device.deviceId}
                      style={[
                        styles.deviceItem,
                        selectedInputDevice === device.deviceId
                          ? styles.selectedDevice
                          : undefined,
                      ]}
                      onPress={() =>
                        handleDeviceSelect(device.deviceId, "audioinput")
                      }
                    >
                      <Text style={styles.deviceLabel}>{device.label}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              ) : (
                <>
                  {/* Combined list of all audio devices */}
                  <Text style={styles.sectionTitle}>Select microphone</Text>
                  {audioDevices.map(device => (
                    <TouchableOpacity
                      key={device.deviceId}
                      style={[
                        styles.deviceItem,
                        (device.kind === "audioinput" &&
                          selectedInputDevice === device.deviceId) ||
                        (device.kind === "audiooutput" &&
                          selectedOutputDevice === device.deviceId)
                          ? styles.selectedDevice
                          : undefined,
                      ]}
                      onPress={() =>
                        handleDeviceSelect(device.deviceId, device.kind)
                      }
                    >
                      <Text style={styles.deviceLabel}>
                        {device.label} (
                        {device.kind === "audioinput" ? "Input" : "Output"})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {audioDevices.length === 0 && (
                <Text style={styles.noDevicesText}>No audio devices found</Text>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Overlay to close the list on a click outside its area */}
      {isDropdownVisible && (
        <Pressable
          style={[styles.overlay, overlayStyle]}
          onPress={handleOutsidePress}
          accessibilityLabel="Close device list"
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
  dropdownContainer: {
    position: "absolute",
    bottom: 49,
    backgroundColor: BACKGROUND_COLORS.secondary,
    borderRadius: BORDER_RADIUSES.large,
    maxHeight: 400,
    shadowColor: SHADOW_COLORS.black,
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1001,
  },
  deviceList: {
    maxHeight: 350,
    borderRadius: BORDER_RADIUSES.large,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLORS.light,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BACKGROUND_COLORS.lightBackground,
  },
  sectionTitleSecond: {
    marginTop: 0,
  },
  deviceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BACKGROUND_COLORS.lightBackground,
  },
  overlay: {
    position: "absolute",
    backgroundColor: BACKGROUND_COLORS.transparent,
    zIndex: 999,
  },
  selectedDevice: {
    backgroundColor: BACKGROUND_COLORS.primary,
  },
  deviceLabel: {
    fontSize: 14,
    color: TEXT_COLORS.light,
    flex: 1,
  },
  noDevicesText: {
    fontSize: 14,
    color: TEXT_COLORS.light,
    textAlign: "center",
    paddingVertical: 20,
    fontStyle: "italic",
  },
})
