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
import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import {
  BACKGROUND_COLORS,
  BORDER_COLORS,
  TEXT_COLORS,
} from "@/constants/colors"
import { configError } from "@/constants/env"
import { fetchParticipantToken } from "@/services/livekitToken"
import { getRecentRoom, saveRecentRoom } from "@/services/recentRooms"

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
        const recentRoom = await getRecentRoom(roomSlug)

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
  }, [roomSlug])

  const join = useCallback(async (): Promise<void> => {
    if (
      isJoiningRef.current ||
      !initializationComplete ||
      configError !== null
    ) {
      return
    }

    const participantName = name.trim()

    if (!participantName) {
      setTokenError("Please enter your name")
      return
    }

    isJoiningRef.current = true
    setHasStartedJoin(true)
    setIsLoading(true)
    setTokenError(null)

    try {
      const token = await fetchParticipantToken(participantName, roomSlug)
      stopPreview()
      const media = {
        microphoneEnabled,
        cameraEnabled,
        microphoneDeviceId,
        cameraDeviceId,
      }
      onJoined(token, media)
      saveRecentRoom(roomSlug, participantName, media)
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
  const isDisabled =
    isLoading || !initializationComplete || configError !== null

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
      >
        <ChevronLeftIcon />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>NK Meet</Text>
        <Text style={styles.brandBy}>by NKolosov</Text>
        <Text style={styles.subtitle}>Room: {roomSlug}</Text>

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
            <View style={styles.compoundControl}>
              <TouchableOpacity
                style={styles.controlMain}
                onPress={() => setMicrophoneEnabled(enabled => !enabled)}
                disabled={isDisabled}
                accessibilityState={{
                  disabled: isDisabled,
                  selected: microphoneEnabled,
                }}
                accessibilityLabel={
                  microphoneEnabled
                    ? "Turn off microphone"
                    : "Turn on microphone"
                }
              >
                {microphoneEnabled ? <MicIcon /> : <MicDisabledIcon />}
                <Text style={styles.controlText}>Microphone</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlDropdownButton}
                onPress={() =>
                  setOpenDropdown(current =>
                    current === "microphone" ? undefined : "microphone",
                  )
                }
                disabled={isDisabled}
                accessibilityState={{
                  disabled: isDisabled,
                  selected: openDropdown === "microphone",
                }}
                accessibilityLabel="Select microphone"
              >
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
            </View>
            {openDropdown === "microphone" && (
              <View style={styles.deviceList}>
                {microphones.map(device => (
                  <TouchableOpacity
                    key={device.deviceId}
                    style={styles.deviceItem}
                    accessibilityLabel={`${device.label} device`}
                    accessibilityState={{
                      selected: microphoneDeviceId === device.deviceId,
                    }}
                    onPress={() => {
                      setMicrophoneDeviceId(device.deviceId)
                      setOpenDropdown(undefined)
                    }}
                  >
                    <Text style={styles.deviceText}>{device.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.controlWrapper}>
            <View style={styles.compoundControl}>
              <TouchableOpacity
                style={styles.controlMain}
                onPress={() => setCameraEnabled(enabled => !enabled)}
                disabled={isDisabled}
                accessibilityState={{
                  disabled: isDisabled,
                  selected: cameraEnabled,
                }}
                accessibilityLabel={
                  cameraEnabled ? "Turn off camera" : "Turn on camera"
                }
              >
                {cameraEnabled ? <CameraIcon /> : <CameraDisabledIcon />}
                <Text style={styles.controlText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlDropdownButton}
                onPress={() =>
                  setOpenDropdown(current =>
                    current === "camera" ? undefined : "camera",
                  )
                }
                disabled={isDisabled}
                accessibilityState={{
                  disabled: isDisabled,
                  selected: openDropdown === "camera",
                }}
                accessibilityLabel="Select camera"
              >
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
            </View>
            {openDropdown === "camera" && (
              <View style={styles.deviceList}>
                {cameras.map(device => (
                  <TouchableOpacity
                    key={device.deviceId}
                    style={styles.deviceItem}
                    accessibilityLabel={`${device.label} device`}
                    accessibilityState={{
                      selected: cameraDeviceId === device.deviceId,
                    }}
                    onPress={() => {
                      setCameraDeviceId(device.deviceId)
                      setOpenDropdown(undefined)
                    }}
                  >
                    <Text style={styles.deviceText}>{device.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Your name:</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor={TEXT_COLORS.placeholder}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!isDisabled}
            returnKeyType="go"
            onSubmitEditing={join}
            accessibilityLabel="Participant name"
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
            isDisabled ? styles.joinButtonDisabled : undefined,
          ]}
          onPress={join}
          disabled={isDisabled}
          accessibilityLabel="Join room"
        >
          {isLoading ? (
            <ActivityIndicator color={TEXT_COLORS.light} />
          ) : (
            <Text style={styles.joinButtonText}>Join</Text>
          )}
        </TouchableOpacity>
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
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLORS.background,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },
  previewContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  mediaControls: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    zIndex: 2,
  },
  controlWrapper: { flex: 1 },
  compoundControl: { flexDirection: "row" },
  controlMain: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BACKGROUND_COLORS.secondary,
    borderTopLeftRadius: BORDER_RADIUSES.medium,
    borderBottomLeftRadius: BORDER_RADIUSES.medium,
  },
  controlDropdownButton: {
    width: 36,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BACKGROUND_COLORS.secondary,
    borderLeftWidth: 1,
    borderLeftColor: BORDER_COLORS.lightBorder,
    borderTopRightRadius: BORDER_RADIUSES.medium,
    borderBottomRightRadius: BORDER_RADIUSES.medium,
  },
  controlText: { color: TEXT_COLORS.light, fontWeight: "600" },
  dropdownArrow: { color: TEXT_COLORS.light, fontSize: 11 },
  deviceList: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: BACKGROUND_COLORS.secondary,
    borderRadius: BORDER_RADIUSES.medium,
    overflow: "hidden",
    zIndex: 3,
  },
  deviceItem: { paddingHorizontal: 12, paddingVertical: 12 },
  deviceText: { color: TEXT_COLORS.light },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
    color: TEXT_COLORS.light,
  },
  brandBy: {
    color: TEXT_COLORS.placeholder,
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: TEXT_COLORS.placeholder,
  },
  inputContainer: {
    marginBottom: 20,
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
    marginBottom: 16,
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
    marginTop: 20,
    minHeight: 56,
    justifyContent: "center",
  },
  joinButtonDisabled: {
    backgroundColor: BACKGROUND_COLORS.disabled,
  },
  joinButtonText: {
    color: TEXT_COLORS.light,
    fontSize: 18,
    fontWeight: "600",
  },
})
