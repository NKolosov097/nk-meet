import AsyncStorage from "@react-native-async-storage/async-storage"

import { slugify } from "./roomSlug"

import type { PreJoinMediaSettings } from "@/types"

const RECENT_ROOMS_KEY = "nk-meet.recent-rooms"
const MAX_RECENT_ROOMS = 20

export interface RecentRoom {
  // Canonical company selected for this room
  company: string
  // Canonical slug of the room, used to navigate back into it
  slug: string
  // Participant name last used when joining this room
  participantName: string
  // Epoch ms of the most recent successful join — determines sort order
  joinedAt: number
  // Last media choices for this room; absent on legacy stored entries
  media?: PreJoinMediaSettings
}

const isValidMedia = (value: unknown): value is PreJoinMediaSettings => {
  if (!value || typeof value !== "object") return false

  const media = value as Record<string, unknown>

  return (
    typeof media.microphoneEnabled === "boolean" &&
    typeof media.cameraEnabled === "boolean" &&
    (media.microphoneDeviceId === undefined ||
      typeof media.microphoneDeviceId === "string") &&
    (media.cameraDeviceId === undefined ||
      typeof media.cameraDeviceId === "string")
  )
}

const isCanonicalSegment = (value: unknown): value is string =>
  typeof value === "string" && value !== "" && value === slugify(value)

const isRecentRoom = (value: unknown): value is RecentRoom => {
  if (!value || typeof value !== "object") return false

  const room = value as Record<string, unknown>

  return (
    isCanonicalSegment(room.company) &&
    isCanonicalSegment(room.slug) &&
    typeof room.participantName === "string" &&
    typeof room.joinedAt === "number" &&
    Number.isFinite(room.joinedAt) &&
    room.joinedAt >= 0 &&
    (room.media === undefined || isValidMedia(room.media))
  )
}

const getStoredRooms = async (): Promise<unknown[]> => {
  try {
    const stored = await AsyncStorage.getItem(RECENT_ROOMS_KEY)
    const parsed: unknown = stored ? JSON.parse(stored) : []

    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    throw error
  }
}

// Returns [] on any storage or parse failure — a corrupt/missing cache must
// never block the home screen from rendering.
export const getRecentRooms = async (): Promise<RecentRoom[]> => {
  try {
    return (await getStoredRooms()).filter(isRecentRoom)
  } catch (error) {
    console.error("Error reading recent rooms: ", error)
    return []
  }
}

// Finds the recent room for a company and slug, or null if it has never been joined.
export const getRecentRoom = async (
  company: string,
  slug: string,
): Promise<RecentRoom | null> => {
  try {
    const rooms = await getRecentRooms()

    return (
      rooms.find(room => room.company === company && room.slug === slug) ?? null
    )
  } catch (error) {
    console.error("Error finding a recent room: ", error)
    return null
  }
}

// Upserts by company and slug, most-recent-first, capped at MAX_RECENT_ROOMS.
export const saveRecentRoom = async (
  company: string,
  slug: string,
  participantName: string,
  media?: PreJoinMediaSettings,
): Promise<void> => {
  try {
    const stored = await getStoredRooms()
    const existing = stored.filter(isRecentRoom)
    const withoutRoom = existing.filter(
      room => room.company !== company || room.slug !== slug,
    )
    const nextRoom: RecentRoom = {
      company,
      slug,
      participantName,
      joinedAt: Date.now(),
      ...(media ? { media } : {}),
    }

    if (!isRecentRoom(nextRoom)) return

    const updated: RecentRoom[] = [nextRoom, ...withoutRoom].slice(
      0,
      MAX_RECENT_ROOMS,
    )

    await AsyncStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error("Error saving a recent room: ", error)
  }
}
