// Types for the LiveKit React Native application

export type InputDeviceKind = "audioinput" | "videoinput"

export interface ConnectionState {
  // Access token of the current session; null means "not in a room"
  token: string | null
  // Message from the most recent failed connection attempt, if any
  error?: string
  // Media choices captured before connecting to the room
  media?: PreJoinMediaSettings
}

export interface PreJoinMediaSettings {
  // Whether microphone publishing starts immediately after connection
  microphoneEnabled: boolean
  // Whether camera publishing starts immediately after connection
  cameraEnabled: boolean
  // Selected microphone identifier, when one is available
  microphoneDeviceId?: string
  // Selected camera identifier, when one is available
  cameraDeviceId?: string
}
