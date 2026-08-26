import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"

interface MeetingInfoBannerProps {
  // Canonical room slug shown as the meeting name
  roomSlug: string
  // Shared Unix timestamp marking when the meeting began
  startedAt: number
}

const formatElapsedTime = (elapsedMilliseconds: number): string => {
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMilliseconds / 1000))
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60
  const paddedMinutes = String(minutes).padStart(2, "0")
  const paddedSeconds = String(seconds).padStart(2, "0")

  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`
}

export const MeetingInfoBanner = ({
  roomSlug,
  startedAt,
}: MeetingInfoBannerProps) => {
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return (
    <View style={styles.container} accessibilityLabel="Meeting information">
      <Text
        style={styles.roomName}
        accessibilityRole="header"
        numberOfLines={1}
      >
        {roomSlug}
      </Text>
      <Text style={styles.duration}>{formatElapsedTime(now - startedAt)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BACKGROUND_COLORS.transparent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roomName: {
    color: TEXT_COLORS.light,
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 12,
  },
  duration: {
    color: TEXT_COLORS.placeholder,
    fontSize: 14,
    flexShrink: 0,
  },
})
