import { useEffect } from "react"
import { LogBox } from "react-native"

import { addEventListener } from "expo-linking"
import { Stack, type NativeStackNavigationOptions } from "expo-router"

import { SafeAreaProvider } from "react-native-safe-area-context"

import { GridPreview } from "@/components/room/grid/GridPreview"
import { disconnectActiveRoom } from "@/services/activeRoomConnection"
import { parseMeetingPath } from "@/services/roomSlug"

const stackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
}

export default function RootLayout() {
  const isGridPreview = process.env.EXPO_PUBLIC_GRID_PREVIEW === "1"

  useEffect(() => {
    LogBox.ignoreLogs([
      "An event listener wasn't added because it has been added already",
      "Warning: WebRTC",
    ])
  }, [])

  useEffect(() => {
    // Tears down a call the link is navigating away from; expo-router
    // handles the navigation itself.
    const subscription = addEventListener("url", ({ url }) => {
      disconnectActiveRoom(parseMeetingPath(url))
    })

    return () => subscription.remove()
  }, [])

  if (isGridPreview) {
    return (
      <SafeAreaProvider>
        <GridPreview />
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={stackScreenOptions} />
    </SafeAreaProvider>
  )
}
