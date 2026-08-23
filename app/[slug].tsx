import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useLocalSearchParams, useRouter } from "expo-router"

import { LiveKitRoom } from "@livekit/react-native"
import {
  VideoPresets,
  type RoomConnectOptions,
  type RoomOptions,
} from "livekit-client"

import { ActiveRoom } from "@/components/room/ActiveRoom"
import { env } from "@/constants/env"
import { JoinScreen } from "@/screens/JoinScreen"
import { getActiveRoomSlug } from "@/services/activeRoomConnection"
import { slugify } from "@/services/roomSlug"

import type { ConnectionState, PreJoinMediaSettings } from "@/types"

const initialConnectionState: ConnectionState = {
  token: null,
}

const roomOptions: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h360.resolution,
  },
  publishDefaults: {
    simulcast: false,
    videoEncoding: VideoPresets.h360.encoding,
  },
}

const connectOptions: RoomConnectOptions = {
  maxRetries: 5,
}

interface RoomProps {
  // Canonical slug of the room to join, already slugified by the route
  slug: string
}

const Room = ({ slug }: RoomProps) => {
  const router = useRouter()
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    () => initialConnectionState,
  )
  // Set while the app itself ends this call (a link to another room arrived).
  // Lets onDisconnect skip its own navigation — the router is already there.
  const isDisconnectForcedRef = useRef<boolean>(false)

  const onJoined = useCallback(
    (token: string, media: PreJoinMediaSettings): void => {
      isDisconnectForcedRef.current = false
      setConnectionState({ token, media })
    },
    [],
  )

  // The call is being torn down for the room the router is already navigating
  // to, so drop the token right away instead of waiting for LiveKit's
  // Disconnected event — a room that was never connected never sends one.
  const onForcedDisconnect = useCallback((): void => {
    isDisconnectForcedRef.current = true
    setConnectionState(initialConnectionState)
  }, [])

  const goToHomeScreen = useCallback((): void => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace("/")
    }
  }, [router])

  const onDisconnect = useCallback((): void => {
    setConnectionState(initialConnectionState)

    if (isDisconnectForcedRef.current) {
      isDisconnectForcedRef.current = false
      return
    }

    goToHomeScreen()
  }, [goToHomeScreen])

  const onConnectionError = useCallback((error?: Error): void => {
    console.error("Connection error: ", error)
    setConnectionState({
      token: null,
      error: error?.message || "Failed to connect to the room",
    })
  }, [])

  const media = connectionState.media
  const connectedRoomOptions = useMemo<RoomOptions>(
    () => ({
      ...roomOptions,
      audioCaptureDefaults: media?.microphoneDeviceId
        ? { deviceId: media.microphoneDeviceId }
        : undefined,
      videoCaptureDefaults: {
        ...roomOptions.videoCaptureDefaults,
        ...(media?.cameraDeviceId ? { deviceId: media.cameraDeviceId } : {}),
      },
    }),
    [media?.microphoneDeviceId, media?.cameraDeviceId],
  )

  if (connectionState.token === null) {
    return (
      <JoinScreen
        roomSlug={slug}
        error={connectionState.error}
        onJoined={onJoined}
        onBack={goToHomeScreen}
      />
    )
  }

  return (
    <LiveKitRoom
      serverUrl={env.serverUrl}
      token={connectionState.token}
      connect
      onDisconnected={onDisconnect}
      onError={onConnectionError}
      audio={
        media?.microphoneEnabled
          ? media.microphoneDeviceId
            ? { deviceId: media.microphoneDeviceId }
            : true
          : false
      }
      video={
        media?.cameraEnabled
          ? media.cameraDeviceId
            ? { deviceId: media.cameraDeviceId }
            : true
          : false
      }
      options={connectedRoomOptions}
      connectOptions={connectOptions}
    >
      <ActiveRoom roomSlug={slug} onForcedDisconnect={onForcedDisconnect} />
    </LiveKitRoom>
  )
}

export default function RoomScreen() {
  const { slug: rawSlug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  // Deep-link params are untrusted input and reach the LiveKit room name
  // directly, so "Team%20Sync", "Team-Sync" and "team-sync" must all resolve
  // to the one room a home-screen user reaches by typing the same text.
  const slug = slugify(rawSlug ?? "")
  const isCanonical = slug === rawSlug
  // Defense-in-depth: +native-intent.ts already canonicalizes real links, but
  // any other route to this screen with a raw param could still produce a
  // non-canonical duplicate of a room already open elsewhere — dismiss it.
  const isDuplicateOfActiveRoom =
    !isCanonical && slug !== "" && slug === getActiveRoomSlug()

  useEffect(() => {
    if (isCanonical) {
      return
    }

    if (isDuplicateOfActiveRoom && router.canGoBack()) {
      // Dismiss this duplicate rather than joining afresh — the existing
      // screen underneath is already connected to this room.
      router.back()
      return
    }

    // Fix the URL/history entry to the canonical form.
    router.replace(slug ? `/${slug}` : "/")
  }, [isCanonical, isDuplicateOfActiveRoom, slug, router])

  if (!slug || isDuplicateOfActiveRoom) {
    return null
  }

  // Keyed by the canonical slug so per-room state rebuilds when the room
  // actually changes, but stays mounted for a non-canonical link to the same one.
  return <Room key={slug} slug={slug} />
}
