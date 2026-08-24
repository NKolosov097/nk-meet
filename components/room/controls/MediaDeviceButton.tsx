import type { ReactNode } from "react"
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type AccessibilityState,
} from "react-native"

import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import {
  BACKGROUND_COLORS,
  BORDER_COLORS,
  TEXT_COLORS,
} from "@/constants/colors"

interface MediaDeviceButtonProps {
  // State icon displayed at the left edge, or centered without text
  icon: ReactNode
  // Optional label used by the wider pre-join variant
  text?: string
  // Toggles the microphone or camera state
  onToggle: VoidFunction
  // Opens or closes the related device list
  onToggleDropdown: VoidFunction
  // Accessible action name for the main button
  toggleAccessibilityLabel: string
  // Accessible action name for the dropdown button
  dropdownAccessibilityLabel: string
  // Whether the microphone/camera toggle rejects interaction
  disabled: boolean
  // Whether device selection separately rejects interaction
  dropdownDisabled?: boolean
  // Whether the related device list is currently visible
  isDropdownVisible: boolean
  // Additional state exposed by the dropdown button
  dropdownAccessibilityState?: AccessibilityState
}

export const MediaDeviceButton = ({
  icon,
  text,
  onToggle,
  onToggleDropdown,
  toggleAccessibilityLabel,
  dropdownAccessibilityLabel,
  disabled,
  dropdownDisabled = false,
  isDropdownVisible,
  dropdownAccessibilityState,
}: MediaDeviceButtonProps) => {
  const hasText = text !== undefined

  return (
    <View style={[styles.container, hasText ? styles.labeledContainer : null]}>
      <TouchableOpacity
        style={[
          styles.toggleButton,
          hasText ? styles.labeledToggleButton : styles.iconOnlyToggleButton,
          disabled ? styles.disabledButton : null,
        ]}
        onPress={onToggle}
        disabled={disabled}
        accessibilityLabel={toggleAccessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        <View
          testID="media-device-button-icon"
          style={hasText ? styles.labeledIcon : styles.iconOnlyIcon}
        >
          {icon}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.dropdownButton,
          dropdownDisabled ? styles.disabledButton : null,
        ]}
        onPress={onToggleDropdown}
        disabled={dropdownDisabled}
        accessibilityLabel={dropdownAccessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{
          ...dropdownAccessibilityState,
          disabled: dropdownDisabled,
          expanded: isDropdownVisible,
        }}
      >
        <Text
          style={[
            styles.dropdownArrow,
            isDropdownVisible ? styles.dropdownArrowUp : null,
          ]}
        >
          ▼
        </Text>
      </TouchableOpacity>

      {hasText && (
        <View
          testID="media-device-button-label"
          pointerEvents="none"
          style={styles.labelOverlay}
        >
          <Text testID="media-device-button-text" style={styles.text}>
            {text}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    position: "relative",
  },
  labeledContainer: {
    width: "100%",
  },
  toggleButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BACKGROUND_COLORS.secondary,
    borderTopLeftRadius: BORDER_RADIUSES.medium,
    borderBottomLeftRadius: BORDER_RADIUSES.medium,
  },
  labeledToggleButton: {
    flex: 1,
    position: "relative",
  },
  iconOnlyToggleButton: {
    width: 44,
  },
  labeledIcon: {
    position: "absolute",
    left: 12,
  },
  iconOnlyIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    textAlign: "center",
    color: TEXT_COLORS.light,
    fontWeight: "600",
  },
  labelOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownButton: {
    width: 32,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BACKGROUND_COLORS.secondary,
    borderLeftWidth: 1,
    borderLeftColor: BORDER_COLORS.controlDivider,
    borderTopRightRadius: BORDER_RADIUSES.medium,
    borderBottomRightRadius: BORDER_RADIUSES.medium,
  },
  disabledButton: {
    opacity: 0.4,
  },
  dropdownArrow: {
    color: TEXT_COLORS.light,
    fontSize: 11,
    fontWeight: "bold",
  },
  dropdownArrowUp: {
    transform: [{ rotate: "180deg" }],
  },
})
