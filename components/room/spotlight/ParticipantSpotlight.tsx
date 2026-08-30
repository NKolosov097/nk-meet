import { useCallback, useState } from "react"
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type ListRenderItem,
} from "react-native"

import type { TrackReferenceOrPlaceholder } from "@livekit/react-native"

import { ParticipantTile } from "@/components/participant/ParticipantTile"
import { getTrackKey } from "@/components/room/grid/trackKey"

import {
  CAROUSEL_GAP,
  CAROUSEL_PADDING,
  CAROUSEL_TILE_HEIGHT,
  CAROUSEL_TILE_WIDTH,
} from "./spotlightLayout"

// Carousel tiles mounted up front; covers a typical viewport at
// CAROUSEL_TILE_WIDTH without eagerly mounting every live video track.
const CAROUSEL_INITIAL_NUM_TO_RENDER = 4
// Number of viewport-sized windows kept mounted around the visible one.
const CAROUSEL_WINDOW_SIZE = 3

interface ParticipantSpotlightProps {
  // The track shown fullscreen.
  expandedTrack: TrackReferenceOrPlaceholder
  // Every other track, shown in the bottom carousel.
  carouselTracks: TrackReferenceOrPlaceholder[]
  // False while an active screen share forces this view, hiding manual controls.
  canManuallySelect: boolean
  // Spotlights the track with the given key.
  onSelect: (key: string) => void
  // Returns to grid view.
  onCollapse: VoidFunction
}

interface MainAreaSize {
  // Measured width of the fullscreen area, in pixels.
  width: number
  // Measured height of the fullscreen area, in pixels.
  height: number
}

const INITIAL_MAIN_AREA_SIZE: MainAreaSize = { width: 0, height: 0 }

export const ParticipantSpotlight = ({
  expandedTrack,
  carouselTracks,
  canManuallySelect,
  onSelect,
  onCollapse,
}: ParticipantSpotlightProps) => {
  const [mainAreaSize, setMainAreaSize] = useState<MainAreaSize>(
    INITIAL_MAIN_AREA_SIZE,
  )

  const onMainAreaLayout = useCallback((event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout
    setMainAreaSize({ width, height })
  }, [])

  const renderCarouselTile: ListRenderItem<TrackReferenceOrPlaceholder> =
    useCallback(
      ({ item: track }) => {
        const key = getTrackKey(track)
        const participantLabel =
          track.participant.name || track.participant.identity
        const carouselTileLabel = `Show ${participantLabel} fullscreen`
        const onPress = () => onSelect(key)
        const tile = (
          <ParticipantTile
            trackRef={track}
            width={CAROUSEL_TILE_WIDTH}
            height={CAROUSEL_TILE_HEIGHT}
          />
        )

        return canManuallySelect ? (
          <TouchableOpacity
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={carouselTileLabel}
          >
            {tile}
          </TouchableOpacity>
        ) : (
          <View>{tile}</View>
        )
      },
      [canManuallySelect, onSelect],
    )

  return (
    <View style={styles.container} testID="participant-spotlight">
      <View style={styles.mainArea} onLayout={onMainAreaLayout}>
        <ParticipantTile
          key={getTrackKey(expandedTrack)}
          trackRef={expandedTrack}
          width={mainAreaSize.width}
          height={mainAreaSize.height}
          isSpotlighted
          onToggleSpotlight={canManuallySelect ? onCollapse : undefined}
        />
      </View>

      {carouselTracks.length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.carousel}
          contentContainerStyle={styles.carouselContent}
          testID="participant-carousel"
          data={carouselTracks}
          keyExtractor={getTrackKey}
          renderItem={renderCarouselTile}
          initialNumToRender={CAROUSEL_INITIAL_NUM_TO_RENDER}
          windowSize={CAROUSEL_WINDOW_SIZE}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainArea: {
    flex: 1,
  },
  carousel: {
    flexGrow: 0,
    height: CAROUSEL_TILE_HEIGHT + CAROUSEL_PADDING * 2,
  },
  carouselContent: {
    gap: CAROUSEL_GAP,
    padding: CAROUSEL_PADDING,
  },
})
