const { registerGlobals } = require("@livekit/react-native")

// Uses require(), not import: ES imports hoist above this file's own
// statements, which would boot expo-router before WebRTC globals exist.
registerGlobals()

require("expo-router/entry")
