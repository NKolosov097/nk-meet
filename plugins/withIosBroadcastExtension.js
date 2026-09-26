const {
  copyFileSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} = require("node:fs")
const path = require("node:path")

const {
  IOSConfig,
  withDangerousMod,
  withXcodeProject,
} = require("expo/config-plugins")

const { nativeHeader } = require("./screenShareProtocol")

const TARGET_NAME = "BroadcastExtension"
const SOURCE_DIR = path.join(__dirname, "ios", TARGET_NAME)
const HOST_SOURCE_DIR = path.join(__dirname, "ios", "App")
const HOST_TARGET_DIR = "ScreenShareBridge"
const INFO_PLIST_FILE_NAME = "Info.plist"
const ENTITLEMENTS_FILE_NAME = `${TARGET_NAME}.entitlements`
const APP_GROUP_BUILD_SETTING = "RTC_APP_GROUP_IDENTIFIER"
const GENERATED_HEADER_FILE_NAME = "ScreenShareGenerated.h"

// Copies the ReplayKit extension sources next to the generated Xcode project.
const withBroadcastExtensionSources = (config, { appGroupIdentifier }) =>
  withDangerousMod(config, [
    "ios",
    async iosConfig => {
      const targetDir = path.join(
        iosConfig.modRequest.platformProjectRoot,
        TARGET_NAME,
      )

      mkdirSync(targetDir, { recursive: true })
      readdirSync(SOURCE_DIR).forEach(fileName => {
        copyFileSync(
          path.join(SOURCE_DIR, fileName),
          path.join(targetDir, fileName),
        )
      })
      writeFileSync(
        path.join(targetDir, GENERATED_HEADER_FILE_NAME),
        nativeHeader(appGroupIdentifier),
      )

      const hostTargetDir = path.join(
        iosConfig.modRequest.platformProjectRoot,
        HOST_TARGET_DIR,
      )
      mkdirSync(hostTargetDir, { recursive: true })
      readdirSync(HOST_SOURCE_DIR).forEach(fileName => {
        copyFileSync(
          path.join(HOST_SOURCE_DIR, fileName),
          path.join(hostTargetDir, fileName),
        )
      })
      writeFileSync(
        path.join(hostTargetDir, GENERATED_HEADER_FILE_NAME),
        nativeHeader(appGroupIdentifier),
      )

      return iosConfig
    },
  ])

// Registers the copied sources as an app-extension target that the host app
// embeds. Screen sharing on iOS goes through ReplayKit, which only hands
// frames to a separate extension process.
const withBroadcastExtensionTarget = (config, { appGroupIdentifier }) =>
  withXcodeProject(config, iosConfig => {
    const project = iosConfig.modResults
    const hostSourcePath = `${HOST_TARGET_DIR}/BroadcastPicker.m`

    IOSConfig.XcodeUtils.ensureGroupRecursively(project, HOST_TARGET_DIR)
    if (!project.hasFile(hostSourcePath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: hostSourcePath,
        groupName: HOST_TARGET_DIR,
        project,
      })
    }

    // prebuild runs repeatedly against the same project when --clean is off.
    if (project.pbxTargetByName(TARGET_NAME)) {
      return iosConfig
    }

    const bundleIdentifier = `${iosConfig.ios?.bundleIdentifier}.broadcast`
    const sourceFileNames = readdirSync(SOURCE_DIR).filter(fileName =>
      fileName.endsWith(".m"),
    )

    project.addPbxGroup(
      [...readdirSync(SOURCE_DIR), GENERATED_HEADER_FILE_NAME],
      TARGET_NAME,
      TARGET_NAME,
      '"<group>"',
    )

    const target = project.addTarget(
      TARGET_NAME,
      "app_extension",
      TARGET_NAME,
      bundleIdentifier,
    )

    project.addBuildPhase(
      sourceFileNames,
      "PBXSourcesBuildPhase",
      "Sources",
      target.uuid,
    )
    project.addBuildPhase(
      ["ReplayKit.framework"],
      "PBXFrameworksBuildPhase",
      "Frameworks",
      target.uuid,
    )

    const buildSettings = {
      CODE_SIGN_ENTITLEMENTS: `"${TARGET_NAME}/${ENTITLEMENTS_FILE_NAME}"`,
      CURRENT_PROJECT_VERSION: '"1"',
      INFOPLIST_FILE: `"${TARGET_NAME}/${INFO_PLIST_FILE_NAME}"`,
      MARKETING_VERSION: `"${iosConfig.version ?? "1.0.0"}"`,
      [APP_GROUP_BUILD_SETTING]: `"${appGroupIdentifier}"`,
      TARGETED_DEVICE_FAMILY: '"1,2"',
    }
    const configurations = project.pbxXCBuildConfigurationSection()

    Object.values(configurations).forEach(configuration => {
      if (configuration.buildSettings?.PRODUCT_NAME !== `"${TARGET_NAME}"`) {
        return
      }

      Object.assign(configuration.buildSettings, buildSettings)
    })

    return iosConfig
  })

const withIosBroadcastExtension = (config, options) => {
  const appGroupIdentifier = options?.appGroupIdentifier

  if (!appGroupIdentifier) {
    throw new Error(
      "withIosBroadcastExtension requires an appGroupIdentifier option.",
    )
  }

  const bundleIdentifier = config.ios?.bundleIdentifier
  if (!bundleIdentifier) {
    throw new Error("withIosBroadcastExtension requires ios.bundleIdentifier.")
  }

  const extra = (config.extra ??= {})
  const eas = (extra.eas ??= {})
  const build = (eas.build ??= {})
  const experimental = (build.experimental ??= {})
  const ios = (experimental.ios ??= {})
  const appExtensions = (ios.appExtensions ??= [])
  const extension = {
    targetName: TARGET_NAME,
    bundleIdentifier: `${bundleIdentifier}.broadcast`,
    entitlements: {
      "com.apple.security.application-groups": [appGroupIdentifier],
    },
  }
  const existingIndex = appExtensions.findIndex(
    item => item.targetName === TARGET_NAME,
  )
  if (existingIndex === -1) {
    appExtensions.push(extension)
  } else {
    appExtensions[existingIndex] = extension
  }

  return withBroadcastExtensionTarget(
    withBroadcastExtensionSources(config, { appGroupIdentifier }),
    { appGroupIdentifier },
  )
}

module.exports = withIosBroadcastExtension
