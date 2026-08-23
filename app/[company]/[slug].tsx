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
import { getActiveRoomIdentity } from "@/services/activeRoomConnection"
import { slugify } from "@/services/roomSlug"

import type { ConnectionState, PreJoinMediaSettings } from "@/types"

const initialConnectionState: ConnectionState = { token: null }

const roomOptions: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: { resolution: VideoPresets.h360.resolution },
  publishDefaults: {
    simulcast: false,
    videoEncoding: VideoPresets.h360.encoding,
  },
}

const connectOptions: RoomConnectOptions = { maxRetries: 5 }

interface RoomProps {
  // Canonical company segment that scopes the call
  company: string
  // Canonical room segment displayed in the join and call UI
  slug: string
}

const Room = ({ company, slug }: RoomProps) => {
  const router = useRouter()
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    () => initialConnectionState,
  )
  const isDisconnectForcedRef = useRef<boolean>(false)

  const onJoined = useCallback(
    (token: string, media: PreJoinMediaSettings): void => {
      isDisconnectForcedRef.current = false
      setConnectionState({ token, media })
    },
    [],
  )

  const onForcedDisconnect = useCallback((): void => {
    isDisconnectForcedRef.current = true
    setConnectionState(initialConnectionState)
  }, [])

  const goToCompanyHome = useCallback((): void => {
    router.replace(`/${company}`)
  }, [company, router])

  const onDisconnect = useCallback((): void => {
    setConnectionState(initialConnectionState)

    if (isDisconnectForcedRef.current) {
      isDisconnectForcedRef.current = false
      return
    }

    goToCompanyHome()
  }, [goToCompanyHome])

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
        company={company}
        roomSlug={slug}
        error={connectionState.error}
        onJoined={onJoined}
        onBack={goToCompanyHome}
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
      <ActiveRoom
        company={company}
        roomSlug={slug}
        onForcedDisconnect={onForcedDisconnect}
      />
    </LiveKitRoom>
  )
}

export default function RoomScreen() {
  const { company: rawCompany, slug: rawSlug } = useLocalSearchParams<{
    company: string
    slug: string
  }>()
  const router = useRouter()
  const company = slugify(rawCompany ?? "")
  const slug = slugify(rawSlug ?? "")
  const isCanonical = company === rawCompany && slug === rawSlug
  const activeRoom = getActiveRoomIdentity()
  const isDuplicateOfActiveRoom =
    !isCanonical &&
    company !== "" &&
    slug !== "" &&
    activeRoom?.company === company &&
    activeRoom.slug === slug

  useEffect(() => {
    if (isCanonical) return

    if (isDuplicateOfActiveRoom && router.canGoBack()) {
      router.back()
      return
    }

    router.replace(
      company && slug ? `/${company}/${slug}` : company ? `/${company}` : "/",
    )
  }, [company, isCanonical, isDuplicateOfActiveRoom, router, slug])

  if (!company || !slug || isDuplicateOfActiveRoom) return null

  return <Room key={`${company}/${slug}`} company={company} slug={slug} />
}
