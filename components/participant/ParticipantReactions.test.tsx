// a11y:components/participant/ParticipantReactions.tsx
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  type EmitterSubscription,
} from "react-native"

import { act, render } from "@testing-library/react-native"

import { useReactions } from "../room/reactions/ReactionsProvider"

import { ParticipantReactions } from "./ParticipantReactions"

jest.mock("../room/reactions/ReactionsProvider", () => ({
  useReactions: jest.fn(),
}))

const mockUseReactions = useReactions as jest.Mock
const removeReduceMotionListener = jest.fn()

const setParticipantState = (state?: Record<string, unknown>) => {
  mockUseReactions.mockReturnValue({
    participants: state ? { alice: state } : {},
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false)
  const subscription = Object.assign(
    Object.create(null) as EmitterSubscription,
    { remove: removeReduceMotionListener },
  )
  jest
    .spyOn(AccessibilityInfo, "addEventListener")
    .mockReturnValue(subscription)
})

afterEach(() => {
  jest.restoreAllMocks()
})

test("renders no overlay without participant reaction state", async () => {
  setParticipantState()

  const view = await render(
    <ParticipantReactions identity="alice" displayName="Alice" />,
  )

  expect(view.queryByTestId("participant-reactions")).not.toBeOnTheScreen()
})

test("renders a decorative raised hand at the top left", async () => {
  setParticipantState({ isHandRaised: true, ephemeralReactions: [] })

  const view = await render(
    <ParticipantReactions identity="alice" displayName="Alice" />,
  )

  expect(view.getByTestId("raised-hand")).toHaveStyle({ top: 8, left: 8 })
  expect(view.getByTestId("raised-hand")).toHaveProp("accessible", false)
})

test("renders live quick glyphs in arrival order without capturing touches", async () => {
  setParticipantState({
    isHandRaised: false,
    ephemeralReactions: [
      { id: "alice:1:1", type: "heart", expiresAt: 2_000 },
      { id: "alice:1:2", type: "cry", expiresAt: 2_000 },
    ],
  })

  const view = await render(
    <ParticipantReactions identity="alice" displayName="Alice" />,
  )
  await act(() => Promise.resolve())

  expect(view.getByTestId("participant-reactions")).toHaveProp(
    "pointerEvents",
    "none",
  )
  expect(
    view
      .getAllByTestId("quick-reaction-glyph")
      .map(node => node.props.children),
  ).toEqual(["❤️", "😭"])
})

test("starts the native 2000ms floating animation for normal motion", async () => {
  const parallel = jest.spyOn(Animated, "parallel")
  const timing = jest.spyOn(Animated, "timing")
  setParticipantState({
    isHandRaised: false,
    ephemeralReactions: [
      { id: "alice:1:1", type: "thumbsUp", expiresAt: 2_000 },
    ],
  })

  await render(<ParticipantReactions identity="alice" displayName="Alice" />)
  await act(() => Promise.resolve())

  expect(parallel).toHaveBeenCalledTimes(1)
  expect(timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      toValue: -100,
      duration: 2_000,
      useNativeDriver: true,
    }),
  )
})

test("renders statically without translation or scale when motion is reduced", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  const parallel = jest.spyOn(Animated, "parallel")
  setParticipantState({
    isHandRaised: false,
    ephemeralReactions: [
      { id: "alice:1:1", type: "smile", expiresAt: 2_000 },
      { id: "alice:1:2", type: "heart", expiresAt: 2_000 },
    ],
  })

  const view = await render(
    <ParticipantReactions identity="alice" displayName="Alice" />,
  )
  await act(() => Promise.resolve())

  const staticReactions = view.getAllByTestId("quick-reaction-static")
  expect(staticReactions).toHaveLength(2)
  const offsets = staticReactions.map(
    reaction => StyleSheet.flatten(reaction.props.style).left,
  )
  expect(new Set(offsets).size).toBe(2)
  expect(parallel).not.toHaveBeenCalled()
})

test("keeps collision-free reaction positions stable as reactions change", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  setParticipantState({
    isHandRaised: false,
    ephemeralReactions: [
      { id: "ab", type: "smile", expiresAt: 2_000 },
      { id: "ba", type: "heart", expiresAt: 2_000 },
    ],
  })

  const view = await render(
    <ParticipantReactions identity="alice" displayName="Alice" />,
  )
  await act(() => Promise.resolve())

  const initialOffsets = view
    .getAllByTestId("quick-reaction-static")
    .map(reaction => StyleSheet.flatten(reaction.props.style).left)
  expect(initialOffsets[0]).not.toBe(initialOffsets[1])

  setParticipantState({
    isHandRaised: false,
    ephemeralReactions: [
      { id: "ba", type: "heart", expiresAt: 2_000 },
      { id: "ca", type: "cry", expiresAt: 2_000 },
    ],
  })
  await view.rerender(
    <ParticipantReactions identity="alice" displayName="Alice" />,
  )

  const nextOffsets = view
    .getAllByTestId("quick-reaction-static")
    .map(reaction => StyleSheet.flatten(reaction.props.style).left)
  expect(nextOffsets[0]).toBe(initialOffsets[1])
  expect(nextOffsets[1]).not.toBe(nextOffsets[0])
})

test("removes the reduced-motion listener on unmount", async () => {
  setParticipantState({ isHandRaised: true, ephemeralReactions: [] })
  const view = await render(
    <ParticipantReactions identity="alice" displayName="Alice" />,
  )

  await view.unmount()

  expect(removeReduceMotionListener).toHaveBeenCalledTimes(1)
})
