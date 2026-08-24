import { useCallback, useState } from "react"
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"

import { useFocusEffect, useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { SafeAreaView } from "react-native-safe-area-context"

import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import {
  BACKGROUND_COLORS,
  BORDER_COLORS,
  TEXT_COLORS,
} from "@/constants/colors"
import { companyDisplayName } from "@/constants/company"
import { configError } from "@/constants/env"
import { getRecentRooms, type RecentRoom } from "@/services/recentRooms"
import { generateRoomSlug, slugify } from "@/services/roomSlug"

interface HomeScreenProps {
  // Canonical company whose landing page is currently displayed
  company: string
}

const formatRecentRoomTime = (joinedAt: number): string => {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - joinedAt) / (60 * 1000)),
  )

  if (elapsedMinutes < 1) return "Just now"
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours} hr ago`
  if (elapsedHours < 48) return "Yesterday"

  return new Date(joinedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export const HomeScreen = ({ company }: HomeScreenProps) => {
  const router = useRouter()
  const [roomCode, setRoomCode] = useState<string>("")
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([])

  useFocusEffect(
    useCallback(() => {
      const loadRecentRooms = async (): Promise<void> => {
        try {
          setRecentRooms(await getRecentRooms())
        } catch (error) {
          console.error("Error loading recent rooms: ", error)
        }
      }

      loadRecentRooms()
    }, []),
  )

  const joinRoom = useCallback(
    (targetCompany: string, slug: string): void => {
      router.push(`/${targetCompany}/${slug}`)
    },
    [router],
  )

  const onJoinByCode = useCallback((): void => {
    const slug = slugify(roomCode)
    if (!slug) return
    joinRoom(company, slug)
  }, [company, roomCode, joinRoom])

  const onCreateRoom = useCallback((): void => {
    joinRoom(company, generateRoomSlug())
  }, [company, joinRoom])

  const isDisabled = configError !== null

  const renderRecentRoom = useCallback(
    ({ item }: { item: RecentRoom }) => {
      const displayCompany = companyDisplayName(item.company)
      const recentRoomAccessibilityState = { disabled: isDisabled }

      return (
        <TouchableOpacity
          style={[
            styles.recentRoomCard,
            isDisabled ? styles.recentRoomCardDisabled : undefined,
          ]}
          onPress={() => joinRoom(item.company, item.slug)}
          disabled={isDisabled}
          accessibilityLabel={`Rejoin ${item.slug} as ${item.participantName} in ${displayCompany}`}
          accessibilityRole="button"
          accessibilityState={recentRoomAccessibilityState}
        >
          <View testID="recent-room-identity" style={styles.recentRoomIdentity}>
            <Text
              testID="recent-room-company"
              style={styles.recentRoomCompany}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayCompany}
            </Text>
            <Text style={styles.recentRoomSeparator}>·</Text>
            <Text
              testID="recent-room-slug"
              style={styles.recentRoomSlug}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.slug}
            </Text>
          </View>
          <View testID="recent-room-details" style={styles.recentRoomDetails}>
            <Text style={styles.recentRoomName}>{item.participantName}</Text>
            <Text style={styles.recentRoomTime}>
              {formatRecentRoomTime(item.joinedAt)}
            </Text>
          </View>
        </TouchableOpacity>
      )
    },
    [joinRoom, isDisabled],
  )

  const isJoinDisabled = isDisabled || slugify(roomCode) === ""
  const disabledAccessibilityState = { disabled: isDisabled }
  const joinAccessibilityState = { disabled: isJoinDisabled }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          NK Meet
        </Text>
        <Text style={styles.brandBy}>by NKolosov</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Room code:</Text>
          <TextInput
            style={styles.input}
            value={roomCode}
            onChangeText={setRoomCode}
            placeholder="Enter a room code"
            placeholderTextColor={TEXT_COLORS.placeholderOnLight}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isDisabled}
            returnKeyType="go"
            onSubmitEditing={onJoinByCode}
            accessibilityLabel="Room code"
            accessibilityState={disabledAccessibilityState}
          />
        </View>

        {configError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{configError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.joinButton,
            isJoinDisabled ? styles.joinButtonDisabled : undefined,
          ]}
          onPress={onJoinByCode}
          disabled={isJoinDisabled}
          accessibilityLabel="Join room"
          accessibilityRole="button"
          accessibilityState={joinAccessibilityState}
        >
          <Text
            style={[
              styles.joinButtonText,
              isJoinDisabled ? styles.joinButtonTextDisabled : undefined,
            ]}
          >
            Join
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.createButton,
            isDisabled ? styles.joinButtonDisabled : undefined,
          ]}
          onPress={onCreateRoom}
          disabled={isDisabled}
          accessibilityLabel="Create room"
          accessibilityRole="button"
          accessibilityState={disabledAccessibilityState}
        >
          <Text
            style={[
              styles.joinButtonText,
              isDisabled ? styles.joinButtonTextDisabled : undefined,
            ]}
          >
            Create a new room
          </Text>
        </TouchableOpacity>
      </View>

      {recentRooms.length > 0 && (
        <>
          <Text accessibilityRole="header" style={styles.recentRoomsLabel}>
            Recent meetings
          </Text>
          <FlatList
            style={styles.recentRoomsList}
            data={recentRooms}
            keyExtractor={item => `${item.company}:${item.slug}`}
            renderItem={renderRecentRoom}
          />
        </>
      )}

      <StatusBar style="light" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_COLORS.background },
  content: { padding: 20 },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
    color: TEXT_COLORS.light,
  },
  brandBy: {
    color: TEXT_COLORS.placeholder,
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  inputContainer: { marginBottom: 20 },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: TEXT_COLORS.light,
  },
  input: {
    backgroundColor: TEXT_COLORS.light,
    borderWidth: 1,
    borderColor: BORDER_COLORS.lightBorder,
    borderRadius: BORDER_RADIUSES.medium,
    padding: 15,
    fontSize: 16,
    color: TEXT_COLORS.secondary,
    minHeight: 50,
  },
  errorContainer: {
    backgroundColor: BACKGROUND_COLORS.tertiary,
    borderRadius: BORDER_RADIUSES.medium,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: BORDER_COLORS.danger,
  },
  errorText: { color: TEXT_COLORS.danger, fontSize: 14, fontWeight: "500" },
  joinButton: {
    backgroundColor: BACKGROUND_COLORS.primary,
    borderRadius: BORDER_RADIUSES.medium,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
    minHeight: 56,
    justifyContent: "center",
  },
  createButton: {
    backgroundColor: BACKGROUND_COLORS.secondary,
    borderRadius: BORDER_RADIUSES.medium,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
    minHeight: 56,
    justifyContent: "center",
  },
  joinButtonDisabled: { backgroundColor: BACKGROUND_COLORS.disabled },
  joinButtonText: {
    color: TEXT_COLORS.onPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  joinButtonTextDisabled: { color: TEXT_COLORS.disabled },
  recentRoomsLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    marginHorizontal: 20,
    color: TEXT_COLORS.light,
  },
  recentRoomsList: { flex: 1, paddingHorizontal: 20 },
  recentRoomCard: {
    backgroundColor: BACKGROUND_COLORS.lightBackground,
    borderWidth: 1,
    borderColor: BORDER_COLORS.divider,
    borderLeftWidth: 3,
    borderLeftColor: BACKGROUND_COLORS.primary,
    borderRadius: BORDER_RADIUSES.large,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  recentRoomCardDisabled: { opacity: 0.4 },
  recentRoomIdentity: {
    flexDirection: "row",
    alignItems: "center",
  },
  recentRoomCompany: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLORS.light,
    flexShrink: 1,
  },
  recentRoomSeparator: {
    color: TEXT_COLORS.placeholder,
    marginHorizontal: 6,
  },
  recentRoomSlug: {
    fontSize: 14,
    color: TEXT_COLORS.placeholder,
    flex: 1,
  },
  recentRoomDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 12,
  },
  recentRoomTime: { fontSize: 12, color: TEXT_COLORS.placeholder },
  recentRoomName: {
    fontSize: 14,
    color: TEXT_COLORS.placeholder,
    flex: 1,
  },
})
