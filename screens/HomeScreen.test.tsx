import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { TEXT_COLORS } from "@/constants/colors"

import { HomeScreen } from "./HomeScreen"

import type { RecentRoom } from "@/services/recentRooms"

const mockPush = jest.fn()
let mockRecentRooms: RecentRoom[] = []
let mockConfigError: string | null = null
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

  return { ...actual, generateRoomSlug: jest.fn(() => "quiet-tiger-42") }
})

jest.mock("@/services/recentRooms", () => ({
  getRecentRooms: () => Promise.resolve(mockRecentRooms),
}))

beforeEach(() => {
  mockPush.mockReset()
  mockRecentRooms = []
  mockConfigError = null
  latestFocusEffect = undefined
})

afterEach(() => jest.restoreAllMocks())

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

test("disables empty and invalid room codes without navigating", async () => {
  await render(<HomeScreen company="acme" />)

  expect(screen.getByLabelText("Join room")).toBeDisabled()
  expect(screen.getByLabelText("Join room")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ disabled: true }),
  )
  await fireEvent.changeText(screen.getByLabelText("Room code"), "!!!")

  expect(screen.getByLabelText("Join room")).toBeDisabled()
  expect(mockPush).not.toHaveBeenCalled()
})

test("exposes the landing actions and headings to assistive technology", async () => {
  await render(<HomeScreen company="acme" />)

  expect(screen.getByText("NK Meet")).toHaveProp("accessibilityRole", "header")
  expect(screen.getByPlaceholderText("Enter a room code")).toHaveProp(
    "placeholderTextColor",
    TEXT_COLORS.placeholderOnLight,
  )
  expect(screen.getByLabelText("Join room")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(screen.getByLabelText("Create room")).toHaveProp(
    "accessibilityRole",
    "button",
  )
})

test("disables all room actions when configuration is invalid", async () => {
  mockConfigError = "Missing environment variables: EXPO_PUBLIC_LIVEKIT_URL"
  mockRecentRooms = [
    {
      company: "acme",
      slug: "weekly-sync",
      participantName: "Grace",
      joinedAt: 100,
    },
  ]
  await render(<HomeScreen company="acme" />)

  expect(screen.getByText(mockConfigError)).toBeVisible()
  expect(screen.getByLabelText("Room code")).toBeDisabled()
  expect(screen.getByLabelText("Join room")).toBeDisabled()
  expect(screen.getByLabelText("Create room")).toBeDisabled()
  expect(
    await screen.findByLabelText("Rejoin weekly-sync as Grace in acme"),
  ).toBeDisabled()
  expect(
    screen.getByLabelText("Rejoin weekly-sync as Grace in acme"),
  ).toHaveProp("accessibilityRole", "button")
})

test("does not show a recent-meetings section without history", async () => {
  await render(<HomeScreen company="acme" />)

  expect(screen.queryByText("Recent meetings")).not.toBeOnTheScreen()
})

test("keeps recent meetings in their persisted newest-first order", async () => {
  mockRecentRooms = [
    {
      company: "globex",
      slug: "room-b",
      participantName: "Grace",
      joinedAt: 200,
    },
    {
      company: "acme",
      slug: "room-a",
      participantName: "Ada",
      joinedAt: 100,
    },
  ]
  await render(<HomeScreen company="acme" />)

  const rows = await screen.findAllByLabelText(/^Rejoin /)
  expect(rows.map(row => row.props.accessibilityLabel)).toEqual([
    "Rejoin room-b as Grace in globex",
    "Rejoin room-a as Ada in acme",
  ])
})

test("shows a relative time for a recent meeting", async () => {
  jest.spyOn(Date, "now").mockReturnValue(1_000_000)
  mockRecentRooms = [
    {
      company: "acme",
      slug: "weekly-sync",
      participantName: "Grace",
      joinedAt: 1_000_000 - 12 * 60 * 1000,
    },
  ]
  await render(<HomeScreen company="acme" />)

  expect(await screen.findByText("12 min ago")).toBeVisible()
})

test("refreshes recent meetings when the company landing regains focus", async () => {
  await render(<HomeScreen company="acme" />)

  mockRecentRooms = [
    {
      company: "acme",
      slug: "weekly-sync",
      participantName: "Grace",
      joinedAt: 100,
    },
  ]
  await act(async () => {
    latestFocusEffect?.()
  })

  expect(
    await screen.findByLabelText("Rejoin weekly-sync as Grace in acme"),
  ).toBeVisible()
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

  expect(await screen.findByText("Recent meetings")).toHaveProp(
    "accessibilityRole",
    "header",
  )
  expect(await screen.findByText("globex")).toBeVisible()
  await fireEvent.press(
    screen.getByLabelText("Rejoin weekly-sync as Grace in globex"),
  )

  expect(screen.getByTestId("recent-room-company")).toHaveTextContent("globex")
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
  await fireEvent.press(
    screen.getByLabelText("Rejoin weekly-sync as Grace in NKolosov"),
  )

  expect(mockPush).toHaveBeenCalledWith("/nkolosov/weekly-sync")
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
