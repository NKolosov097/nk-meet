import { act, fireEvent, render, screen } from "@testing-library/react-native"

import HomeScreen from "./index"

import type { RecentRoom } from "@/services/recentRooms"

const mockPush = jest.fn()
let mockConfigError: string | null = null
let mockRecentRooms: RecentRoom[] = []
let latestFocusEffect: (() => void) | undefined

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (effect: () => void) => {
    latestFocusEffect = effect
    jest.requireActual("react").useEffect(effect, [])
  },
}))

jest.mock("@/constants/env", () => ({
  get configError() {
    return mockConfigError
  },
}))

jest.mock("@/services/roomSlug", () => {
  const actual = jest.requireActual("@/services/roomSlug")

  return {
    ...actual,
    generateRoomSlug: jest.fn(() => "quiet-tiger-42"),
  }
})

jest.mock("@/services/recentRooms", () => ({
  getRecentRooms: () => Promise.resolve(mockRecentRooms),
}))

beforeEach(() => {
  jest.restoreAllMocks()
  mockConfigError = null
  mockRecentRooms = []
  mockPush.mockReset()
  latestFocusEffect = undefined
})

test("shows when a recent meeting was joined", async () => {
  jest.spyOn(Date, "now").mockReturnValue(1_000_000)
  mockRecentRooms = [
    {
      slug: "weekly-sync",
      participantName: "Alex",
      joinedAt: 1_000_000 - 12 * 60 * 1000,
    },
  ]

  await render(<HomeScreen />)

  expect(await screen.findByText("12 min ago")).toBeVisible()
})

test("joins a room by typed code, slugified", async () => {
  await render(<HomeScreen />)

  await fireEvent.changeText(
    screen.getByLabelText("Room code"),
    "  Team Sync 2024  ",
  )
  await fireEvent.press(screen.getByLabelText("Join room"))

  expect(mockPush).toHaveBeenCalledWith("/team-sync-2024")
})

test("disables joining an empty or invalid code", async () => {
  await render(<HomeScreen />)

  expect(screen.getByLabelText("Join room")).toBeDisabled()

  await fireEvent.changeText(screen.getByLabelText("Room code"), "!!!")

  expect(screen.getByLabelText("Join room")).toBeDisabled()
  expect(mockPush).not.toHaveBeenCalled()
})

test("creates a new room with a generated slug", async () => {
  await render(<HomeScreen />)

  await fireEvent.press(screen.getByLabelText("Create room"))

  expect(mockPush).toHaveBeenCalledWith("/quiet-tiger-42")
})

test("disables both actions and shows a configuration error", async () => {
  mockConfigError = "Missing environment variables: EXPO_PUBLIC_LIVEKIT_URL"
  mockRecentRooms = [{ slug: "room-a", participantName: "Ada", joinedAt: 100 }]
  await render(<HomeScreen />)

  expect(screen.getByText(mockConfigError)).toBeVisible()
  expect(screen.getByLabelText("Room code")).toBeDisabled()
  expect(screen.getByLabelText("Join room")).toBeDisabled()
  expect(screen.getByLabelText("Create room")).toBeDisabled()
  expect(await screen.findByLabelText(/^Rejoin /)).toBeDisabled()
})

test("renders no recent-rooms section when there is no history", async () => {
  await render(<HomeScreen />)

  expect(screen.queryByText("Recent meetings")).not.toBeOnTheScreen()
})

test("lists recent rooms most-recently-joined first", async () => {
  mockRecentRooms = [
    { slug: "room-b", participantName: "Grace", joinedAt: 200 },
    { slug: "room-a", participantName: "Ada", joinedAt: 100 },
  ]
  await render(<HomeScreen />)

  const rows = await screen.findAllByLabelText(/^Rejoin /)
  expect(rows.map(row => row.props.accessibilityLabel)).toEqual([
    "Rejoin room-b as Grace",
    "Rejoin room-a as Ada",
  ])
  expect(screen.getByText("Grace")).toBeVisible()
  expect(screen.getByText("Ada")).toBeVisible()
})

test("rejoins a recent room by tapping its card", async () => {
  mockRecentRooms = [{ slug: "room-a", participantName: "Ada", joinedAt: 100 }]
  await render(<HomeScreen />)

  await fireEvent.press(await screen.findByLabelText("Rejoin room-a as Ada"))

  expect(mockPush).toHaveBeenCalledWith("/room-a")
})

test("reloads recent rooms each time the screen regains focus", async () => {
  await render(<HomeScreen />)

  expect(screen.queryByText("Recent meetings")).not.toBeOnTheScreen()

  mockRecentRooms = [{ slug: "room-a", participantName: "Ada", joinedAt: 100 }]

  await act(async () => {
    latestFocusEffect?.()
  })

  expect(await screen.findByLabelText("Rejoin room-a as Ada")).toBeVisible()
})
