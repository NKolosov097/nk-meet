const { getDefaultConfig } = require("expo/metro-config")

const config = getDefaultConfig(__dirname)

// expo-router bundles every module under app/ as a route candidate, with no
// built-in test-file exclusion — left unblocked, Metro would pull in
// expo-router/testing-library, which crashes the native bundle.
config.resolver.blockList = [
  ...config.resolver.blockList,
  /\.(test|spec)\.[jt]sx?$/,
]

module.exports = config
