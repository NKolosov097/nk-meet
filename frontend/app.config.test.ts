import { existsSync } from "node:fs"
import path from "node:path"

import { NATIVE_CONFIG_COLORS } from "./constants/colors"

import type { ExpoConfig } from "expo/config"

test("the TypeScript Expo config preserves the complete native and web contract", () => {
  expect(existsSync(path.join(__dirname, "app.config.ts"))).toBe(true)
  expect(existsSync(path.join(__dirname, "app.json"))).toBe(false)

  const appConfig = (
    require("./app.config") as {
      default: ExpoConfig
    }
  ).default

  expect(appConfig).toEqual({
    name: "NK Meet",
    slug: "nk-meet",
    scheme: "nk-meet",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription:
          "This app needs access to camera to enable video calls",
        NSMicrophoneUsageDescription:
          "This app needs access to microphone to enable audio calls",
        UIBackgroundModes: ["audio"],
        RTCAppGroupIdentifier: "group.com.nkolosov.nkmeet",
        RTCScreenSharingExtension: "com.nkolosov.nkmeet.broadcast",
      },
      entitlements: {
        "com.apple.security.application-groups": ["group.com.nkolosov.nkmeet"],
      },
      bundleIdentifier: "com.nkolosov.nkmeet",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: NATIVE_CONFIG_COLORS.adaptiveIconBackground,
      },
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.WAKE_LOCK",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
      ],
      package: "com.nkolosov.nkmeet",
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      [
        "@livekit/react-native-expo-plugin",
        {
          android: {
            audioType: "communication",
            enableScreenShareService: true,
          },
        },
      ],
      "./plugins/withScreenShareNotificationIcon",
      [
        "./plugins/withIosBroadcastExtension",
        {
          appGroupIdentifier: "group.com.nkolosov.nkmeet",
        },
      ],
      "expo-router",
      [
        "expo-status-bar",
        {
          style: "light",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          resizeMode: "contain",
          backgroundColor: NATIVE_CONFIG_COLORS.splashBackground,
        },
      ],
    ],
  })
})
