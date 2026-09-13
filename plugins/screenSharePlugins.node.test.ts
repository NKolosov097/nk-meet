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
const screenShareProtocol = requirePlugin("./screenShareProtocol") as {
  notificationName: (
    namespace: string,
    requestID: string,
    event: "starting" | "ready" | "failed",
  ) => string
  beginOnce: (alreadyBegan: boolean) => boolean
  canUseNetworkThread: (networkThreadStarted: boolean) => boolean
  shouldCancelPickerRequest: (state: {
    extensionStarted: boolean
    requestPending: boolean
    screenCaptured?: boolean
  }) => boolean
  frameMessage: (frame: {
    body: Buffer
    width: number
    height: number
    orientation: number
  }) => Buffer
  parseFrameMessage: (message: Buffer) => {
    body: Buffer
    width: number
    height: number
    orientation: number
  }
  nextUploaderState: (
    remainingBytes: number,
    writtenBytes: number,
  ) => "ready" | "writing" | "failed"
  nativeHeader: (namespace: string) => string
}

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
  const appSourceFiles: string[] = []
  const buildPhases: Array<{ files: string[]; type: string; target: string }> =
    []
  const buildSettings: Record<string, string> = {
    PRODUCT_NAME: '"BroadcastExtension"',
  }
  let uuid = 0
  let extensionTarget: { uuid: string; productType: string } | undefined
  let targetAddCount = 0
  let extensionGroupAddCount = 0

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
    addToPbxSourcesBuildPhase: (file: { path: string; target: string }) => {
      appSourceFiles.push(`${file.target}:${file.path}`)
    },
    getTarget: () => ({ uuid: "APP" }),
    pbxTargetByName: (name: string) =>
      name === "BroadcastExtension" ? extensionTarget : undefined,
    addPbxGroup: () => {
      extensionGroupAddCount += 1
      return { uuid: `GROUP${++uuid}` }
    },
    addTarget: () => {
      targetAddCount += 1
      extensionTarget = { uuid: "EXTENSION", productType: "app_extension" }
      return extensionTarget
    },
    addBuildPhase: (
      files: string[],
      type: string,
      _name: string,
      target: string,
    ) => {
      buildPhases.push({ files, type, target })
    },
    pbxXCBuildConfigurationSection: () => ({ extension: { buildSettings } }),
    appSourceFiles,
    get extensionGroupAddCount() {
      return extensionGroupAddCount
    },
    get targetAddCount() {
      return targetAddCount
    },
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
    const expectedHeader = screenShareProtocol.nativeHeader(
      "group.com.nkolosov.nkmeet",
    )
    assert.equal(
      readFileSync(
        path.join(iosRoot, "BroadcastExtension", "ScreenShareGenerated.h"),
        "utf8",
      ),
      expectedHeader,
    )
    assert.equal(
      readFileSync(
        path.join(iosRoot, "ScreenShareBridge", "ScreenShareGenerated.h"),
        "utf8",
      ),
      expectedHeader,
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
    const applyXcodeMod = () =>
      Promise.resolve(
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
    await applyXcodeMod()
    await applyXcodeMod()
  } catch (error) {
    throw error
  }

  assert.ok(project.sourceFiles.includes("ScreenShareBridge/BroadcastPicker.m"))
  assert.deepEqual(project.appSourceFiles, [
    "APP:ScreenShareBridge/BroadcastPicker.m",
  ])
  assert.equal(project.extensionGroupAddCount, 1)
  assert.equal(project.targetAddCount, 1)
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
  const body = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  const message = screenShareProtocol.frameMessage({
    body,
    width: 1280,
    height: 720,
    orientation: 6,
  })

  assert.equal(message.subarray(0, 17).toString(), "HTTP/1.1 200 OK\r\n")
  assert.deepEqual(screenShareProtocol.parseFrameMessage(message), {
    body,
    width: 1280,
    height: 720,
    orientation: 6,
  })
})

test("keeps a partial frame pending until the socket finishes it", () => {
  assert.equal(screenShareProtocol.nextUploaderState(100, 0), "writing")
  assert.equal(screenShareProtocol.nextUploaderState(100, 20), "writing")
  assert.equal(screenShareProtocol.nextUploaderState(100, 100), "ready")
  assert.equal(screenShareProtocol.nextUploaderState(100, -1), "failed")
})

test("uses request-scoped notifications and cancels without screen capture state", () => {
  const namespace = "group.com.nkolosov.nkmeet"
  const requestID = "request-42"

  assert.equal(
    screenShareProtocol.notificationName(namespace, requestID, "ready"),
    `${namespace}.screen-share.${requestID}.ready`,
  )
  for (const screenCaptured of [false, true]) {
    assert.equal(
      screenShareProtocol.shouldCancelPickerRequest({
        extensionStarted: false,
        requestPending: true,
        screenCaptured,
      }),
      true,
    )
  }
  assert.equal(
    screenShareProtocol.shouldCancelPickerRequest({
      extensionStarted: true,
      requestPending: true,
    }),
    false,
  )
})

test("models safe close before thread start and one-shot completion callbacks", () => {
  assert.equal(screenShareProtocol.canUseNetworkThread(false), false)
  assert.equal(screenShareProtocol.canUseNetworkThread(true), true)
  assert.equal(screenShareProtocol.beginOnce(false), true)
  assert.equal(screenShareProtocol.beginOnce(true), false)
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
