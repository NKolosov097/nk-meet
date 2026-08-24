import { useState } from "react"
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"

import { SafeAreaView } from "react-native-safe-area-context"

import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import {
  BACKGROUND_COLORS,
  BORDER_COLORS,
  TEXT_COLORS,
} from "@/constants/colors"

import { ControlBarPreview } from "./ControlBarPreview"
import { GRID_GAP, GRID_PADDING } from "./gridLayout"
import { PaginationBar } from "./PaginationBar"
import { useParticipantGrid } from "./useParticipantGrid"

const PRESET_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 16]

// Dev-only screen for eyeballing the grid breakpoints without a real LiveKit
// room. Not part of the app's normal navigation — see App.tsx for how it's
// toggled on.
export const GridPreview = () => {
  const [count, setCount] = useState(1)
  const items = Array.from({ length: count }, (_, index) => index)

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
  } = useParticipantGrid(items)

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        horizontal
        style={styles.presetRow}
        contentContainerStyle={styles.presetRowContent}
      >
        {PRESET_COUNTS.map(preset => (
          <TouchableOpacity
            key={preset}
            style={[
              styles.presetButton,
              preset === count ? styles.presetButtonActive : undefined,
            ]}
            onPress={() => setCount(preset)}
            accessibilityLabel={`Show ${preset} ${preset === 1 ? "participant" : "participants"}`}
            accessibilityRole="button"
            accessibilityState={{ selected: preset === count }}
          >
            <Text
              style={[
                styles.presetButtonText,
                preset === count ? styles.presetButtonActiveText : undefined,
              ]}
            >
              {preset}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.gridWrapper}>
        <View style={styles.swipeArea} {...panHandlers}>
          <View style={styles.grid} onLayout={onContainerLayout}>
            {visibleItems.map(index => (
              <View
                key={index}
                style={[styles.tile, { width: tileWidth, height: tileHeight }]}
              >
                <Text style={styles.tileText}>
                  {index + 1}
                  {index === 0 ? " (You)" : ""}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {totalPages > 1 && (
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            isVisible={isPaginationVisible}
            onPrevious={goToPreviousPage}
            onNext={goToNextPage}
          />
        )}
      </View>

      <ControlBarPreview />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND_COLORS.black,
  },
  presetRow: {
    flexGrow: 0,
    backgroundColor: BACKGROUND_COLORS.tertiary,
  },
  presetRowContent: {
    padding: 8,
    gap: 8,
  },
  presetButton: {
    backgroundColor: BACKGROUND_COLORS.secondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUSES.pill,
  },
  presetButtonActive: {
    backgroundColor: BACKGROUND_COLORS.primary,
    borderColor: BORDER_COLORS.selectionIndicator,
    borderWidth: 2,
  },
  presetButtonText: {
    color: TEXT_COLORS.light,
    fontWeight: "600",
  },
  presetButtonActiveText: {
    color: TEXT_COLORS.onPrimary,
  },
  gridWrapper: {
    flex: 1,
  },
  swipeArea: {
    flex: 1,
  },
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    padding: GRID_PADDING,
  },
  tile: {
    backgroundColor: BACKGROUND_COLORS.secondary,
    borderRadius: BORDER_RADIUSES.medium,
    justifyContent: "center",
    alignItems: "center",
  },
  tileText: {
    color: TEXT_COLORS.light,
    fontSize: 20,
    fontWeight: "700",
  },
})
