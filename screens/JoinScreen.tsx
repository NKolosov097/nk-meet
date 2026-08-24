import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native"

import { StatusBar } from "expo-status-bar"

import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import { createLocalVideoTrack, type LocalVideoTrack } from "livekit-client"

import {
  CameraDisabledIcon,
  CameraIcon,
  ChevronLeftIcon,
  MicDisabledIcon,
  MicIcon,
} from "@/components/icons"
import { ParticipantTile } from "@/components/participant/ParticipantTile"
import { DeviceDropdown } from "@/components/room/controls/DeviceDropdown"
import { MediaDeviceButton } from "@/components/room/controls/MediaDeviceButton"
import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import {
  BACKGROUND_COLORS,
  BORDER_COLORS,
  TEXT_COLORS,
} from "@/constants/colors"
import { configError } from "@/constants/env"
import { fetchParticipantToken } from "@/services/livekitToken"
import { getRecentRoom, saveRecentRoom } from "@/services/recentRooms"
import { roomSlug as roomName } from "@/services/roomSlug"

import type { PreJoinMediaSettings } from "@/types"

interface InputDevice {
  // Browser-assigned identifier for the input device
  deviceId: string
  // Human-readable name displayed to the participant
  label: string
  // Input category used to separate microphones from cameras
  kind: "audioinput" | "videoinput"
}

interface JoinScreenProps {
  // Canonical company of the room being joined
  company: string
  // Slug of the room being joined, shown to the participant
  roomSlug: string
  // Message from the most recent failed join/connection attempt, if any
  error?: string
  // Called with the acquired token once the user successfully joins
  onJoined: (token: string, media: PreJoinMediaSettings) => void
  // Returns to room selection without joining
  onBack: VoidFunction
}

// Login screen: the participant enters a name, the token is requested for them
export const JoinScreen = ({
  company,
  roomSlug,
  error,
  onJoined,
  onBack,
}: JoinScreenProps) => {
  const insets = useSafeAreaInsets()
  const { width: viewportWidth } = useWindowDimensions()
  const [name, setName] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [hasStartedJoin, setHasStartedJoin] = useState<boolean>(false)
  const isJoiningRef = useRef<boolean>(false)
  const previewTrackRef = useRef<LocalVideoTrack | null>(null)
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [microphones, setMicrophones] = useState<InputDevice[]>([])
  const [cameras, setCameras] = useState<InputDevice[]>([])
  const [microphoneDeviceId, setMicrophoneDeviceId] = useState<string>()
  const [cameraDeviceId, setCameraDeviceId] = useState<string>()
  const [openDropdown, setOpenDropdown] = useState<"microphone" | "camera">()
  const [previewTrack, setPreviewTrack] = useState<LocalVideoTrack | null>(null)
  const [devicesLoaded, setDevicesLoaded] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [initializationComplete, setInitializationComplete] = useState(false)

  const stopPreview = useCallback((): void => {
    previewTrackRef.current?.stop()
    previewTrackRef.current = null
    setPreviewTrack(null)
  }, [])

  useEffect(() => {
    if (!devicesLoaded || !settingsLoaded) return

    setMicrophoneDeviceId(current =>
      current && microphones.some(device => device.deviceId === current)
        ? current
        : microphones[0]?.deviceId,
    )
    setCameraDeviceId(current =>
      current && cameras.some(device => device.deviceId === current)
        ? current
        : cameras[0]?.deviceId,
    )
    setInitializationComplete(true)
  }, [devicesLoaded, settingsLoaded, microphones, cameras])

  useEffect(() => {
    let active = true

    const loadDevices = async (): Promise<void> => {
      try {
        const devices = await navigator.mediaDevices?.enumerateDevices?.()
        if (!active || !devices) return
        const inputDevices = devices.filter(
          device =>
            device.kind === "audioinput" || device.kind === "videoinput",
        ) as InputDevice[]
        const nextMicrophones = inputDevices.filter(
          device => device.kind === "audioinput",
        )
        const nextCameras = inputDevices.filter(
          device => device.kind === "videoinput",
        )
        setMicrophones(nextMicrophones)
        setCameras(nextCameras)
        setMicrophoneDeviceId(
          current => current ?? nextMicrophones[0]?.deviceId,
        )
        setCameraDeviceId(current => current ?? nextCameras[0]?.deviceId)
      } catch (cause) {
        console.error("Error loading pre-join media devices: ", cause)
      } finally {
        if (active) setDevicesLoaded(true)
      }
    }

    loadDevices()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const startPreview = async (): Promise<void> => {
      stopPreview()
      if (
        !cameraEnabled ||
        !initializationComplete ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        return
      }

      try {
        const track = await createLocalVideoTrack(
          cameraDeviceId ? { deviceId: cameraDeviceId } : undefined,
        )
        if (!active) {
          track.stop()
          return
        }
        previewTrackRef.current = track
        setPreviewTrack(track)
      } catch (cause) {
        console.error("Error starting camera preview: ", cause)
        setCameraEnabled(false)
      }
    }

    startPreview()
    return () => {
      active = false
      stopPreview()
    }
  }, [cameraEnabled, cameraDeviceId, initializationComplete, stopPreview])

  useEffect(() => {
    let active = true

    const loadRecentName = async (): Promise<void> => {
      try {
        const recentRoom = await getRecentRoom(company, roomSlug)

        if (active && recentRoom) {
          setName(recentRoom.participantName)
          if (recentRoom.media) {
            setMicrophoneEnabled(recentRoom.media.microphoneEnabled)
            setCameraEnabled(recentRoom.media.cameraEnabled)
            setMicrophoneDeviceId(recentRoom.media.microphoneDeviceId)
            setCameraDeviceId(recentRoom.media.cameraDeviceId)
          }
        }
      } catch (cause) {
        console.error("Error loading the recent participant name: ", cause)
      } finally {
        if (active) setSettingsLoaded(true)
      }
    }

    loadRecentName()
    return () => {
      active = false
    }
  }, [company, roomSlug])

  const join = useCallback(async (): Promise<void> => {
    if (
      isJoiningRef.current ||
      !initializationComplete ||
      configError !== null
    ) {
      return
    }

    const participantName = name.trim()

    if (!participantName) return

    isJoiningRef.current = true
    setHasStartedJoin(true)
    setIsLoading(true)
    setTokenError(null)

    try {
      const token = await fetchParticipantToken(
        participantName,
        roomName(company, roomSlug),
      )
      stopPreview()
      const media = {
        microphoneEnabled,
        cameraEnabled,
        microphoneDeviceId,
        cameraDeviceId,
      }
      onJoined(token, media)
      await saveRecentRoom(company, roomSlug, participantName, media)
    } catch (cause) {
      console.error("Failed to get an access token: ", cause)
      setTokenError(
        cause instanceof Error
          ? cause.message
          : "Failed to get an access token",
      )
    } finally {
      setIsLoading(false)
      isJoiningRef.current = false
    }
  }, [
    name,
    company,
    roomSlug,
    onJoined,
    stopPreview,
    microphoneEnabled,
    cameraEnabled,
    microphoneDeviceId,
    cameraDeviceId,
    initializationComplete,
  ])

  const message =
    configError ?? tokenError ?? (hasStartedJoin ? undefined : error)
  const areMediaControlsDisabled =
    isLoading || !initializationComplete || configError !== null
  const isJoinDisabled = areMediaControlsDisabled || name.trim() === ""

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={[
          styles.backButton,
          { top: insets.top + 20, left: insets.left + 20 },
        ]}
        onPress={onBack}
        hitSlop={10}
        accessibilityLabel="Back to room selection"
        accessibilityRole="button"
      >
        <ChevronLeftIcon />
      </TouchableOpacity>

      <View
        testID="join-screen-header"
        pointerEvents="none"
        style={[styles.header, { top: insets.top + 20 }]}
      >
        <Text accessibilityRole="header" style={styles.title}>
          NK Meet
        </Text>
        <Text style={styles.brandBy}>by NKolosov</Text>
      </View>

      <ScrollView
        testID="join-screen-scroll"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 80 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text accessibilityRole="header" style={styles.subtitle}>
          Room: {roomSlug}
        </Text>

        <View testID="prejoin-media-group" style={styles.preJoinMediaGroup}>
          <View style={styles.previewContainer}>
            <ParticipantTile
              previewTrack={previewTrack}
              displayName={name.trim()}
              isMicrophoneEnabled={microphoneEnabled}
              width={Math.min(viewportWidth - 40, 560)}
              height={Math.min((viewportWidth - 40) * 0.56, 315)}
            />
          </View>

          <View style={styles.mediaControls}>
            <View style={styles.controlWrapper}>
              <MediaDeviceButton
                icon={microphoneEnabled ? <MicIcon /> : <MicDisabledIcon />}
                text="Microphone"
                onToggle={() => setMicrophoneEnabled(enabled => !enabled)}
                onToggleDropdown={() =>
                  setOpenDropdown(current =>
                    current === "microphone" ? undefined : "microphone",
                  )
                }
                toggleAccessibilityLabel={
                  microphoneEnabled
                    ? "Turn off microphone"
                    : "Turn on microphone"
                }
                dropdownAccessibilityLabel="Select microphone"
                disabled={areMediaControlsDisabled}
                dropdownDisabled={areMediaControlsDisabled}
                isDropdownVisible={openDropdown === "microphone"}
                dropdownAccessibilityState={{
                  expanded: openDropdown === "microphone",
                }}
              />
              {openDropdown === "microphone" && (
                <DeviceDropdown
                  sections={[
                    {
                      title: "Select microphone",
                      items: microphones.map(device => ({
                        deviceId: device.deviceId,
                        label: device.label,
                        selected: microphoneDeviceId === device.deviceId,
                        onPress: () => {
                          setMicrophoneDeviceId(device.deviceId)
                          setOpenDropdown(undefined)
                        },
                      })),
                    },
                  ]}
                  emptyMessage="No audio devices found"
                  positionStyle={styles.preJoinDropdown}
                />
              )}
            </View>

            <View style={styles.controlWrapper}>
              <MediaDeviceButton
                icon={cameraEnabled ? <CameraIcon /> : <CameraDisabledIcon />}
                text="Camera"
                onToggle={() => setCameraEnabled(enabled => !enabled)}
                onToggleDropdown={() =>
                  setOpenDropdown(current =>
                    current === "camera" ? undefined : "camera",
                  )
                }
                toggleAccessibilityLabel={
                  cameraEnabled ? "Turn off camera" : "Turn on camera"
                }
                dropdownAccessibilityLabel="Select camera"
                disabled={areMediaControlsDisabled}
                dropdownDisabled={areMediaControlsDisabled}
                isDropdownVisible={openDropdown === "camera"}
                dropdownAccessibilityState={{
                  expanded: openDropdown === "camera",
                }}
              />
              {openDropdown === "camera" && (
                <DeviceDropdown
                  sections={[
                    {
                      title: "Select camera",
                      items: cameras.map(device => ({
                        deviceId: device.deviceId,
                        label: device.label,
                        selected: cameraDeviceId === device.deviceId,
                        onPress: () => {
                          setCameraDeviceId(device.deviceId)
                          setOpenDropdown(undefined)
                        },
                      })),
                    },
                  ]}
                  emptyMessage="No cameras found"
                  positionStyle={styles.preJoinDropdown}
                />
              )}
            </View>
          </View>
        </View>

        <View testID="join-form-group" style={styles.joinFormGroup}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Your name:</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={TEXT_COLORS.placeholderOnLight}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!areMediaControlsDisabled}
              returnKeyType="go"
              onSubmitEditing={join}
              accessibilityLabel="Participant name"
              accessibilityState={{ disabled: areMediaControlsDisabled }}
            />
          </View>

          {message && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{message}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.joinButton,
              isJoinDisabled ? styles.joinButtonDisabled : undefined,
            ]}
            onPress={join}
            disabled={isJoinDisabled}
            accessibilityLabel="Join room"
            accessibilityRole="button"
            accessibilityState={{ disabled: isJoinDisabled }}
          >
            {isLoading ? (
              <ActivityIndicator color={TEXT_COLORS.onPrimary} />
            ) : (
              <Text
                style={[
                  styles.joinButtonText,
                  isJoinDisabled ? styles.joinButtonTextDisabled : undefined,
                ]}
              >
                Join
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <StatusBar style="light" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  backButton: {
    position: "absolute",
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  header: {
    position: "absolute",
    left: 60,
    right: 60,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLORS.background,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "flex-start",
  },
  previewContainer: {
    alignItems: "center",
  },
  preJoinMediaGroup: {
    gap: 12,
  },
  mediaControls: {
    flexDirection: "row",
    gap: 12,
    zIndex: 2,
  },
  controlWrapper: { flex: 1 },
  preJoinDropdown: {
    left: 0,
    right: 0,
  },
  joinFormGroup: {
    gap: 12,
    marginTop: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 0,
    color: TEXT_COLORS.light,
  },
  brandBy: {
    color: TEXT_COLORS.placeholder,
    fontSize: 11,
    marginTop: -2,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: TEXT_COLORS.placeholder,
  },
  inputContainer: {
    marginBottom: 0,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: TEXT_COLORS.light,
  },
  input: {
    backgroundColor: TEXT_COLORS.light,
    borderWidth: 1,
    borderColor: BORDER_COLORS.lightBorder,
    borderRadius: BORDER_RADIUSES.medium,
    padding: 15,
    fontSize: 16,
    color: TEXT_COLORS.secondary,
    minHeight: 50,
  },
  errorContainer: {
    backgroundColor: BACKGROUND_COLORS.tertiary,
    borderRadius: BORDER_RADIUSES.medium,
    padding: 12,
    marginBottom: 0,
    borderLeftWidth: 4,
    borderLeftColor: BORDER_COLORS.danger,
  },
  errorText: {
    color: TEXT_COLORS.danger,
    fontSize: 14,
    fontWeight: "500",
  },
  joinButton: {
    backgroundColor: BACKGROUND_COLORS.primary,
    borderRadius: BORDER_RADIUSES.medium,
    padding: 16,
    alignItems: "center",
    marginTop: 0,
    minHeight: 56,
    justifyContent: "center",
  },
  joinButtonDisabled: {
    backgroundColor: BACKGROUND_COLORS.disabled,
  },
  joinButtonText: {
    color: TEXT_COLORS.onPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  joinButtonTextDisabled: {
    color: TEXT_COLORS.disabled,
  },
})
