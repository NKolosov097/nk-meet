import type { PropsWithChildren } from "react"

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native"

import type { LiveKitRoomProps } from "@livekit/react-native"

import RoomScreen from "./[company]/[slug]"

type LiveKitBoundaryProps = PropsWithChildren<LiveKitRoomProps>

let mockCompany: string | undefined = "nkolosov"
let mockSlug: string | undefined = "weekly-sync"
let latestLiveKitProps: LiveKitBoundaryProps | undefined
let mockCameraEnabled = false
let mockMicrophoneEnabled = true
const mockReplace = jest.fn()
const mockBack = jest.fn()

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ company: mockCompany, slug: mockSlug }),
  useRouter: () => ({
    replace: mockReplace,
    back: mockBack,
    canGoBack: () => true,
  }),
}))

jest.mock("@/constants/env", () => ({
  env: { serverUrl: "wss://e2e.livekit.cloud" },
  configError: null,
}))

jest.mock("@/services/livekitToken", () => ({
  fetchParticipantToken: jest.fn(),
}))

jest.mock("@/services/recentRooms", () => ({
  getRecentRoom: jest.fn(() => Promise.resolve(null)),
  saveRecentRoom: jest.fn(() => Promise.resolve()),
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

const mockLocalParticipant = {
  setCameraEnabled: jest.fn<Promise<void>, [boolean]>(),
  setMicrophoneEnabled: jest.fn<Promise<void>, [boolean]>(),
  attributes: {} as Record<string, string>,
  setAttributes: jest.fn<Promise<void>, [Record<string, string>]>(),
}

const mockRoom = {
  disconnect: jest.fn<Promise<void>, []>(),
  getActiveDevice: jest.fn<string | undefined, [MediaDeviceKind]>(),
  switchActiveDevice: jest.fn<Promise<void>, [MediaDeviceKind, string]>(),
  on: jest.fn(),
  off: jest.fn(),
  localParticipant: mockLocalParticipant,
  remoteParticipants: new Map(),
}

jest.mock("@livekit/react-native", () => {
  const React = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")

  return {
    useRoomContext: () => mockRoom,
    useLocalParticipant: () => ({
      isCameraEnabled: mockCameraEnabled,
      isMicrophoneEnabled: mockMicrophoneEnabled,
      localParticipant: mockLocalParticipant,
    }),
    useTracks: () => [],
    useTrackMutedIndicator: () => ({ isMuted: false }),
    useIsSpeaking: () => false,
    isTrackReference: (trackRef: { publication?: unknown }) =>
      Boolean(trackRef.publication),
    VideoTrack: () => null,
    VideoView: () => null,
    LiveKitRoom: (props: LiveKitBoundaryProps) => {
      latestLiveKitProps = props

      return React.createElement(View, null, props.children)
    },
  }
})

const { fetchParticipantToken: mockFetchParticipantToken } = jest.requireMock(
  "@/services/livekitToken",
) as { fetchParticipantToken: jest.Mock<Promise<string>, [string, string]> }

const joinAsParticipant = async (name: string): Promise<void> => {
  await fireEvent.changeText(screen.getByLabelText("Participant name"), name)
  await fireEvent.press(screen.getByLabelText("Join room"))
  await waitFor(() => expect(latestLiveKitProps).toBeDefined())
}

beforeEach(() => {
  mockCompany = "nkolosov"
  mockSlug = "weekly-sync"
  latestLiveKitProps = undefined
  mockCameraEnabled = false
  mockMicrophoneEnabled = true
  mockReplace.mockReset()
  mockBack.mockReset()
  mockFetchParticipantToken.mockReset().mockResolvedValue("token-abc")
  mockRoom.disconnect.mockReset().mockResolvedValue(undefined)
  mockRoom.getActiveDevice.mockReset().mockReturnValue(undefined)
  mockRoom.switchActiveDevice.mockReset().mockResolvedValue(undefined)
  mockLocalParticipant.attributes = {}
  mockLocalParticipant.setAttributes.mockReset().mockResolvedValue(undefined)
  mockLocalParticipant.setCameraEnabled.mockReset().mockResolvedValue(undefined)
  mockLocalParticipant.setMicrophoneEnabled
    .mockReset()
    .mockResolvedValue(undefined)
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: jest.fn(),
      enumerateDevices: jest.fn(() => Promise.resolve([])),
    },
  })
})

test("walks the full call lifecycle: join, enable camera, disconnect", async () => {
  const view = await render(<RoomScreen />)
  await joinAsParticipant("Ada")

  expect(mockFetchParticipantToken).toHaveBeenCalledWith(
    "Ada",
    "nkolosov--weekly-sync",
  )
  expect(view.getByTestId("active-room")).toBeVisible()
  expect(view.getByText("No participants in the room")).toBeVisible()

  await fireEvent.press(view.getByLabelText("Turn on camera"))

  await waitFor(() => {
    expect(mockLocalParticipant.setCameraEnabled).toHaveBeenCalledWith(true)
  })

  mockCameraEnabled = true
  await view.rerender(<RoomScreen />)

  expect(view.getByLabelText("Turn off camera")).toBeVisible()

  await fireEvent.press(view.getByLabelText("Disconnect from room"))
  await fireEvent.press(view.getByLabelText("Confirm disconnect"))

  await waitFor(() => expect(mockRoom.disconnect).toHaveBeenCalledTimes(1))
  await act(async () => {
    latestLiveKitProps?.onDisconnected?.()
  })

  expect(mockReplace).toHaveBeenCalledWith("/nkolosov")
  expect(view.getByLabelText("Participant name")).toBeVisible()
})

test("returns to the join screen with the connection error message", async () => {
  const view = await render(<RoomScreen />)
  await joinAsParticipant("Ada")

  await act(async () => {
    latestLiveKitProps?.onError?.(new Error("room unavailable"))
  })

  expect(await view.findByText("room unavailable")).toBeVisible()
  expect(view.getByLabelText("Participant name")).toBeVisible()
})

test("supports joining again after a disconnect", async () => {
  const view = await render(<RoomScreen />)
  await joinAsParticipant("Ada")

  await fireEvent.press(view.getByLabelText("Disconnect from room"))
  await fireEvent.press(view.getByLabelText("Confirm disconnect"))
  await waitFor(() => expect(mockRoom.disconnect).toHaveBeenCalledTimes(1))
  await act(async () => {
    latestLiveKitProps?.onDisconnected?.()
  })

  mockFetchParticipantToken.mockResolvedValue("token-def")
  latestLiveKitProps = undefined
  await joinAsParticipant("Grace")

  expect(mockFetchParticipantToken).toHaveBeenLastCalledWith(
    "Grace",
    "nkolosov--weekly-sync",
  )
  expect(view.getByTestId("active-room")).toBeVisible()
})
