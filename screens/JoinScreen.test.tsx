import type { ComponentProps } from "react"

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { JoinScreen as ActualJoinScreen } from "./JoinScreen"

const JoinScreen = ({
  company = "acme",
  ...props
}: Omit<ComponentProps<typeof ActualJoinScreen>, "company"> & {
  company?: string
}) => <ActualJoinScreen company={company} {...props} />

let mockConfigError: string | null = null

jest.mock("@/services/livekitToken", () => ({
  fetchParticipantToken: jest.fn(),
}))

jest.mock("@livekit/react-native", () => ({
  VideoTrack: () => null,
  isTrackReference: (trackRef: { publication?: unknown }) =>
    Boolean(trackRef.publication),
  useTrackMutedIndicator: () => ({ isMuted: false }),
}))

jest.mock("@/constants/env", () => ({
  get configError() {
    return mockConfigError
  },
}))

jest.mock("@/services/recentRooms", () => ({
  saveRecentRoom: jest.fn(),
  getRecentRoom: jest.fn(),
}))

jest.mock("livekit-client", () => ({
  ...jest.requireActual("livekit-client"),
  createLocalVideoTrack: jest.fn(),
}))

const { fetchParticipantToken: mockFetchParticipantToken } = jest.requireMock(
  "@/services/livekitToken",
) as { fetchParticipantToken: jest.Mock }

const { saveRecentRoom: mockSaveRecentRoom, getRecentRoom: mockGetRecentRoom } =
  jest.requireMock("@/services/recentRooms") as {
    saveRecentRoom: jest.Mock
    getRecentRoom: jest.Mock
  }

const { createLocalVideoTrack: mockCreateLocalVideoTrack } = jest.requireMock(
  "livekit-client",
) as { createLocalVideoTrack: jest.Mock }

const mockEnumerateDevices = jest.fn()
const mockPreviewTrack = {
  stop: jest.fn(),
  mediaStream: { toURL: () => "preview" },
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

beforeEach(() => {
  mockConfigError = null
  mockFetchParticipantToken.mockReset()
  mockSaveRecentRoom.mockReset()
  mockGetRecentRoom.mockReset().mockResolvedValue(null)
  mockCreateLocalVideoTrack.mockReset().mockResolvedValue(mockPreviewTrack)
  mockPreviewTrack.stop.mockReset()
  mockEnumerateDevices.mockReset().mockResolvedValue([
    { deviceId: "mic-1", kind: "audioinput", label: "Desk microphone" },
    { deviceId: "speaker-1", kind: "audiooutput", label: "Desk speakers" },
    { deviceId: "camera-1", kind: "videoinput", label: "Front camera" },
  ])
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: {
      enumerateDevices: mockEnumerateDevices,
      getUserMedia: jest.fn(),
    },
  })
  jest.spyOn(console, "error").mockImplementation()
})

afterEach(() => {
  jest.restoreAllMocks()
})

test("identifies the app as NK Meet by NKolosov", async () => {
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(screen.getByText("NK Meet")).toBeVisible()
  expect(screen.getByText("by NKolosov")).toBeVisible()
})

test("shows which room is being joined", async () => {
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(screen.getByText(/quiet-tiger-42/)).toBeVisible()
})

test("prefills the participant name from a known recent room", async () => {
  mockGetRecentRoom.mockResolvedValue({
    slug: "quiet-tiger-42",
    participantName: "Ada",
    joinedAt: 100,
  })

  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(mockGetRecentRoom).toHaveBeenCalledWith("acme", "quiet-tiger-42")
  expect(await screen.findByLabelText("Participant name")).toHaveProp(
    "value",
    "Ada",
  )
})

test("loads and saves recent settings using the company and room identity", async () => {
  mockGetRecentRoom.mockResolvedValue({
    company: "acme",
    slug: "quiet-tiger-42",
    participantName: "Ada",
    joinedAt: 100,
  })
  mockFetchParticipantToken.mockResolvedValue("token-abc")

  await render(
    <JoinScreen
      company="acme"
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(mockGetRecentRoom).toHaveBeenCalledWith("acme", "quiet-tiger-42")
  await fireEvent.press(screen.getByLabelText("Join room"))

  await waitFor(() => {
    expect(mockSaveRecentRoom).toHaveBeenCalledWith(
      "acme",
      "quiet-tiger-42",
      "Ada",
      expect.any(Object),
    )
  })
})

test("requests a token for the company-scoped LiveKit room name", async () => {
  mockFetchParticipantToken.mockResolvedValue("token-abc")

  await render(
    <JoinScreen
      company="acme"
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )
  await fireEvent.changeText(screen.getByLabelText("Participant name"), "Ada")
  await fireEvent.press(screen.getByLabelText("Join room"))

  expect(mockFetchParticipantToken).toHaveBeenCalledWith(
    "Ada",
    "acme--quiet-tiger-42",
  )
})

test("starts a first-time room with microphone and camera off", async () => {
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(screen.getByLabelText("Turn on microphone")).toBeVisible()
  expect(screen.getByLabelText("Turn on camera")).toBeVisible()
  expect(screen.getByLabelText("Pre-join participant preview")).toBeVisible()
  expect(mockCreateLocalVideoTrack).not.toHaveBeenCalled()
})

test("exposes enabled controls and selected devices to accessibility", async () => {
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(screen.getByLabelText("Turn on microphone")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ selected: false }),
  )
  await fireEvent.press(screen.getByLabelText("Turn on microphone"))
  expect(screen.getByLabelText("Turn off microphone")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ selected: true }),
  )

  await fireEvent.press(screen.getByLabelText("Select microphone"))
  expect(await screen.findByLabelText("Desk microphone device")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ selected: true }),
  )
})

test("restores this room's saved pre-join media settings", async () => {
  mockEnumerateDevices.mockResolvedValue([
    { deviceId: "mic-1", kind: "audioinput", label: "Desk microphone" },
    { deviceId: "mic-2", kind: "audioinput", label: "Travel microphone" },
    { deviceId: "camera-1", kind: "videoinput", label: "Front camera" },
    { deviceId: "camera-2", kind: "videoinput", label: "Rear camera" },
  ])
  mockGetRecentRoom.mockResolvedValue({
    slug: "quiet-tiger-42",
    participantName: "Ada",
    joinedAt: 100,
    media: {
      microphoneEnabled: true,
      cameraEnabled: true,
      microphoneDeviceId: "mic-2",
      cameraDeviceId: "camera-2",
    },
  })

  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(await screen.findByLabelText("Turn off microphone")).toBeVisible()
  expect(screen.getByLabelText("Turn off camera")).toBeVisible()
  await waitFor(() =>
    expect(mockCreateLocalVideoTrack).toHaveBeenCalledWith({
      deviceId: "camera-2",
    }),
  )
})

test("keeps the form and media controls disabled until restoration completes", async () => {
  const recentRoom = deferred<null>()
  mockGetRecentRoom.mockReturnValue(recentRoom.promise)

  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(screen.getByLabelText("Participant name")).toBeDisabled()
  expect(screen.getByLabelText("Join room")).toBeDisabled()
  expect(screen.getByLabelText("Turn on microphone")).toBeDisabled()
  expect(screen.getByLabelText("Turn on camera")).toBeDisabled()
  expect(screen.getByLabelText("Select microphone")).toBeDisabled()
  expect(screen.getByLabelText("Select camera")).toBeDisabled()
  expect(screen.getByLabelText("Join room")).toHaveStyle({
    backgroundColor: "#4A4A4A",
  })
  expect(screen.getByText("Join")).toHaveStyle({ color: "#BDBDBD" })

  recentRoom.resolve(null)

  await waitFor(() => {
    expect(screen.getByLabelText("Participant name")).toBeEnabled()
    expect(screen.getByLabelText("Join room")).toBeEnabled()
    expect(screen.getByLabelText("Turn on microphone")).toBeEnabled()
    expect(screen.getByLabelText("Turn on camera")).toBeEnabled()
  })
})

test("replaces stale saved device ids before previewing and joining", async () => {
  const onJoined = jest.fn()
  mockGetRecentRoom.mockResolvedValue({
    slug: "quiet-tiger-42",
    participantName: "Ada",
    joinedAt: 100,
    media: {
      microphoneEnabled: true,
      cameraEnabled: true,
      microphoneDeviceId: "stale-mic",
      cameraDeviceId: "stale-camera",
    },
  })
  mockFetchParticipantToken.mockResolvedValue("token-abc")

  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={onJoined}
      onBack={jest.fn()}
    />,
  )

  await waitFor(() =>
    expect(mockCreateLocalVideoTrack).toHaveBeenCalledWith({
      deviceId: "camera-1",
    }),
  )
  await fireEvent.press(screen.getByLabelText("Join room"))

  const expectedMedia = {
    microphoneEnabled: true,
    cameraEnabled: true,
    microphoneDeviceId: "mic-1",
    cameraDeviceId: "camera-1",
  }
  expect(onJoined).toHaveBeenCalledWith("token-abc", expectedMedia)
  expect(mockSaveRecentRoom).toHaveBeenCalledWith(
    "acme",
    "quiet-tiger-42",
    "Ada",
    expectedMedia,
  )
})

test("finishes initialization when device enumeration fails", async () => {
  mockEnumerateDevices.mockRejectedValue(new Error("devices unavailable"))

  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(await screen.findByLabelText("Participant name")).toBeEnabled()
  expect(screen.getByLabelText("Join room")).toBeEnabled()
})

test("finishes initialization when device enumeration is unavailable", async () => {
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: jest.fn() },
  })

  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(await screen.findByLabelText("Participant name")).toBeEnabled()
  expect(screen.getByLabelText("Join room")).toBeEnabled()
})

test("leaves the name field empty for a room with no history", async () => {
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(mockGetRecentRoom).toHaveBeenCalledWith("acme", "quiet-tiger-42")
  expect(screen.getByLabelText("Participant name")).toHaveProp("value", "")
})

test("rejects an empty name without requesting a token", async () => {
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  await fireEvent.press(screen.getByLabelText("Join room"))

  expect(screen.getByText("Please enter your name")).toBeVisible()
  expect(mockFetchParticipantToken).not.toHaveBeenCalled()
})

test("trims the participant name and reports a successful join", async () => {
  const onJoined = jest.fn()
  mockFetchParticipantToken.mockResolvedValue("token-abc")
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={onJoined}
      onBack={jest.fn()}
    />,
  )

  await fireEvent.changeText(
    screen.getByLabelText("Participant name"),
    "  Ada  ",
  )
  await fireEvent.press(screen.getByLabelText("Join room"))

  expect(mockFetchParticipantToken).toHaveBeenCalledWith(
    "Ada",
    "acme--quiet-tiger-42",
  )
  expect(onJoined).toHaveBeenCalledWith("token-abc", {
    microphoneEnabled: false,
    cameraEnabled: false,
    microphoneDeviceId: "mic-1",
    cameraDeviceId: "camera-1",
  })
})

test("disables controls while a join request is pending", async () => {
  const request = deferred<string>()
  mockFetchParticipantToken.mockReturnValue(request.promise)
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )
  await fireEvent.changeText(screen.getByLabelText("Participant name"), "Ada")

  const pressPromise = fireEvent.press(screen.getByLabelText("Join room"))

  await waitFor(() => {
    expect(screen.getByLabelText("Join room")).toBeDisabled()
    expect(screen.getByLabelText("Participant name")).toBeDisabled()
    expect(screen.getByLabelText("Turn on microphone")).toBeDisabled()
    expect(screen.getByLabelText("Turn on camera")).toBeDisabled()
    expect(screen.getByLabelText("Select microphone")).toBeDisabled()
    expect(screen.getByLabelText("Select camera")).toBeDisabled()
  })

  request.resolve("token-abc")
  await pressPromise
  await waitFor(() => expect(screen.getByLabelText("Join room")).toBeEnabled())
})

test("ignores a duplicate submit while the first request is pending", async () => {
  const request = deferred<string>()
  mockFetchParticipantToken.mockReturnValue(request.promise)
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )
  const nameInput = screen.getByLabelText("Participant name")
  await fireEvent.changeText(nameInput, "Ada")
  const submit = nameInput.props.onSubmitEditing as () => Promise<void>

  await act(async () => {
    const firstSubmit = submit()
    const duplicateSubmit = submit()

    expect(mockFetchParticipantToken).toHaveBeenCalledTimes(1)
    request.resolve("token-abc")
    await Promise.all([firstSubmit, duplicateSubmit])
  })
})

test("shows the token service error from the current attempt", async () => {
  mockFetchParticipantToken.mockRejectedValue(new Error("token denied"))
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      error="connection lost"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(screen.getByText("connection lost")).toBeVisible()
  await fireEvent.changeText(screen.getByLabelText("Participant name"), "Ada")
  await fireEvent.press(screen.getByLabelText("Join room"))

  expect(await screen.findByText("token denied")).toBeVisible()
  expect(screen.queryByText("connection lost")).not.toBeOnTheScreen()
})

test("shows a generic error for a non-Error rejection", async () => {
  mockFetchParticipantToken.mockRejectedValue("token denied")
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  await fireEvent.changeText(screen.getByLabelText("Participant name"), "Ada")
  await fireEvent.press(screen.getByLabelText("Join room"))

  expect(await screen.findByText("Failed to get an access token")).toBeVisible()
})

test("disables joining and shows an environment configuration error", async () => {
  mockConfigError = "Missing room configuration"
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(screen.getByText("Missing room configuration")).toBeVisible()
  expect(screen.getByLabelText("Join room")).toBeDisabled()
  expect(screen.getByLabelText("Participant name")).toBeDisabled()
  expect(mockFetchParticipantToken).not.toHaveBeenCalled()
})

test("calls onBack when the back button is pressed", async () => {
  const onBack = jest.fn()
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={onBack}
    />,
  )

  await fireEvent.press(screen.getByLabelText("Back to room selection"))

  expect(onBack).toHaveBeenCalledTimes(1)
})

test("offsets the back button below the device's safe-area inset", async () => {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 47, left: 20, right: 0, bottom: 34 },
      }}
    >
      <JoinScreen
        roomSlug="quiet-tiger-42"
        onJoined={jest.fn()}
        onBack={jest.fn()}
      />
    </SafeAreaProvider>,
  )

  expect(screen.getByLabelText("Back to room selection")).toHaveStyle({
    top: 67,
    left: 40,
  })
})

test("aligns the compact brand with the back button", async () => {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 47, left: 20, right: 0, bottom: 34 },
      }}
    >
      <JoinScreen
        roomSlug="quiet-tiger-42"
        onJoined={jest.fn()}
        onBack={jest.fn()}
      />
    </SafeAreaProvider>,
  )

  expect(screen.getByTestId("join-screen-header")).toHaveStyle({
    top: 67,
    height: 40,
  })
  expect(screen.getByText("NK Meet")).toHaveStyle({ marginBottom: 0 })
  expect(screen.getByText("by NKolosov")).toHaveStyle({ marginTop: -2 })
})

test("groups the name input with Join below the preview controls", async () => {
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(screen.getByTestId("prejoin-media-group")).toHaveStyle({ gap: 12 })
  expect(screen.getByTestId("join-form-group")).toHaveStyle({
    gap: 12,
    marginTop: 28,
  })
  expect(screen.getByLabelText("Join room")).toHaveStyle({ marginTop: 0 })
})

test("starts the pre-join content near the top of the screen", async () => {
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(screen.getByTestId("join-screen-scroll")).toHaveProp(
    "contentContainerStyle",
    expect.arrayContaining([
      expect.objectContaining({
        flexGrow: 1,
        justifyContent: "flex-start",
      }),
    ]),
  )
})

test("saves the room to recent rooms after a successful join", async () => {
  mockFetchParticipantToken.mockResolvedValue("token-abc")
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  await fireEvent.changeText(
    screen.getByLabelText("Participant name"),
    "  Ada  ",
  )
  await fireEvent.press(screen.getByLabelText("Join room"))

  await waitFor(() => {
    expect(mockSaveRecentRoom).toHaveBeenCalledWith(
      "acme",
      "quiet-tiger-42",
      "Ada",
      {
        microphoneEnabled: false,
        cameraEnabled: false,
        microphoneDeviceId: "mic-1",
        cameraDeviceId: "camera-1",
      },
    )
  })
})

test("shows pre-join media controls and only input device choices", async () => {
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(screen.getByLabelText("Pre-join participant preview")).toBeVisible()
  expect(screen.getByText("Microphone")).toBeVisible()
  expect(screen.getByText("Camera")).toBeVisible()

  await fireEvent.press(screen.getByLabelText("Select microphone"))

  expect(await screen.findByText("Select microphone")).toBeVisible()
  expect(await screen.findByText("Desk microphone")).toBeVisible()
  expect(screen.getByLabelText("Desk microphone device")).toHaveStyle({
    backgroundColor: "#007AFF",
  })
  expect(screen.queryByText("Desk speakers")).not.toBeOnTheScreen()
})

test("places the pre-join device dropdown above its trigger", async () => {
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  await fireEvent.press(screen.getByLabelText("Select camera"))

  expect(screen.getByTestId("device-dropdown")).toHaveStyle({ bottom: 48 })
})

test("keeps only one pre-join device list open", async () => {
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  await fireEvent.press(screen.getByLabelText("Select microphone"))
  expect(await screen.findByText("Desk microphone")).toBeVisible()

  await fireEvent.press(screen.getByLabelText("Select camera"))

  expect(await screen.findByText("Front camera")).toBeVisible()
  expect(screen.queryByText("Desk microphone")).not.toBeOnTheScreen()
})

test("joins with enabled states and selected input devices", async () => {
  const onJoined = jest.fn()
  mockFetchParticipantToken.mockResolvedValue("token-abc")
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={onJoined}
      onBack={jest.fn()}
    />,
  )

  await fireEvent.press(screen.getByLabelText("Turn on microphone"))
  await fireEvent.press(screen.getByLabelText("Turn on camera"))
  await fireEvent.press(screen.getByLabelText("Select camera"))
  await fireEvent.press(await screen.findByText("Front camera"))
  await fireEvent.changeText(screen.getByLabelText("Participant name"), "Ada")
  await fireEvent.press(screen.getByLabelText("Join room"))

  expect(onJoined).toHaveBeenCalledWith("token-abc", {
    microphoneEnabled: true,
    cameraEnabled: true,
    microphoneDeviceId: "mic-1",
    cameraDeviceId: "camera-1",
  })
})

test("stops the camera preview before joining and when unmounted", async () => {
  const first = await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )
  await fireEvent.press(screen.getByLabelText("Turn on camera"))
  await waitFor(() => expect(mockCreateLocalVideoTrack).toHaveBeenCalled())
  await first.unmount()
  expect(mockPreviewTrack.stop).toHaveBeenCalledTimes(1)

  mockPreviewTrack.stop.mockReset()
  mockFetchParticipantToken.mockResolvedValue("token-abc")
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )
  await fireEvent.press(screen.getByLabelText("Turn on camera"))
  await fireEvent.changeText(screen.getByLabelText("Participant name"), "Ada")
  await fireEvent.press(screen.getByLabelText("Join room"))

  expect(mockPreviewTrack.stop).toHaveBeenCalledTimes(1)
})

test("does not save to recent rooms when the join fails", async () => {
  mockFetchParticipantToken.mockRejectedValue(new Error("token denied"))
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  await fireEvent.changeText(screen.getByLabelText("Participant name"), "Ada")
  await fireEvent.press(screen.getByLabelText("Join room"))

  await screen.findByText("token denied")
  expect(mockSaveRecentRoom).not.toHaveBeenCalled()
})
