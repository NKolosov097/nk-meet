import { useEffect, useRef } from "react"
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons"
import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import {
  BACKGROUND_COLORS,
  BORDER_COLORS,
  TEXT_COLORS,
} from "@/constants/colors"

import { GRID_PADDING } from "./gridLayout"

// How long the fade in/out transition takes, in milliseconds.
export const FADE_DURATION_MS = 200

interface PaginationBarProps {
  // Zero-indexed current page number
  currentPage: number
  // Total number of pages
  totalPages: number
  // Whether the bar should be shown right now; toggling fades it in/out.
  isVisible: boolean
  // Callback function to navigate to the previous page
  onPrevious: VoidFunction
  // Callback function to navigate to the next page
  onNext: VoidFunction
}

export const PaginationBar = ({
  currentPage,
  totalPages,
  isVisible,
  onPrevious,
  onNext,
}: PaginationBarProps) => {
  const isFirstPage = currentPage === 0
  const isLastPage = currentPage === totalPages - 1
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: isVisible ? 1 : 0,
      duration: FADE_DURATION_MS,
      useNativeDriver: false,
    })
    animation.start()

    return () => {
      animation.stop()
    }
  }, [isVisible, opacity])

  const previousAccessibilityState = { disabled: isFirstPage }
  const nextAccessibilityState = { disabled: isLastPage }

  return (
    <Animated.View
      testID="pagination-bar"
      style={[styles.overlay, { opacity }]}
      pointerEvents={isVisible ? "box-none" : "none"}
    >
      <View style={styles.pill}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.buttonLeft,
            isFirstPage ? styles.buttonDisabled : undefined,
          ]}
          onPress={onPrevious}
          disabled={isFirstPage}
          accessibilityLabel="Previous page"
          accessibilityRole="button"
          accessibilityState={previousAccessibilityState}
        >
          <ChevronLeftIcon color={TEXT_COLORS.paginationIcon} />
        </TouchableOpacity>

        <View style={styles.textContainer}>
          <Text
            style={styles.pageText}
          >{`${currentPage + 1} / ${totalPages}`}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            styles.buttonRight,
            isLastPage ? styles.buttonDisabled : undefined,
          ]}
          onPress={onNext}
          disabled={isLastPage}
          accessibilityLabel="Next page"
          accessibilityRole="button"
          accessibilityState={nextAccessibilityState}
        >
          <ChevronRightIcon color={TEXT_COLORS.paginationIcon} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: GRID_PADDING,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BACKGROUND_COLORS.elevated,
    borderRadius: BORDER_RADIUSES.medium,
    borderWidth: 1,
    borderColor: BORDER_COLORS.controlDivider,
    overflow: "hidden",
  },
  button: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonLeft: {
    borderTopLeftRadius: BORDER_RADIUSES.medium,
    borderBottomLeftRadius: BORDER_RADIUSES.medium,
    borderRightWidth: 1,
    borderRightColor: BORDER_COLORS.controlDivider,
  },
  buttonRight: {
    borderTopRightRadius: BORDER_RADIUSES.medium,
    borderBottomRightRadius: BORDER_RADIUSES.medium,
    borderLeftWidth: 1,
    borderLeftColor: BORDER_COLORS.controlDivider,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  textContainer: {
    height: 36,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  pageText: {
    color: TEXT_COLORS.light,
    fontSize: 14,
    fontWeight: "600",
    minWidth: 40,
    textAlign: "center",
  },
})
