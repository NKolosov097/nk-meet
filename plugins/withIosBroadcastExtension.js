const { copyFileSync, mkdirSync, readdirSync } = require("node:fs")
const path = require("node:path")

const { withDangerousMod, withXcodeProject } = require("expo/config-plugins")

const TARGET_NAME = "BroadcastExtension"
const SOURCE_DIR = path.join(__dirname, "ios", TARGET_NAME)
const INFO_PLIST_FILE_NAME = "Info.plist"
const ENTITLEMENTS_FILE_NAME = `${TARGET_NAME}.entitlements`
const APP_GROUP_BUILD_SETTING = "RTC_APP_GROUP_IDENTIFIER"

// Copies the ReplayKit extension sources next to the generated Xcode project.
const withBroadcastExtensionSources = config =>
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

      return iosConfig
    },
  ])

// Registers the copied sources as an app-extension target that the host app
// embeds. Screen sharing on iOS goes through ReplayKit, which only hands
// frames to a separate extension process.
const withBroadcastExtensionTarget = (config, { appGroupIdentifier }) =>
  withXcodeProject(config, iosConfig => {
    const project = iosConfig.modResults

    // prebuild runs repeatedly against the same project when --clean is off.
    if (project.pbxTargetByName(TARGET_NAME)) {
      return iosConfig
    }

    const bundleIdentifier = `${iosConfig.ios?.bundleIdentifier}.broadcast`
    const sourceFileNames = readdirSync(SOURCE_DIR).filter(fileName =>
      fileName.endsWith(".m"),
    )

    project.addPbxGroup(
      readdirSync(SOURCE_DIR),
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

  return withBroadcastExtensionTarget(withBroadcastExtensionSources(config), {
    appGroupIdentifier,
  })
}

module.exports = withIosBroadcastExtension
