const { copyFileSync, mkdirSync } = require("node:fs")
const path = require("node:path")

const { withDangerousMod } = require("expo/config-plugins")

const DRAWABLE_FILE_NAME = "ic_notification.xml"
const DRAWABLE_DIR = "app/src/main/res/drawable"

// The media projection foreground service that react-native-webrtc starts for
// screen sharing looks its small icon up by the literal name "ic_notification".
// Without that drawable the notification is rejected and capture never starts.
const withScreenShareNotificationIcon = config =>
  withDangerousMod(config, [
    "android",
    async androidConfig => {
      const drawableDir = path.join(
        androidConfig.modRequest.platformProjectRoot,
        DRAWABLE_DIR,
      )

      mkdirSync(drawableDir, { recursive: true })
      copyFileSync(
        path.join(__dirname, "android", DRAWABLE_FILE_NAME),
        path.join(drawableDir, DRAWABLE_FILE_NAME),
      )

      return androidConfig
    },
  ])

module.exports = withScreenShareNotificationIcon
