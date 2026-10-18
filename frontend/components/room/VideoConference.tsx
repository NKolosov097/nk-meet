import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { sortTrackReferences } from "@livekit/components-core"
import { useTracks } from "@livekit/react-native"
import { ParticipantKind, Track } from "livekit-client"

import { PaginationBar } from "@/components/room/grid/PaginationBar"
import { ParticipantGrid } from "@/components/room/grid/ParticipantGrid"
import { useParticipantGrid } from "@/components/room/grid/useParticipantGrid"
import { ParticipantSpotlight } from "@/components/room/spotlight/ParticipantSpotlight"
import { useParticipantSpotlight } from "@/components/room/spotlight/useParticipantSpotlight"
import { TEXT_COLORS } from "@/constants/colors"

const tracksOption = [
  { source: Track.Source.Camera, withPlaceholder: true },
  { source: Track.Source.ScreenShare, withPlaceholder: false },
]

const VISIBLE_PARTICIPANT_KINDS: ParticipantKind[] = [
  ParticipantKind.STANDARD,
  ParticipantKind.SIP,
]

export const VideoConference = () => {
  const tracks = useTracks(tracksOption)

  const participantTracks = useMemo(
    () =>
      sortTrackReferences(
        tracks.filter(track =>
          VISIBLE_PARTICIPANT_KINDS.includes(track.participant.kind),
        ),
      ),
    [tracks],
  )

  const {
    onContainerLayout,
    panHandlers,
    visibleItems,
    tileWidth,
    tileHeight,
    currentPage,
    totalPages,
    isPaginationVisible,
    goToNextPage,
    goToPreviousPage,
  } = useParticipantGrid(participantTracks)

  const {
    expandedTrack,
    carouselTracks,
    canManuallySelect,
    selectSpotlight,
    clearSpotlight,
  } = useParticipantSpotlight(participantTracks)

  if (participantTracks.length === 0) {
    return (
      <View style={styles.noVideo}>
        <Text style={styles.noVideoText}>No participants in the room</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {expandedTrack ? (
        <ParticipantSpotlight
          expandedTrack={expandedTrack}
          carouselTracks={carouselTracks}
          canManuallySelect={canManuallySelect}
          onSelect={selectSpotlight}
          onCollapse={clearSpotlight}
        />
      ) : (
        <>
          <ParticipantGrid
            tracks={visibleItems}
            tileWidth={tileWidth}
            tileHeight={tileHeight}
            onLayout={onContainerLayout}
            panHandlers={panHandlers}
            onExpand={selectSpotlight}
          />

          {totalPages > 1 && (
            <PaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              isVisible={isPaginationVisible}
              onPrevious={goToPreviousPage}
              onNext={goToNextPage}
            />
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  noVideo: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noVideoText: {
    color: TEXT_COLORS.light,
    fontSize: 16,
  },
})
