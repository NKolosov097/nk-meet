import { StyleSheet, Text, View } from "react-native"

import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"
import { companyDisplayName } from "@/constants/company"
import { COMPANY_ICONS } from "@/constants/companyIcons"

interface CompanyIconProps {
  // Canonical company id whose icon should be rendered
  company: string
}

const ICON_HEIGHT = 50
const WORD_BOUNDARY_PATTERN =
  /[^a-zA-Z0-9]+|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/

// Derives up to two uppercase initials from a company's display name.
const companyInitials = (displayName: string): string => {
  const words = displayName.split(WORD_BOUNDARY_PATTERN).filter(Boolean)

  if (words.length === 0) return ""
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return `${words[0][0]}${words[1][0]}`.toUpperCase()
}

export const CompanyIcon = ({ company }: CompanyIconProps) => {
  const displayName = companyDisplayName(company)
  const label = `${displayName} company`
  const entry = COMPANY_ICONS[company]

  if (entry) {
    const { Icon, aspectRatio } = entry

    return (
      <View
        style={[styles.wrapper, { aspectRatio }]}
        accessibilityRole="image"
        accessibilityLabel={label}
      >
        <Icon color={TEXT_COLORS.light} />
      </View>
    )
  }

  return (
    <View
      style={[styles.wrapper, styles.fallback]}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Text style={styles.fallbackText}>{companyInitials(displayName)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    height: ICON_HEIGHT,
  },
  fallback: {
    aspectRatio: 1,
    backgroundColor: BACKGROUND_COLORS.secondary,
    borderRadius: BORDER_RADIUSES.medium,
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackText: {
    color: TEXT_COLORS.light,
    fontSize: 16,
    fontWeight: "600",
  },
})
