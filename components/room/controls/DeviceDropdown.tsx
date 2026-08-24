import type { StyleProp, ViewStyle } from "react-native"
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"

import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import {
  BACKGROUND_COLORS,
  BORDER_COLORS,
  TEXT_COLORS,
  SHADOW_COLORS,
} from "@/constants/colors"

export interface DeviceDropdownItem {
  // Stable identifier for the media device
  deviceId: string
  // Human-readable device name displayed in the row
  label: string
  // Whether this device is currently selected
  selected: boolean
  // Selects this device and lets the owner perform switching
  onPress: VoidFunction
}

export interface DeviceDropdownSection {
  // Visible heading for this group of devices
  title: string
  // Device rows displayed under the heading
  items: readonly DeviceDropdownItem[]
}

interface DeviceDropdownProps {
  // Sections and rows supplied by the owning media control
  sections: readonly DeviceDropdownSection[]
  // Empty-state text shown when every section has no rows
  emptyMessage: string
  // Optional horizontal positioning supplied by bounded in-room layout
  positionStyle?: StyleProp<ViewStyle>
}

export const DeviceDropdown = ({
  sections,
  emptyMessage,
  positionStyle,
}: DeviceDropdownProps) => {
  const hasItems = sections.some(section => section.items.length > 0)

  return (
    <View
      testID="device-dropdown"
      style={[styles.dropdownContainer, positionStyle]}
    >
      <ScrollView style={styles.deviceList}>
        {sections.map(section => (
          <View key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map(item => (
              <TouchableOpacity
                key={item.deviceId}
                style={[
                  styles.deviceItem,
                  item.selected ? styles.selectedDevice : undefined,
                ]}
                accessibilityLabel={`${item.label} device`}
                accessibilityRole="button"
                accessibilityState={{ selected: item.selected }}
                onPress={item.onPress}
              >
                <Text
                  style={[
                    styles.deviceLabel,
                    item.selected ? styles.selectedDeviceLabel : undefined,
                  ]}
                >
                  {item.label}
                </Text>
                {item.selected && (
                  <Text
                    style={styles.selectedDeviceIndicator}
                    accessible={false}
                  >
                    ✓
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {!hasItems && <Text style={styles.noDevicesText}>{emptyMessage}</Text>}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  dropdownContainer: {
    position: "absolute",
    bottom: 48,
    backgroundColor: BACKGROUND_COLORS.secondary,
    borderRadius: BORDER_RADIUSES.medium,
    maxHeight: 400,
    shadowColor: SHADOW_COLORS.black,
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1001,
  },
  deviceList: {
    maxHeight: 350,
    borderRadius: BORDER_RADIUSES.medium,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLORS.light,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BACKGROUND_COLORS.lightBackground,
  },
  deviceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLORS.controlDivider,
  },
  selectedDevice: {
    backgroundColor: BACKGROUND_COLORS.primary,
  },
  deviceLabel: {
    fontSize: 14,
    color: TEXT_COLORS.light,
    flex: 1,
  },
  selectedDeviceLabel: {
    color: TEXT_COLORS.onPrimary,
  },
  selectedDeviceIndicator: {
    color: TEXT_COLORS.onPrimary,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
    marginLeft: 12,
  },
  noDevicesText: {
    fontSize: 14,
    color: TEXT_COLORS.light,
    textAlign: "center",
    paddingVertical: 20,
    fontStyle: "italic",
  },
})
