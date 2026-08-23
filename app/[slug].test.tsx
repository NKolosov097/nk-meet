import type { PropsWithChildren } from "react"

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native"

import type { LiveKitRoomProps } from "@livekit/react-native"

import RoomScreen from "./[slug]"

type LiveKitRoomBoundaryProps = PropsWithChildren<LiveKitRoomProps>

interface ActiveRoomStubProps {
  // Slug the room screen published for the active-room registry
  roomSlug: string
  // Callback the registry invokes when an incoming link ends this call
  onForcedDisconnect: VoidFunction
}

let mockLatestLiveKitProps: LiveKitRoomBoundaryProps | undefined
let mockLatestActiveRoomProps: ActiveRoomStubProps | undefined
let mockSlug: string | undefined = "quiet-tiger-42"
const mockBack = jest.fn()
const mockReplace = jest.fn()
let mockCanGoBack = true

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ slug: mockSlug }),
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack,
  }),
}))

jest.mock("@/services/livekitToken", () => ({
  fetchParticipantToken: jest.fn(),
}))

jest.mock("@/services/recentRooms", () => ({
  saveRecentRoom: jest.fn(),
  getRecentRooms: jest.fn(() => Promise.resolve([])),
  getRecentRoom: jest.fn(() => Promise.resolve(null)),
}))

jest.mock("livekit-client", () => ({
  ...jest.requireActual("livekit-client"),
  createLocalVideoTrack: jest.fn(() =>
    Promise.resolve({
      stop: jest.fn(),
      mediaStream: { toURL: () => "preview" },
    }),
  ),
}))

let mockActiveRoomSlug: string | null = null

jest.mock("@/services/activeRoomConnection", () => ({
  getActiveRoomSlug: () => mockActiveRoomSlug,
}))

jest.mock("@/constants/env", () => ({
  env: {
    serverUrl: "wss://integration.livekit.cloud",
    sandboxId: "integration-sandbox",
  },
  configError: null,
}))

jest.mock("@/components/room/ActiveRoom", () => ({
  ActiveRoom: (props: ActiveRoomStubProps) => {
    const React = jest.requireActual("react")
    const { Button, Text, View } = jest.requireActual("react-native")
    mockLatestActiveRoomProps = props

    return React.createElement(
      View,
      null,
      React.createElement(Text, null, `Active room: ${props.roomSlug}`),
      React.createElement(Button, {
        title: "Force disconnect",
        accessibilityLabel: "Force disconnect",
        onPress: props.onForcedDisconnect,
      }),
    )
  },
}))

jest.mock("@livekit/react-native", () => {
  const React = jest.requireActual("react")
  const { Button, View } = jest.requireActual("react-native")

  return {
    VideoTrack: () => null,
    isTrackReference: (trackRef: { publication?: unknown }) =>
      Boolean(trackRef.publication),
    useTrackMutedIndicator: () => ({ isMuted: false }),
    LiveKitRoom: (props: LiveKitRoomBoundaryProps) => {
      mockLatestLiveKitProps = props

      return React.createElement(
        View,
        null,
        props.children,
        React.createElement(Button, {
          title: "Disconnect room",
          accessibilityLabel: "Disconnect room",
          onPress: () => props.onDisconnected?.(),
        }),
        React.createElement(Button, {
          title: "Trigger room error",
          accessibilityLabel: "Trigger room error",
          onPress: () => props.onError?.(new Error("room unavailable")),
        }),
        React.createElement(Button, {
          title: "Trigger fallback room error",
          accessibilityLabel: "Trigger fallback room error",
          onPress: () => props.onError?.(undefined as never),
        }),
      )
    },
  }
})

const { fetchParticipantToken: mockFetchParticipantToken } = jest.requireMock(
  "@/services/livekitToken",
) as { fetchParticipantToken: jest.Mock<Promise<string>, [string, string]> }

const join = async () => {
  await fireEvent.changeText(
    screen.getByLabelText("Participant name"),
    "  Ada  ",
  )
  await fireEvent.press(screen.getByLabelText("Join room"))

  await waitFor(() => {
    expect(screen.getByText(/^Active room:/)).toBeVisible()
  })
}

const joinRoom = async () => {
  await render(<RoomScreen />)

  expect(screen.getByLabelText("Participant name")).toBeVisible()
  expect(screen.getByLabelText("Join room")).toBeVisible()

  await join()
}

beforeEach(() => {
  mockFetchParticipantToken.mockReset()
  mockLatestLiveKitProps = undefined
  mockLatestActiveRoomProps = undefined
  mockSlug = "quiet-tiger-42"
  mockBack.mockReset()
  mockReplace.mockReset()
  mockCanGoBack = true
  mockActiveRoomSlug = null
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: jest.fn(),
      enumerateDevices: jest.fn(() =>
        Promise.resolve([
          { deviceId: "mic-1", kind: "audioinput", label: "Microphone" },
          { deviceId: "camera-1", kind: "videoinput", label: "Camera" },
        ]),
      ),
    },
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

test("shows the slug from the route and joins with it", async () => {
  await render(<RoomScreen />)

  expect(screen.getByText(/quiet-tiger-42/)).toBeVisible()
})

test("joins the room identified by the route slug", async () => {
  mockFetchParticipantToken.mockResolvedValue("token-abc")

  await joinRoom()

  expect(mockFetchParticipantToken).toHaveBeenCalledWith(
    "Ada",
    "quiet-tiger-42",
  )
  expect(mockLatestLiveKitProps).toMatchObject({
    serverUrl: "wss://integration.livekit.cloud",
    token: "token-abc",
    connect: true,
  })
  expect(screen.getByText("Active room: quiet-tiger-42")).toBeVisible()
})

test("connects with the expected room and connect options", async () => {
  mockFetchParticipantToken.mockResolvedValue("token-abc")

  await joinRoom()

  expect(mockLatestLiveKitProps?.connectOptions).toStrictEqual({
    maxRetries: 5,
  })
  expect(mockLatestLiveKitProps?.options).toStrictEqual({
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: { deviceId: "mic-1" },
    videoCaptureDefaults: {
      deviceId: "camera-1",
      resolution: {
        width: 640,
        height: 360,
        frameRate: 20,
        aspectRatio: 16 / 9,
      },
    },
    publishDefaults: {
      simulcast: false,
      videoEncoding: {
        maxBitrate: 450_000,
        maxFramerate: 20,
        priority: undefined,
      },
    },
  })
})

test("connects with the media choices made before joining", async () => {
  mockFetchParticipantToken.mockResolvedValue("token-abc")
  await render(<RoomScreen />)

  await fireEvent.press(screen.getByLabelText("Turn on camera"))
  await fireEvent.changeText(screen.getByLabelText("Participant name"), "Ada")
  await fireEvent.press(screen.getByLabelText("Join room"))

  await waitFor(() => expect(mockLatestLiveKitProps).toBeDefined())
  expect(mockLatestLiveKitProps).toMatchObject({
    audio: false,
    video: { deviceId: "camera-1" },
    options: {
      audioCaptureDefaults: { deviceId: "mic-1" },
      videoCaptureDefaults: expect.objectContaining({ deviceId: "camera-1" }),
    },
  })
})

test("redirects to the canonical slug when the route param is not canonical", async () => {
  mockSlug = "Team Sync"

  await render(<RoomScreen />)

  expect(mockReplace).toHaveBeenCalledWith("/team-sync")
  // The redirect only fixes the URL bar — it must not delay the join form,
  // or a non-canonical link to the active room would tear down and rejoin it.
  expect(screen.getByText(/team-sync/)).toBeVisible()
  expect(screen.getByLabelText("Participant name")).toBeVisible()
  expect(mockFetchParticipantToken).not.toHaveBeenCalled()
})

test("dismisses itself instead of joining when its canonical slug duplicates the room already active", async () => {
  // +native-intent.ts already canonicalizes real links; this exercises the
  // screen's own defense-in-depth directly with a non-canonical param.
  mockSlug = "Team Sync"
  mockActiveRoomSlug = "team-sync"

  await render(<RoomScreen />)

  expect(mockBack).toHaveBeenCalledTimes(1)
  expect(mockReplace).not.toHaveBeenCalled()
  expect(screen.queryByLabelText("Participant name")).not.toBeOnTheScreen()
  expect(mockFetchParticipantToken).not.toHaveBeenCalled()
})

test("redirects rather than dismisses when there is no history to dismiss back to", async () => {
  mockSlug = "Team Sync"
  mockActiveRoomSlug = "team-sync"
  mockCanGoBack = false

  await render(<RoomScreen />)

  expect(mockBack).not.toHaveBeenCalled()
  expect(mockReplace).toHaveBeenCalledWith("/team-sync")
})

test("redirects to the home screen when the slug canonicalizes to nothing", async () => {
  mockSlug = "!!!"

  await render(<RoomScreen />)

  expect(mockReplace).toHaveBeenCalledWith("/")
  expect(screen.queryByLabelText("Participant name")).not.toBeOnTheScreen()
})

test("redirects to the home screen when the route carries no slug", async () => {
  mockSlug = undefined

  await render(<RoomScreen />)

  expect(mockReplace).toHaveBeenCalledWith("/")
})

test("navigates back after disconnecting when history allows it", async () => {
  mockFetchParticipantToken.mockResolvedValue("token-abc")
  mockCanGoBack = true

  await joinRoom()
  await fireEvent.press(screen.getByLabelText("Disconnect room"))

  await waitFor(() => {
    expect(mockBack).toHaveBeenCalledTimes(1)
  })
  expect(mockReplace).not.toHaveBeenCalled()
})

test("replaces with the home screen after disconnecting with no history", async () => {
  mockFetchParticipantToken.mockResolvedValue("token-abc")
  mockCanGoBack = false

  await joinRoom()
  await fireEvent.press(screen.getByLabelText("Disconnect room"))

  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith("/")
  })
  expect(mockBack).not.toHaveBeenCalled()
})

// The registry marks the disconnect as forced and LiveKit reports the room as
// disconnected before React can re-render, so both land in the same commit.
const forceDisconnect = async () => {
  const onForcedDisconnect = mockLatestActiveRoomProps?.onForcedDisconnect
  const onDisconnected = mockLatestLiveKitProps?.onDisconnected

  await act(async () => {
    onForcedDisconnect?.()
    onDisconnected?.()
  })
}

test("leaves navigation alone when the disconnect was forced by a new link", async () => {
  mockFetchParticipantToken.mockResolvedValue("token-abc")

  await joinRoom()
  await forceDisconnect()

  expect(screen.getByLabelText("Participant name")).toBeVisible()
  expect(mockBack).not.toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
})

test("drops the call even when a forced disconnect reports nothing back", async () => {
  mockFetchParticipantToken.mockResolvedValue("token-abc")

  await joinRoom()
  // A room that was never connected never emits Disconnected, so the forced
  // teardown itself has to clear the token.
  await fireEvent.press(screen.getByLabelText("Force disconnect"))

  expect(screen.getByLabelText("Participant name")).toBeVisible()
  expect(mockBack).not.toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
})

test("navigates again after a forced disconnect is followed by a real leave", async () => {
  mockFetchParticipantToken.mockResolvedValue("token-abc")

  await joinRoom()
  await forceDisconnect()
  await join()
  await fireEvent.press(screen.getByLabelText("Disconnect room"))

  await waitFor(() => {
    expect(mockBack).toHaveBeenCalledTimes(1)
  })
})

test("navigates on a real leave after a forced disconnect reported nothing back", async () => {
  mockFetchParticipantToken.mockResolvedValue("token-abc")

  await joinRoom()
  await fireEvent.press(screen.getByLabelText("Force disconnect"))
  await join()
  await fireEvent.press(screen.getByLabelText("Disconnect room"))

  await waitFor(() => {
    expect(mockBack).toHaveBeenCalledTimes(1)
  })
})

test("shows a room connection error and returns to the join form", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation()
  mockFetchParticipantToken.mockResolvedValue("token-abc")

  await joinRoom()
  await fireEvent.press(screen.getByLabelText("Trigger room error"))

  await waitFor(() => {
    expect(screen.getByLabelText("Participant name")).toBeVisible()
  })
  expect(await screen.findByText("room unavailable")).toBeVisible()
  expect(consoleError).toHaveBeenCalledWith(
    "Connection error: ",
    expect.any(Error),
  )
})

test("shows a fallback error when LiveKit reports no error details", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation()
  mockFetchParticipantToken.mockResolvedValue("token-abc")

  await joinRoom()
  await fireEvent.press(screen.getByLabelText("Trigger fallback room error"))

  await waitFor(() => {
    expect(screen.getByLabelText("Participant name")).toBeVisible()
  })
  expect(await screen.findByText("Failed to connect to the room")).toBeVisible()
  expect(consoleError).toHaveBeenCalledWith("Connection error: ", undefined)
})

test("clears a connection error when a later room join succeeds", async () => {
  jest.spyOn(console, "error").mockImplementation()
  mockFetchParticipantToken
    .mockResolvedValueOnce("token-abc")
    .mockResolvedValueOnce("token-def")

  await joinRoom()
  await fireEvent.press(screen.getByLabelText("Trigger room error"))
  expect(await screen.findByText("room unavailable")).toBeVisible()

  await join()

  expect(screen.queryByText("room unavailable")).not.toBeOnTheScreen()
})

test("returns to the home screen via the join screen's back button", async () => {
  mockSlug = "room-a"
  await render(<RoomScreen />)

  await fireEvent.press(screen.getByLabelText("Back to room selection"))

  expect(mockBack).toHaveBeenCalledTimes(1)
  expect(mockReplace).not.toHaveBeenCalled()
})

test("replaces with the home screen when there is no history to go back to", async () => {
  mockSlug = "room-a"
  mockCanGoBack = false
  await render(<RoomScreen />)

  await fireEvent.press(screen.getByLabelText("Back to room selection"))

  expect(mockReplace).toHaveBeenCalledWith("/")
  expect(mockBack).not.toHaveBeenCalled()
})
