import { readFileSync } from "node:fs"
import path from "node:path"

import type { ExpoConfig } from "expo/config"
import type { ExportedConfig } from "expo/config-plugins"

const readPluginAsset = (...segments: string[]): string =>
  readFileSync(path.join(__dirname, ...segments), "utf8")

const baseConfig: ExpoConfig = {
  name: "NK Meet",
  slug: "nk-meet",
}

describe("android screen-share notification icon", () => {
  it("ships the drawable react-native-webrtc resolves by name", () => {
    const drawable = readPluginAsset("android", "ic_notification.xml")

    expect(drawable).toContain("<vector")
    expect(drawable).toContain("android:pathData")
  })

  it("adds a dangerous android mod that writes the drawable", () => {
    const withScreenShareNotificationIcon =
      require("./withScreenShareNotificationIcon") as (
        config: ExpoConfig,
      ) => ExportedConfig

    const config = withScreenShareNotificationIcon(baseConfig)

    expect(config.mods?.android?.dangerous).toEqual(expect.any(Function))
  })
})

describe("ios broadcast upload extension", () => {
  it("declares the ReplayKit extension point and principal class", () => {
    const infoPlist = readPluginAsset("ios", "BroadcastExtension", "Info.plist")

    expect(infoPlist).toContain("com.apple.broadcast-services-upload")
    expect(infoPlist).toContain("<string>SampleHandler</string>")
    expect(infoPlist).toContain("RPBroadcastProcessModeSampleBuffer")
    // The handler resolves the socket path from this key at runtime.
    expect(infoPlist).toContain("RTCAppGroupIdentifier")
  })

  it("shares one App Group between the extension and the host app", () => {
    const entitlements = readPluginAsset(
      "ios",
      "BroadcastExtension",
      "BroadcastExtension.entitlements",
    )

    expect(entitlements).toContain("com.apple.security.application-groups")
    expect(entitlements).toContain("$(RTC_APP_GROUP_IDENTIFIER)")
  })

  it("frames samples the way the host app's ScreenCapturer parses them", () => {
    const uploader = readPluginAsset(
      "ios",
      "BroadcastExtension",
      "SampleUploader.m",
    )

    expect(uploader).toContain("Content-Length")
    expect(uploader).toContain("Buffer-Width")
    expect(uploader).toContain("Buffer-Height")
    expect(uploader).toContain("Buffer-Orientation")
  })

  it("refuses to configure the target without an App Group", () => {
    const withIosBroadcastExtension =
      require("./withIosBroadcastExtension") as (
        config: ExpoConfig,
        options?: { appGroupIdentifier?: string },
      ) => ExportedConfig

    expect(() => withIosBroadcastExtension(baseConfig)).toThrow(
      "appGroupIdentifier",
    )
  })
})
