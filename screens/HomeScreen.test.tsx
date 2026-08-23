import { fireEvent, render, screen } from "@testing-library/react-native"

import { HomeScreen } from "./HomeScreen"

import type { RecentRoom } from "@/services/recentRooms"

const mockPush = jest.fn()
let mockRecentRooms: RecentRoom[] = []

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (effect: () => void) => {
    jest.requireActual("react").useEffect(effect, [])
  },
}))

jest.mock("@/constants/env", () => ({ configError: null }))

jest.mock("@/services/roomSlug", () => {
  const actual = jest.requireActual("@/services/roomSlug")

  return { ...actual, generateRoomSlug: jest.fn(() => "quiet-tiger-42") }
})

jest.mock("@/services/recentRooms", () => ({
  getRecentRooms: () => Promise.resolve(mockRecentRooms),
}))

beforeEach(() => {
  mockPush.mockReset()
  mockRecentRooms = []
})

test("opens a typed room within the selected company", async () => {
  await render(<HomeScreen company="acme" />)

  await fireEvent.changeText(screen.getByLabelText("Room code"), "Team Sync")
  await fireEvent.press(screen.getByLabelText("Join room"))

  expect(mockPush).toHaveBeenCalledWith("/acme/team-sync")
})

test("opens a generated room within the selected company", async () => {
  await render(<HomeScreen company="acme" />)

  await fireEvent.press(screen.getByLabelText("Create room"))

  expect(mockPush).toHaveBeenCalledWith("/acme/quiet-tiger-42")
})

test("keeps the disabled Join label readable at AA contrast", async () => {
  await render(<HomeScreen company="acme" />)

  expect(screen.getByLabelText("Join room")).toHaveStyle({
    backgroundColor: "#4A4A4A",
  })
  expect(screen.getByText("Join")).toHaveStyle({ color: "#BDBDBD" })
})

test("shows a recent room's company and opens its stored company route", async () => {
  mockRecentRooms = [
    {
      company: "globex",
      slug: "weekly-sync",
      participantName: "Grace",
      joinedAt: 100,
    },
  ]
  await render(<HomeScreen company="acme" />)

  expect(await screen.findByText("globex")).toBeVisible()
  await fireEvent.press(
    screen.getByLabelText("Rejoin weekly-sync as Grace in globex"),
  )

  expect(mockPush).toHaveBeenCalledWith("/globex/weekly-sync")
})

test("displays the branded default company name", async () => {
  mockRecentRooms = [
    {
      company: "nkolosov",
      slug: "weekly-sync",
      participantName: "Grace",
      joinedAt: 100,
    },
  ]
  await render(<HomeScreen company="nkolosov" />)

  expect(await screen.findByTestId("recent-room-company")).toHaveTextContent(
    "NKolosov",
  )
})

test("groups recent meeting identity above participant and time details", async () => {
  mockRecentRooms = [
    {
      company: "globex",
      slug: "weekly-sync",
      participantName: "Grace",
      joinedAt: Date.now(),
    },
  ]
  await render(<HomeScreen company="acme" />)

  expect(await screen.findByTestId("recent-room-identity")).toHaveStyle({
    flexDirection: "row",
  })
  expect(screen.getByTestId("recent-room-company")).toHaveStyle({
    color: "#FFFFFF",
  })
  expect(screen.getByTestId("recent-room-slug")).toHaveStyle({
    color: "#999999",
  })
  expect(screen.getByTestId("recent-room-slug")).toHaveProp("numberOfLines", 1)
  expect(screen.getByTestId("recent-room-details")).toHaveStyle({
    flexDirection: "row",
  })
  expect(screen.getByText("Grace")).toBeVisible()
  expect(screen.getByText("Just now")).toBeVisible()
})
