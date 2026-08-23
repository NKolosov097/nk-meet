import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { BlurView } from "expo-blur"

import {
  isTrackReference,
  useTrackMutedIndicator,
  VideoTrack,
  type TrackReference,
  type TrackReferenceOrPlaceholder,
} from "@livekit/react-native"
import { Track, type LocalVideoTrack } from "livekit-client"

import { MicDisabledIcon, ParticipantPlaceholderIcon } from "@/components/icons"
import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"

const MIC_ICON_SIZE = 16
const BLUR_INTENSITY = 40
const BADGE_BACKGROUND = "rgba(0, 0, 0, 0.25)"
const BADGE_INSET = 4

interface ConnectedParticipantTileProps {
  // The participant's camera/screen-share track, or a placeholder.
  trackRef: TrackReferenceOrPlaceholder
  // Width of this tile, in pixels, as computed by the grid layout.
  width: number
  // Height of this tile, in pixels, as computed by the grid layout.
  height: number
  previewTrack?: never
  displayName?: never
  isMicrophoneEnabled?: never
}

interface PreviewParticipantTileProps {
  // Camera track created before joining, or null while camera is off
  previewTrack: LocalVideoTrack | null
  // Name displayed on the pre-join preview badge
  displayName: string
  // Whether the microphone will start enabled
  isMicrophoneEnabled: boolean
  // Width of the pre-join preview
  width: number
  // Height of the pre-join preview
  height: number
  trackRef?: never
}

type ParticipantTileProps =
  ConnectedParticipantTileProps | PreviewParticipantTileProps

const ConnectedParticipantTile = ({
  trackRef,
  width,
  height,
}: ConnectedParticipantTileProps) => {
  const { participant } = trackRef
  const { isMuted: isVideoMuted } = useTrackMutedIndicator(trackRef)
  const { isMuted: isMicrophoneMuted } = useTrackMutedIndicator({
    participant,
    source: Track.Source.Microphone,
  })

  const hasVideo =
    isTrackReference(trackRef) && !isVideoMuted && !!trackRef.publication.track
  const placeholderSize = Math.min(width, height) * 0.5

  const badge = (
    <>
      {isMicrophoneMuted && (
        <MicDisabledIcon size={MIC_ICON_SIZE} color={TEXT_COLORS.danger} />
      )}

      <Text
        style={styles.participantName}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {participant.name || participant.identity}
        {participant.isLocal ? " (You)" : ""}
      </Text>
    </>
  )

  return (
    <View
      testID={`participant-tile-${participant.identity}`}
      style={[styles.participantContainer, { width, height }]}
    >
      {hasVideo ? (
        <VideoTrack
          style={styles.videoView}
          trackRef={trackRef}
          mirror={participant.isLocal}
        />
      ) : (
        <View style={styles.placeholderView}>
          <ParticipantPlaceholderIcon size={placeholderSize} />
        </View>
      )}

      <View style={styles.badgeAnchor}>
        {hasVideo ? (
          <BlurView
            style={[styles.badge, styles.badgeOnVideo]}
            intensity={BLUR_INTENSITY}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
          >
            {badge}
          </BlurView>
        ) : (
          <View style={styles.badge}>{badge}</View>
        )}
      </View>
    </View>
  )
}

const PreviewParticipantTile = ({
  previewTrack,
  displayName,
  isMicrophoneEnabled,
  width,
  height,
}: PreviewParticipantTileProps) => {
  const trackRef = useMemo(
    () =>
      previewTrack
        ? ({
            participant: { identity: "prejoin", isLocal: true },
            publication: { track: previewTrack },
            source: Track.Source.Camera,
          } as unknown as TrackReference)
        : undefined,
    [previewTrack],
  )
  const placeholderSize = Math.min(width, height) * 0.5

  return (
    <View
      accessibilityLabel="Pre-join participant preview"
      style={[styles.participantContainer, { width, height }]}
    >
      {trackRef ? (
        <VideoTrack style={styles.videoView} trackRef={trackRef} mirror />
      ) : (
        <View style={styles.placeholderView}>
          <ParticipantPlaceholderIcon size={placeholderSize} />
        </View>
      )}
      <View style={styles.badgeAnchor}>
        <View style={styles.badge}>
          {!isMicrophoneEnabled && (
            <MicDisabledIcon size={MIC_ICON_SIZE} color={TEXT_COLORS.danger} />
          )}
          <Text style={styles.participantName} numberOfLines={1}>
            {displayName || "You"} (You)
          </Text>
        </View>
      </View>
    </View>
  )
}

export const ParticipantTile = (props: ParticipantTileProps) =>
  props.trackRef !== undefined ? (
    <ConnectedParticipantTile {...props} />
  ) : (
    <PreviewParticipantTile {...(props as PreviewParticipantTileProps)} />
  )

const styles = StyleSheet.create({
  participantContainer: {
    backgroundColor: BACKGROUND_COLORS.secondary,
    borderRadius: BORDER_RADIUSES.medium,
    overflow: "hidden",
  },
  videoView: {
    flex: 1,
  },
  placeholderView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeAnchor: {
    position: "absolute",
    bottom: BADGE_INSET,
    left: BADGE_INSET,
    right: BADGE_INSET,
    flexDirection: "row",
  },
  badge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeOnVideo: {
    borderRadius: BORDER_RADIUSES.small,
    overflow: "hidden",
    backgroundColor: BADGE_BACKGROUND,
  },
  participantName: {
    flexShrink: 1,
    color: TEXT_COLORS.light,
    fontSize: 14,
    fontWeight: "600",
  },
})
