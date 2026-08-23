import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { JoinScreen } from "./JoinScreen"

let mockConfigError: string | null = null

jest.mock("@/services/livekitToken", () => ({
  fetchParticipantToken: jest.fn(),
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

const { fetchParticipantToken: mockFetchParticipantToken } = jest.requireMock(
  "@/services/livekitToken",
) as { fetchParticipantToken: jest.Mock }

const { saveRecentRoom: mockSaveRecentRoom, getRecentRoom: mockGetRecentRoom } =
  jest.requireMock("@/services/recentRooms") as {
    saveRecentRoom: jest.Mock
    getRecentRoom: jest.Mock
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

  expect(mockGetRecentRoom).toHaveBeenCalledWith("quiet-tiger-42")
  expect(await screen.findByLabelText("Participant name")).toHaveProp(
    "value",
    "Ada",
  )
})

test("leaves the name field empty for a room with no history", async () => {
  await render(
    <JoinScreen
      roomSlug="quiet-tiger-42"
      onJoined={jest.fn()}
      onBack={jest.fn()}
    />,
  )

  expect(mockGetRecentRoom).toHaveBeenCalledWith("quiet-tiger-42")
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
    "quiet-tiger-42",
  )
  expect(onJoined).toHaveBeenCalledWith("token-abc")
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
    expect(mockSaveRecentRoom).toHaveBeenCalledWith("quiet-tiger-42", "Ada")
  })
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
