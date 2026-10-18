import type { TrackReferenceOrPlaceholder } from "@livekit/react-native"

// Stable identity for a track entry: one participant can contribute both a
// camera and a screen-share entry, so identity + source is required to tell
// them apart.
export const getTrackKey = (track: TrackReferenceOrPlaceholder): string =>
  `${track.participant.identity}-${track.source}`
