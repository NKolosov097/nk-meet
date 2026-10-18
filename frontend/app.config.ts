import { NATIVE_CONFIG_COLORS } from "./constants/colors.ts"

import type { ExpoConfig } from "expo/config"

const BUNDLE_IDENTIFIER = "com.nkolosov.nkmeet"
// Shared container the ReplayKit broadcast extension and the app talk over
const IOS_APP_GROUP = `group.${BUNDLE_IDENTIFIER}`
const IOS_BROADCAST_EXTENSION = `${BUNDLE_IDENTIFIER}.broadcast`

const appConfig: ExpoConfig = {
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
      RTCAppGroupIdentifier: IOS_APP_GROUP,
      RTCScreenSharingExtension: IOS_BROADCAST_EXTENSION,
    },
    entitlements: {
      "com.apple.security.application-groups": [IOS_APP_GROUP],
    },
    bundleIdentifier: BUNDLE_IDENTIFIER,
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
    package: BUNDLE_IDENTIFIER,
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
        appGroupIdentifier: IOS_APP_GROUP,
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
}

export default appConfig
