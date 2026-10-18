// a11y:app/[company]/[slug].tsx
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

type LiveKitBoundaryProps = PropsWithChildren<LiveKitRoomProps>

interface ActiveRoomStubProps {
  // Company the active-room registry receives
  company: string
  // Visible room slug the active-room registry receives
  roomSlug: string
  // Callback invoked by an incoming-link disconnect
  onForcedDisconnect: VoidFunction
}

let mockCompany: string | undefined = "nkolosov"
let mockSlug: string | undefined = "weekly-sync"
let mockCanGoBack = true
let mockActiveRoom: { company: string; slug: string } | null = null
let latestLiveKitProps: LiveKitBoundaryProps | undefined
let latestActiveRoomProps: ActiveRoomStubProps | undefined
const mockBack = jest.fn()
const mockReplace = jest.fn()

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ company: mockCompany, slug: mockSlug }),
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack,
  }),
}))

jest.mock("@/constants/env", () => ({
  env: { serverUrl: "wss://integration.livekit.cloud" },
  configError: null,
}))

jest.mock("@/services/livekitToken", () => ({
  getRoom: jest.fn(() =>
    Promise.resolve({ company: "nkolosov", slug: "weekly-sync" }),
  ),
  verifyHostCode: jest.fn(() => Promise.resolve({ codeVersion: 1 })),
  changeHostCode: jest.fn(() => Promise.resolve({ codeVersion: 2 })),
  revokeHostAccess: jest.fn(() => Promise.resolve()),
  fetchParticipantToken: jest.fn(),
}))

jest.mock("@/services/recentRooms", () => ({
  getRecentRoom: jest.fn(() => Promise.resolve(null)),
  saveRecentRoom: jest.fn(() => Promise.resolve()),
}))

jest.mock("@/services/activeRoomConnection", () => ({
  getActiveRoomIdentity: () => mockActiveRoom,
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

jest.mock("@/components/room/ActiveRoom", () => ({
  ActiveRoom: (props: ActiveRoomStubProps) => {
    const React = jest.requireActual("react")
    const { Button, Text, View } = jest.requireActual("react-native")
    latestActiveRoomProps = props

    return React.createElement(
      View,
      null,
      React.createElement(
        Text,
        null,
        `Active room: ${props.company}/${props.roomSlug}`,
      ),
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
    VideoView: () => null,
    isTrackReference: (trackRef: { publication?: unknown }) =>
      Boolean(trackRef.publication),
    useTrackMutedIndicator: () => ({ isMuted: false }),
    LiveKitRoom: (props: LiveKitBoundaryProps) => {
      latestLiveKitProps = props

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
      )
    },
  }
})

const { fetchParticipantToken: mockFetchParticipantToken } = jest.requireMock(
  "@/services/livekitToken",
) as { fetchParticipantToken: jest.Mock }

const joinRoom = async (): Promise<void> => {
  await fireEvent.changeText(screen.getByLabelText("Participant name"), "Ada")
  await fireEvent.press(screen.getByLabelText("Join room"))
  await waitFor(() => expect(latestLiveKitProps).toBeDefined())
}

beforeEach(() => {
  mockCompany = "nkolosov"
  mockSlug = "weekly-sync"
  mockCanGoBack = true
  mockActiveRoom = null
  latestLiveKitProps = undefined
  latestActiveRoomProps = undefined
  mockBack.mockReset()
  mockReplace.mockReset()
  mockFetchParticipantToken.mockReset().mockResolvedValue({
    participantToken: "token-abc",
    serverUrl: "wss://integration.livekit.cloud",
    participantIdentity: "participant-1",
    role: "participant",
  })
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

test("joins the company-scoped LiveKit room and mounts ActiveRoom children", async () => {
  await render(<RoomScreen />)
  await joinRoom()

  expect(mockFetchParticipantToken).toHaveBeenCalledWith(
    "Ada",
    "nkolosov",
    "weekly-sync",
    undefined,
  )
  expect(latestLiveKitProps).toMatchObject({
    serverUrl: "wss://integration.livekit.cloud",
    token: "token-abc",
    connect: true,
    connectOptions: { maxRetries: 5 },
  })
  expect(latestLiveKitProps?.options).toEqual(
    expect.objectContaining({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: { deviceId: "mic-1" },
      videoCaptureDefaults: expect.objectContaining({ deviceId: "camera-1" }),
    }),
  )
  expect(screen.getByText("Active room: nkolosov/weekly-sync")).toBeVisible()
})

test("passes selected media choices through to LiveKit", async () => {
  await render(<RoomScreen />)
  await fireEvent.press(screen.getByLabelText("Turn on camera"))
  await joinRoom()

  expect(latestLiveKitProps).toMatchObject({
    audio: false,
    video: { deviceId: "camera-1" },
  })
})

test("uses the company identity when handling canonical duplicate routes", async () => {
  mockCompany = "Nkolosov"
  mockSlug = "Weekly Sync"
  mockActiveRoom = { company: "nkolosov", slug: "weekly-sync" }
  await render(<RoomScreen />)

  expect(mockBack).toHaveBeenCalledTimes(1)
  expect(screen.queryByLabelText("Participant name")).not.toBeOnTheScreen()
})

test("does not dismiss a same-slug route for a different company", async () => {
  mockCompany = "nkolosov-1"
  mockSlug = "Weekly Sync"
  mockActiveRoom = { company: "nkolosov-2", slug: "weekly-sync" }
  await render(<RoomScreen />)

  expect(mockBack).not.toHaveBeenCalled()
  expect(mockReplace).toHaveBeenCalledWith("/nkolosov-1/weekly-sync")
  expect(screen.getByLabelText("Participant name")).toBeVisible()
})

test("keeps navigation still when a link forced the disconnect", async () => {
  await render(<RoomScreen />)
  await joinRoom()
  const force = latestActiveRoomProps?.onForcedDisconnect
  const disconnected = latestLiveKitProps?.onDisconnected

  await act(async () => {
    force?.()
    disconnected?.()
  })

  expect(screen.getByLabelText("Participant name")).toBeVisible()
  expect(mockReplace).not.toHaveBeenCalled()
})

test("returns to its own company landing after back or disconnect", async () => {
  await render(<RoomScreen />)
  await fireEvent.press(screen.getByLabelText("Back to room selection"))
  expect(mockReplace).toHaveBeenCalledWith("/nkolosov")
  expect(mockBack).not.toHaveBeenCalled()

  mockReplace.mockReset()
  await joinRoom()
  await fireEvent.press(screen.getByLabelText("Disconnect room"))

  expect(mockReplace).toHaveBeenCalledWith("/nkolosov")
})

test("returns connection errors to the join form", async () => {
  await render(<RoomScreen />)
  await joinRoom()
  await fireEvent.press(screen.getByLabelText("Trigger room error"))

  expect(await screen.findByText("room unavailable")).toBeVisible()
})

test.each(["connected", "reconnecting", "signalReconnecting"])(
  "retains current entry on SDK media/recovery error while %s",
  async state => {
    try {
      await render(<RoomScreen />)
      await joinRoom()
      Object.defineProperty(latestLiveKitProps?.room, "state", {
        configurable: true,
        get: () => state,
      })
      await fireEvent.press(screen.getByLabelText("Trigger room error"))
      expect(
        screen.getByText("Active room: nkolosov/weekly-sync"),
      ).toBeVisible()
      expect(mockReplace).not.toHaveBeenCalled()
    } catch (error) {
      throw error
    }
  },
)

test("old SDK callbacks cannot revoke a new manual entry", async () => {
  const api = jest.requireMock("@/services/livekitToken")
  try {
    await render(<RoomScreen />)
    await joinRoom()
    const old = latestLiveKitProps
    await fireEvent.press(screen.getByLabelText("Force disconnect"))
    api.fetchParticipantToken.mockResolvedValue({
      participantToken: "new-token",
      serverUrl: "wss://integration.livekit.cloud",
      participantIdentity: "new-host",
      role: "host",
      hostAccess: "new-cap",
      codeVersion: 2,
    })
    await fireEvent.press(screen.getByText("Join as host"))
    await fireEvent.changeText(screen.getByLabelText("Host code"), "00112233")
    await joinRoom()
    api.revokeHostAccess.mockClear()
    await act(() => {
      old?.onError?.(new Error("old connect rejected"))
      old?.onDisconnected?.()
    })
    expect(screen.getByText("Active room: nkolosov/weekly-sync")).toBeVisible()
    expect(latestLiveKitProps?.token).toBe("new-token")
    expect(api.revokeHostAccess).not.toHaveBeenCalled()
  } catch (error) {
    throw error
  }
})
