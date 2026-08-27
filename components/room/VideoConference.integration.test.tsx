// a11y:components/room/VideoConference.tsx
// a11y:components/room/grid/ParticipantGrid.tsx
import { act, fireEvent, render } from "@testing-library/react-native"

import { ParticipantKind, Track } from "livekit-client"

import { FADE_DURATION_MS } from "@/components/room/grid/PaginationBar"

import { VideoConference } from "./VideoConference"

jest.mock("@livekit/react-native", () => ({
  useTracks: jest.fn(),
  isTrackReference: jest.fn(() => false),
  useTrackMutedIndicator: jest.fn(() => ({ isMuted: false })),
  VideoTrack: () => null,
}))

const { useTracks: mockUseTracks } = jest.requireMock(
  "@livekit/react-native",
) as { useTracks: jest.Mock }

const createTracks = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    participant: {
      identity: `participant-${index}`,
      name: `Participant ${index}`,
      kind: ParticipantKind.STANDARD,
      isLocal: index === 0,
    },
    source: Track.Source.Camera,
    publication: undefined,
  }))

const createScreenShareTrack = (identity: string) => ({
  participant: {
    identity,
    name: `${identity} (screen)`,
    kind: ParticipantKind.STANDARD,
    isLocal: false,
  },
  source: Track.Source.ScreenShare,
  publication: undefined,
})

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

test("shows a message when the room is empty", async () => {
  mockUseTracks.mockReturnValue([])

  const view = await render(<VideoConference />)

  expect(view.getByText("No participants in the room")).toBeVisible()
})

test("renders every participant without pagination up to eight", async () => {
  mockUseTracks.mockReturnValue(createTracks(8))

  const view = await render(<VideoConference />)

  expect(view.getAllByText(/^Participant \d/)).toHaveLength(8)
  expect(view.queryByLabelText("Next page")).not.toBeOnTheScreen()
})

test("paginates a nine-person room across two pages", async () => {
  mockUseTracks.mockReturnValue(createTracks(9))

  const view = await render(<VideoConference />)

  await act(async () => {
    jest.advanceTimersByTime(FADE_DURATION_MS)
  })

  expect(view.getAllByText(/^Participant \d/)).toHaveLength(8)
  expect(view.getByText("1 / 2")).toBeVisible()
  expect(view.getByLabelText("Previous page")).toBeDisabled()
  expect(view.getByLabelText("Next page")).not.toBeDisabled()

  await fireEvent.press(view.getByLabelText("Next page"))

  expect(view.getAllByText(/^Participant \d/)).toHaveLength(1)
  expect(view.getByText("2 / 2")).toBeVisible()
  expect(view.getByLabelText("Next page")).toBeDisabled()
  expect(view.getByLabelText("Previous page")).not.toBeDisabled()

  await fireEvent.press(view.getByLabelText("Previous page"))

  expect(view.getByText("1 / 2")).toBeVisible()
})

test("sizes tiles correctly for a 2x2 grid (three participants)", async () => {
  mockUseTracks.mockReturnValue(createTracks(3))

  const view = await render(<VideoConference />)

  expect(view.getAllByText(/^Participant \d/)).toHaveLength(3)

  await fireEvent(view.getByTestId("participant-grid"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 630, height: 310 } },
  })

  expect(view.getByTestId("participant-tile-participant-0")).toHaveStyle({
    width: 300,
    height: 140,
  })
})

test("sizes tiles correctly for a 2x3 grid (five participants)", async () => {
  mockUseTracks.mockReturnValue(createTracks(5))

  const view = await render(<VideoConference />)

  expect(view.getAllByText(/^Participant \d/)).toHaveLength(5)

  await fireEvent(view.getByTestId("participant-grid"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 630, height: 310 } },
  })

  expect(view.getByTestId("participant-tile-participant-0")).toHaveStyle({
    width: 300,
    height: 90,
  })
})

test("expands a participant to fullscreen and shows the rest in a carousel", async () => {
  mockUseTracks.mockReturnValue(createTracks(3))

  const view = await render(<VideoConference />)

  await fireEvent.press(view.getAllByLabelText("Expand video")[0])

  expect(view.getByTestId("participant-spotlight")).toBeOnTheScreen()
  expect(view.queryByTestId("participant-grid")).not.toBeOnTheScreen()
  expect(view.getByLabelText("Collapse video")).toBeOnTheScreen()
  expect(view.getAllByText(/^Participant \d/)).toHaveLength(3)
})

test("collapsing the spotlighted tile returns to grid view", async () => {
  mockUseTracks.mockReturnValue(createTracks(3))

  const view = await render(<VideoConference />)

  await fireEvent.press(view.getAllByLabelText("Expand video")[0])
  await fireEvent.press(view.getByLabelText("Collapse video"))

  expect(view.getByTestId("participant-grid")).toBeOnTheScreen()
  expect(view.queryByTestId("participant-spotlight")).not.toBeOnTheScreen()
})

test("swapping via a carousel tile changes who is spotlighted", async () => {
  mockUseTracks.mockReturnValue(createTracks(3))

  const view = await render(<VideoConference />)

  await fireEvent.press(view.getAllByLabelText("Expand video")[0])
  await fireEvent.press(view.getByLabelText("Show Participant 1 fullscreen"))

  expect(view.getByLabelText("Collapse video")).toBeOnTheScreen()
  expect(view.getByLabelText("Show Participant 0 fullscreen")).toBeOnTheScreen()
})

test("falls back to grid view when the spotlighted participant leaves", async () => {
  mockUseTracks.mockReturnValue(createTracks(3))

  const view = await render(<VideoConference />)

  await fireEvent.press(view.getAllByLabelText("Expand video")[0])
  expect(view.getByTestId("participant-spotlight")).toBeOnTheScreen()

  mockUseTracks.mockReturnValue(createTracks(3).slice(1))
  await view.rerender(<VideoConference />)

  expect(view.getByTestId("participant-grid")).toBeOnTheScreen()
})

test("an active screen share auto-expands and hides manual controls", async () => {
  mockUseTracks.mockReturnValue([
    ...createTracks(2),
    createScreenShareTrack("participant-2"),
  ])

  const view = await render(<VideoConference />)

  expect(view.getByTestId("participant-spotlight")).toBeOnTheScreen()
  expect(view.queryByLabelText("Collapse video")).not.toBeOnTheScreen()
  expect(view.queryByLabelText("Expand video")).not.toBeOnTheScreen()
})

test("returns to grid view once the screen share ends", async () => {
  mockUseTracks.mockReturnValue([
    ...createTracks(2),
    createScreenShareTrack("participant-2"),
  ])

  const view = await render(<VideoConference />)
  expect(view.getByTestId("participant-spotlight")).toBeOnTheScreen()

  mockUseTracks.mockReturnValue(createTracks(2))
  await view.rerender(<VideoConference />)

  expect(view.getByTestId("participant-grid")).toBeOnTheScreen()
})
