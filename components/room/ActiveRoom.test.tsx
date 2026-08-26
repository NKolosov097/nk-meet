import { render, screen } from "@testing-library/react-native"

import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"
import { DEFAULT_COMPANY_ID } from "@/constants/company"

import { ActiveRoom } from "./ActiveRoom"

// a11y:components/room/MeetingInfoBanner.tsx

const mockSetAttributes = jest.fn(() => Promise.resolve())
const mockOn = jest.fn()
const mockOff = jest.fn()
const mockMeetingStartedAt = Date.parse("2026-08-26T18:00:00.000Z")

jest.mock("@livekit/react-native", () => ({
  useRoomContext: () => ({
    localParticipant: {
      attributes: {
        "nk-meet.meeting-started-at": String(mockMeetingStartedAt),
      },
      setAttributes: mockSetAttributes,
    },
    remoteParticipants: new Map([
      [
        "earlier-participant",
        {
          attributes: {
            "nk-meet.meeting-started-at": String(mockMeetingStartedAt - 5_000),
          },
        },
      ],
    ]),
    on: mockOn,
    off: mockOff,
  }),
}))

jest.mock("./ControlBar", () => ({ ControlBar: () => null }))
jest.mock("./VideoConference", () => ({ VideoConference: () => null }))
jest.mock("./useRegisterActiveRoomDisconnect", () => ({
  useRegisterActiveRoomDisconnect: jest.fn(),
}))

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(mockMeetingStartedAt + 65_000)
  mockSetAttributes.mockClear()
  mockOn.mockClear()
  mockOff.mockClear()
})

afterEach(() => {
  jest.useRealTimers()
})

test("always displays the room name and shared elapsed time", async () => {
  await render(
    <ActiveRoom
      company={DEFAULT_COMPANY_ID}
      roomSlug="weekly-sync"
      onForcedDisconnect={jest.fn()}
    />,
  )

  expect(screen.getByRole("header", { name: "weekly-sync" })).toBeVisible()
  expect(screen.getByText("01:10")).toBeVisible()
})

test("keeps the meeting name and duration in one compact transparent row", async () => {
  await render(
    <ActiveRoom
      company={DEFAULT_COMPANY_ID}
      roomSlug="weekly-sync"
      onForcedDisconnect={jest.fn()}
    />,
  )

  expect(screen.getByLabelText("Meeting information")).toHaveStyle({
    backgroundColor: BACKGROUND_COLORS.transparent,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 4,
  })
  expect(screen.getByRole("header", { name: "weekly-sync" })).toHaveProp(
    "ellipsizeMode",
    "tail",
  )
  expect(screen.getByRole("header", { name: "weekly-sync" })).toHaveStyle({
    color: TEXT_COLORS.light,
    flex: 1,
  })
  expect(screen.getByLabelText("Elapsed time: 01:10")).toHaveStyle({
    color: TEXT_COLORS.placeholder,
    flexShrink: 0,
  })
})
