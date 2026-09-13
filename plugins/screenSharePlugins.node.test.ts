import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"

import type { ExpoConfig } from "expo/config"
import type { ExportedConfig } from "expo/config-plugins"

// The plugins are Node-land CommonJS that expo/config-plugins loads through
// `xcode`, so they run under the Node test runner instead of the RN Jest env.
const requirePlugin = createRequire(import.meta.url)

const readPluginAsset = (...segments: string[]): string =>
  readFileSync(path.join(import.meta.dirname, ...segments), "utf8")

const baseConfig: ExpoConfig = {
  name: "NK Meet",
  slug: "nk-meet",
}

test("ships the drawable react-native-webrtc resolves by name", () => {
  const drawable = readPluginAsset("android", "ic_notification.xml")

  assert.match(drawable, /<vector/)
  assert.match(drawable, /android:pathData/)
})

test("adds a dangerous android mod that writes the drawable", () => {
  const withScreenShareNotificationIcon = requirePlugin(
    "./withScreenShareNotificationIcon",
  ) as (config: ExpoConfig) => ExportedConfig

  const config = withScreenShareNotificationIcon(baseConfig)

  assert.equal(typeof config.mods?.android?.dangerous, "function")
})

test("declares the ReplayKit extension point and principal class", () => {
  const infoPlist = readPluginAsset("ios", "BroadcastExtension", "Info.plist")

  assert.match(infoPlist, /com\.apple\.broadcast-services-upload/)
  assert.match(infoPlist, /<string>SampleHandler<\/string>/)
  assert.match(infoPlist, /RPBroadcastProcessModeSampleBuffer/)
  // The handler resolves the socket path from this key at runtime.
  assert.match(infoPlist, /RTCAppGroupIdentifier/)
})

test("shares one App Group between the extension and the host app", () => {
  const entitlements = readPluginAsset(
    "ios",
    "BroadcastExtension",
    "BroadcastExtension.entitlements",
  )

  assert.match(entitlements, /com\.apple\.security\.application-groups/)
  assert.match(entitlements, /\$\(RTC_APP_GROUP_IDENTIFIER\)/)
})

test("frames samples the way the host app's ScreenCapturer parses them", () => {
  const uploader = readPluginAsset(
    "ios",
    "BroadcastExtension",
    "SampleUploader.m",
  )

  assert.match(uploader, /Content-Length/)
  assert.match(uploader, /Buffer-Width/)
  assert.match(uploader, /Buffer-Height/)
  assert.match(uploader, /Buffer-Orientation/)
  assert.match(
    uploader,
    /CFHTTPMessageCreateResponse\([\s\S]*?200[\s\S]*?kCFHTTPVersion1_1\)/,
  )
  assert.doesNotMatch(uploader, /CFHTTPMessageCreateRequest/)
})

test("keeps a partial frame pending until the socket finishes it", () => {
  const uploader = readPluginAsset(
    "ios",
    "BroadcastExtension",
    "SampleUploader.m",
  )

  assert.match(
    uploader,
    /self\.state != SampleUploaderStateReady[\s\S]*?self\.state = SampleUploaderStateWriting[\s\S]*?self\.dataToSend = framedMessage/,
  )
  assert.match(
    uploader,
    /self\.byteIndex >= self\.dataToSend\.length[\s\S]*?self\.state = SampleUploaderStateReady/,
  )
  assert.doesNotMatch(uploader, /isReady = !\[.*sendNonBlocking\]/)
})

test("bounds ReplayKit encoding work for sustained screen sharing", () => {
  const uploader = readPluginAsset(
    "ios",
    "BroadcastExtension",
    "SampleUploader.m",
  )

  assert.match(uploader, /kMaximumFrameDimension = 1920/)
  assert.match(uploader, /kMinimumFrameInterval = 1\.0 \/ 15\.0/)
  assert.match(uploader, /imageByApplyingTransform/)
  assert.doesNotMatch(uploader, /kJpegCompressionQuality = 1\.0/)
})

test("refuses to configure the target without an App Group", () => {
  const withIosBroadcastExtension = requirePlugin(
    "./withIosBroadcastExtension",
  ) as (
    config: ExpoConfig,
    options?: { appGroupIdentifier?: string },
  ) => ExportedConfig

  assert.throws(
    () => withIosBroadcastExtension(baseConfig),
    /appGroupIdentifier/,
  )
})
