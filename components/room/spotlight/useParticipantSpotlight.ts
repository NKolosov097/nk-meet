import { useCallback, useEffect, useMemo, useState } from "react"

import type { TrackReferenceOrPlaceholder } from "@livekit/react-native"
import { Track } from "livekit-client"

import { getTrackKey } from "@/components/room/grid/trackKey"

export interface UseParticipantSpotlightResult {
  // The track currently shown fullscreen, or null when nobody is
  // spotlighted (grid view).
  expandedTrack: TrackReferenceOrPlaceholder | null
  // Every other track, in original order, shown in the bottom carousel.
  carouselTracks: TrackReferenceOrPlaceholder[]
  // False while an active screen share is forcing the spotlight; manual
  // controls should be hidden.
  canManuallySelect: boolean
  // Spotlights the track with the given key; a no-op while a screen share
  // is active.
  selectSpotlight: (key: string) => void
  // Returns to grid view; a no-op while a screen share is active.
  clearSpotlight: VoidFunction
}

export const useParticipantSpotlight = (
  tracks: TrackReferenceOrPlaceholder[],
): UseParticipantSpotlightResult => {
  const [spotlightId, setSpotlightId] = useState<string | null>(null)

  const screenShareTrack = useMemo(
    () =>
      tracks.find(track => track.source === Track.Source.ScreenShare) ??
      null,
    [tracks],
  )
  const isScreenShareActive = screenShareTrack !== null

  useEffect(() => {
    if (isScreenShareActive) {
      setSpotlightId(null)
    }
  }, [isScreenShareActive])

  const manualTrack = useMemo(
    () =>
      spotlightId
        ? (tracks.find(track => getTrackKey(track) === spotlightId) ?? null)
        : null,
    [tracks, spotlightId],
  )

  useEffect(() => {
    if (spotlightId && !manualTrack) {
      setSpotlightId(null)
    }
  }, [spotlightId, manualTrack])

  const expandedTrack = screenShareTrack ?? manualTrack
  const expandedKey = expandedTrack ? getTrackKey(expandedTrack) : null

  const carouselTracks = useMemo(
    () => tracks.filter(track => getTrackKey(track) !== expandedKey),
    [tracks, expandedKey],
  )

  const selectSpotlight = useCallback(
    (key: string): void => {
      if (isScreenShareActive) return
      setSpotlightId(key)
    },
    [isScreenShareActive],
  )

  const clearSpotlight = useCallback((): void => {
    if (isScreenShareActive) return
    setSpotlightId(null)
  }, [isScreenShareActive])

  return {
    expandedTrack,
    carouselTracks,
    canManuallySelect: !isScreenShareActive,
    selectSpotlight,
    clearSpotlight,
  }
}
