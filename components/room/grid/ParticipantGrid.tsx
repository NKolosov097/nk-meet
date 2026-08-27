import {
  StyleSheet,
  View,
  type GestureResponderHandlers,
  type LayoutChangeEvent,
} from "react-native"

import type { TrackReferenceOrPlaceholder } from "@livekit/react-native"

import { ParticipantTile } from "@/components/participant/ParticipantTile"

import { GRID_GAP, GRID_PADDING } from "./gridLayout"
import { getTrackKey } from "./trackKey"

interface ParticipantGridProps {
  // The current page's participant/placeholder tracks to render as tiles.
  tracks: TrackReferenceOrPlaceholder[]
  // Computed width of one tile, in pixels.
  tileWidth: number
  // Computed height of one tile, in pixels.
  tileHeight: number
  // Called when the grid container's layout is measured.
  onLayout: (event: LayoutChangeEvent) => void
  // Gesture handlers enabling horizontal swipe-to-change-page; spread onto the container.
  panHandlers: GestureResponderHandlers
  // Called with a track's key when its expand button is pressed.
  onExpand: (key: string) => void
}

export const ParticipantGrid = ({
  tracks,
  tileWidth,
  tileHeight,
  onLayout,
  panHandlers,
  onExpand,
}: ParticipantGridProps) => (
  <View style={styles.swipeArea} {...panHandlers}>
    <View
      testID="participant-grid"
      style={styles.container}
      onLayout={onLayout}
    >
      {tracks.map(track => {
        const key = getTrackKey(track)

        return (
          <ParticipantTile
            key={key}
            trackRef={track}
            width={tileWidth}
            height={tileHeight}
            onToggleSpotlight={() => onExpand(key)}
          />
        )
      })}
    </View>
  </View>
)

const styles = StyleSheet.create({
  swipeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    padding: GRID_PADDING,
  },
})
