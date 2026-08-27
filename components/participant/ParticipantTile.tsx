import { StyleSheet, Text, TouchableOpacity, View } from "react-native"

import {
  isTrackReference,
  useTrackMutedIndicator,
  VideoTrack,
  VideoView,
  type TrackReferenceOrPlaceholder,
} from "@livekit/react-native"
import { Track, type LocalVideoTrack } from "livekit-client"

import {
  CollapseIcon,
  ExpandIcon,
  MicDisabledIcon,
  ParticipantPlaceholderIcon,
} from "@/components/icons"
import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"

const MIC_ICON_SIZE = 16
const BADGE_INSET = 4
const SPOTLIGHT_ICON_SIZE = 16
const SPOTLIGHT_BUTTON_SIZE = 28
const SPOTLIGHT_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 }

interface ConnectedParticipantTileProps {
  // The participant's camera/screen-share track, or a placeholder.
  trackRef: TrackReferenceOrPlaceholder
  // Width of this tile, in pixels, as computed by the grid layout.
  width: number
  // Height of this tile, in pixels, as computed by the grid layout.
  height: number
  // True when this tile is shown fullscreen; selects the collapse icon.
  isSpotlighted?: boolean
  // Shows the expand/collapse button when provided; omitted hides it.
  onToggleSpotlight?: VoidFunction
  // Connected tiles cannot receive pre-join preview tracks
  previewTrack?: never
  // Connected tiles read the participant name from the LiveKit track
  displayName?: never
  // Connected tiles read microphone state from the LiveKit participant
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
  // Preview tiles cannot receive connected-participant LiveKit tracks
  trackRef?: never
}

type ParticipantTileProps =
  ConnectedParticipantTileProps | PreviewParticipantTileProps

// Identifies the pre-join variant by its required preview track value.
const isPreviewParticipantTile = (
  props: ParticipantTileProps,
): props is PreviewParticipantTileProps => props.previewTrack !== undefined

const ConnectedParticipantTile = ({
  trackRef,
  width,
  height,
  isSpotlighted = false,
  onToggleSpotlight,
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
        <MicDisabledIcon
          size={MIC_ICON_SIZE}
          color={TEXT_COLORS.participantStatusDanger}
        />
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

  const spotlightAccessibilityLabel = isSpotlighted
    ? "Collapse video"
    : "Expand video"

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
          <ParticipantPlaceholderIcon
            size={placeholderSize}
            color={TEXT_COLORS.placeholder}
          />
        </View>
      )}

      <View style={styles.badgeAnchor}>
        <View testID="participant-badge" style={styles.badge}>
          {badge}
        </View>
      </View>

      {onToggleSpotlight && (
        <TouchableOpacity
          testID="participant-spotlight-button"
          style={styles.spotlightButton}
          onPress={onToggleSpotlight}
          accessibilityRole="button"
          accessibilityLabel={spotlightAccessibilityLabel}
          hitSlop={SPOTLIGHT_HIT_SLOP}
        >
          {isSpotlighted ? (
            <CollapseIcon
              size={SPOTLIGHT_ICON_SIZE}
              color={TEXT_COLORS.light}
            />
          ) : (
            <ExpandIcon size={SPOTLIGHT_ICON_SIZE} color={TEXT_COLORS.light} />
          )}
        </TouchableOpacity>
      )}
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
  const placeholderSize = Math.min(width, height) * 0.5

  return (
    <View
      accessibilityLabel="Pre-join participant preview"
      style={[styles.participantContainer, { width, height }]}
    >
      {previewTrack ? (
        <VideoView style={styles.videoView} videoTrack={previewTrack} mirror />
      ) : (
        <View style={styles.placeholderView}>
          <ParticipantPlaceholderIcon
            size={placeholderSize}
            color={TEXT_COLORS.placeholder}
          />
        </View>
      )}
      <View style={styles.badgeAnchor}>
        <View testID="participant-badge" style={styles.badge}>
          {!isMicrophoneEnabled && (
            <MicDisabledIcon
              size={MIC_ICON_SIZE}
              color={TEXT_COLORS.participantStatusDanger}
            />
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
  isPreviewParticipantTile(props) ? (
    <PreviewParticipantTile {...props} />
  ) : (
    <ConnectedParticipantTile {...props} />
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
  spotlightButton: {
    position: "absolute",
    top: BADGE_INSET,
    left: BADGE_INSET,
    width: SPOTLIGHT_BUTTON_SIZE,
    height: SPOTLIGHT_BUTTON_SIZE,
    borderRadius: BORDER_RADIUSES.pill,
    backgroundColor: BACKGROUND_COLORS.participantBadge,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUSES.small,
    overflow: "hidden",
    backgroundColor: BACKGROUND_COLORS.participantBadge,
  },
  participantName: {
    flexShrink: 1,
    color: TEXT_COLORS.light,
    fontSize: 14,
    fontWeight: "600",
  },
})
