import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useLocalSearchParams, useRouter } from "expo-router"

import { LiveKitRoom } from "@livekit/react-native"
import {
  VideoPresets,
  Room as LiveKitRoomInstance,
  ConnectionState as LiveKitConnectionState,
  type RoomConnectOptions,
  type RoomOptions,
} from "livekit-client"

import { ActiveRoom } from "@/components/room/ActiveRoom"
import { JoinScreen } from "@/screens/JoinScreen"
import { getActiveRoomIdentity } from "@/services/activeRoomConnection"
import { revokeHostAccess, type MeetingEntry } from "@/services/livekitToken"
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
  const roomRef = useRef<LiveKitRoomInstance | null>(null)
  const entryRef = useRef<MeetingEntry | undefined>(undefined)
  const endEntry = useCallback((): void => {
    const entry = entryRef.current
    entryRef.current = undefined
    if (entry?.hostAccess) revokeHostAccess(company, slug, entry.hostAccess)
  }, [company, slug])
  const isDisconnectForcedRef = useRef<boolean>(false)

  const onJoined = useCallback(
    (entry: MeetingEntry, media: PreJoinMediaSettings): void => {
      isDisconnectForcedRef.current = false
      entryRef.current = entry
      roomRef.current = new LiveKitRoomInstance({
        ...roomOptions,
        audioCaptureDefaults: media.microphoneDeviceId
          ? { deviceId: media.microphoneDeviceId }
          : undefined,
        videoCaptureDefaults: {
          ...roomOptions.videoCaptureDefaults,
          ...(media.cameraDeviceId ? { deviceId: media.cameraDeviceId } : {}),
        },
      })
      setConnectionState({ token: entry.participantToken, entry, media })
    },
    [],
  )

  const onForcedDisconnect = useCallback((): void => {
    endEntry()
    isDisconnectForcedRef.current = true
    setConnectionState(initialConnectionState)
  }, [endEntry])

  const goToCompanyHome = useCallback((): void => {
    router.replace(`/${company}`)
  }, [company, router])

  const renderedEntry = connectionState.entry
  const renderedRoom = roomRef.current
  const onDisconnect = useCallback((): void => {
    if (entryRef.current !== renderedEntry) return
    endEntry()
    setConnectionState(initialConnectionState)

    if (isDisconnectForcedRef.current) {
      isDisconnectForcedRef.current = false
      return
    }

    goToCompanyHome()
  }, [goToCompanyHome, endEntry, renderedEntry])

  const onConnectionError = useCallback(
    (error?: Error): void => {
      if (
        entryRef.current !== renderedEntry ||
        renderedRoom?.state !== LiveKitConnectionState.Disconnected
      )
        return
      endEntry()
      setConnectionState({
        token: null,
        error: error?.message || "Failed to connect to the room",
      })
    },
    [endEntry, renderedEntry, renderedRoom],
  )
  useEffect(
    () => () => {
      endEntry()
    },
    [endEntry],
  )

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

  const audioOptions = media?.microphoneEnabled
    ? media.microphoneDeviceId
      ? { deviceId: media.microphoneDeviceId }
      : true
    : false
  const videoOptions = media?.cameraEnabled
    ? media.cameraDeviceId
      ? { deviceId: media.cameraDeviceId }
      : true
    : false

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
      room={roomRef.current ?? undefined}
      serverUrl={connectionState.entry?.serverUrl}
      token={connectionState.token}
      connect
      onDisconnected={onDisconnect}
      onError={onConnectionError}
      audio={audioOptions}
      video={videoOptions}
      options={connectedRoomOptions}
      connectOptions={connectOptions}
    >
      <ActiveRoom
        company={company}
        roomSlug={slug}
        onForcedDisconnect={onForcedDisconnect}
        entry={connectionState.entry}
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
