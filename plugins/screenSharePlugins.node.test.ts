import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import type { ExpoConfig } from "expo/config"
import type { ExportedConfig } from "expo/config-plugins"

type XcodeProject = Parameters<
  NonNullable<
    NonNullable<NonNullable<ExportedConfig["mods"]>["ios"]>["xcodeproj"]
  >
>[0]["modResults"]

// The plugins are Node-land CommonJS that expo/config-plugins loads through
// `xcode`, so they run under the Node test runner instead of the RN Jest env.
const requirePlugin = createRequire(import.meta.url)

const readPluginAsset = (...segments: string[]): string =>
  readFileSync(path.join(import.meta.dirname, ...segments), "utf8")

const createBaseConfig = (): ExpoConfig => ({
  name: "NK Meet",
  slug: "nk-meet",
})

const runDangerousMod = (
  config: ExportedConfig,
  platform: "android" | "ios",
  platformProjectRoot: string,
): Promise<ExportedConfig> => {
  const dangerousMod = config.mods?.[platform]?.dangerous
  if (!dangerousMod) {
    throw new Error(`${platform} dangerous mod was not registered`)
  }

  return Promise.resolve(
    dangerousMod({
      ...config,
      modResults: {},
      modRawConfig: createBaseConfig(),
      modRequest: {
        projectRoot: path.dirname(platformProjectRoot),
        platformProjectRoot,
        platform,
        modName: "dangerous",
        introspect: false,
      },
    }),
  )
}

const createXcodeProjectFixture = () => {
  const rootGroup = {
    children: [] as Array<{ comment: string; value: string }>,
  }
  const groups = new Map<string, typeof rootGroup>()
  const sourceFiles: string[] = []
  const buildPhases: Array<{ files: string[]; type: string; target: string }> =
    []
  const buildSettings: Record<string, string> = {
    PRODUCT_NAME: '"BroadcastExtension"',
  }
  let uuid = 0

  return {
    sourceFiles,
    buildPhases,
    buildSettings,
    getFirstProject: () => ({ firstProject: { mainGroup: "ROOT" } }),
    getPBXGroupByKey: (key: string) =>
      key === "ROOT" ? rootGroup : groups.get(key),
    pbxGroupByName: (name: string) => groups.get(name),
    pbxCreateGroup: (name: string) => {
      groups.set(name, { children: [] })
      return name
    },
    hasFile: (filePath: string) => sourceFiles.includes(filePath),
    generateUuid: () => `UUID${++uuid}`,
    addToPbxFileReferenceSection: (file: { path: string }) => {
      sourceFiles.push(file.path)
    },
    addToPbxBuildFileSection: () => undefined,
    addToPbxSourcesBuildPhase: () => undefined,
    getTarget: () => ({ uuid: "APP" }),
    pbxTargetByName: () => undefined,
    addPbxGroup: () => ({ uuid: `GROUP${++uuid}` }),
    addTarget: () => ({ uuid: "EXTENSION", productType: "app_extension" }),
    addBuildPhase: (
      files: string[],
      type: string,
      _name: string,
      target: string,
    ) => {
      buildPhases.push({ files, type, target })
    },
    pbxXCBuildConfigurationSection: () => ({ extension: { buildSettings } }),
  }
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

  const config = withScreenShareNotificationIcon(createBaseConfig())

  assert.equal(typeof config.mods?.android?.dangerous, "function")
})

test("applies native screen-share sources to a generated project fixture", async () => {
  const fixtureRoot = mkdtempSync(
    path.join(os.tmpdir(), "nk-meet-screen-share-"),
  )
  const androidRoot = path.join(fixtureRoot, "android")
  const iosRoot = path.join(fixtureRoot, "ios")
  mkdirSync(androidRoot)
  mkdirSync(iosRoot)

  try {
    const withNotificationIcon = requirePlugin(
      "./withScreenShareNotificationIcon",
    ) as (config: ExpoConfig) => ExportedConfig
    const withBroadcastExtension = requirePlugin(
      "./withIosBroadcastExtension",
    ) as (
      config: ExpoConfig,
      options: { appGroupIdentifier: string },
    ) => ExportedConfig

    await runDangerousMod(
      withNotificationIcon(createBaseConfig()),
      "android",
      androidRoot,
    )
    await runDangerousMod(
      withBroadcastExtension(createBaseConfig(), {
        appGroupIdentifier: "group.com.nkolosov.nkmeet",
      }),
      "ios",
      iosRoot,
    )

    assert.match(
      readFileSync(
        path.join(androidRoot, "app/src/main/res/drawable/ic_notification.xml"),
        "utf8",
      ),
      /<vector/,
    )
    assert.match(
      readFileSync(
        path.join(iosRoot, "BroadcastExtension", "SampleHandler.h"),
        "utf8",
      ),
      /RPBroadcastSampleHandler/,
    )
    assert.match(
      readFileSync(
        path.join(iosRoot, "ScreenShareBridge", "BroadcastPicker.m"),
        "utf8",
      ),
      /RCT_EXPORT_METHOD\(present/,
    )
  } catch (error) {
    throw error
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
})

test("registers the host bridge and extension implementation in Xcode build phases", async () => {
  const withBroadcastExtension = requirePlugin(
    "./withIosBroadcastExtension",
  ) as (
    config: ExpoConfig,
    options: { appGroupIdentifier: string },
  ) => ExportedConfig
  const project = createXcodeProjectFixture()
  const config = withBroadcastExtension(
    {
      ...createBaseConfig(),
      version: "1.2.3",
      ios: { bundleIdentifier: "com.nkolosov.nkmeet" },
    },
    { appGroupIdentifier: "group.com.nkolosov.nkmeet" },
  )
  const xcodeMod = config.mods?.ios?.xcodeproj
  if (!xcodeMod) {
    throw new Error("iOS Xcode mod was not registered")
  }

  try {
    await Promise.resolve(
      xcodeMod({
        ...config,
        modResults: project as XcodeProject,
        modRawConfig: createBaseConfig(),
        modRequest: {
          projectRoot: "fixture",
          platformProjectRoot: "fixture/ios",
          platform: "ios",
          modName: "xcodeproj",
          introspect: false,
        },
      }),
    )
  } catch (error) {
    throw error
  }

  assert.ok(project.sourceFiles.includes("ScreenShareBridge/BroadcastPicker.m"))
  assert.deepEqual(
    project.buildPhases.filter(phase => phase.target === "EXTENSION"),
    [
      {
        files: ["SampleHandler.m", "SampleUploader.m", "SocketConnection.m"],
        type: "PBXSourcesBuildPhase",
        target: "EXTENSION",
      },
      {
        files: ["ReplayKit.framework"],
        type: "PBXFrameworksBuildPhase",
        target: "EXTENSION",
      },
    ],
  )
  assert.equal(
    project.buildSettings.RTC_APP_GROUP_IDENTIFIER,
    '"group.com.nkolosov.nkmeet"',
  )
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

test("allows the host listener to start after ReplayKit confirms selection", () => {
  const connection = readPluginAsset(
    "ios",
    "BroadcastExtension",
    "SocketConnection.m",
  )

  assert.match(connection, /kHostConnectRetryCount = 40/)
  assert.match(
    connection,
    /connectionError != ENOENT && connectionError != ECONNREFUSED/,
  )
  assert.match(connection, /usleep\(kHostConnectRetryDelayMicroseconds\)/)
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
    () => withIosBroadcastExtension(createBaseConfig()),
    /appGroupIdentifier/,
  )
})
