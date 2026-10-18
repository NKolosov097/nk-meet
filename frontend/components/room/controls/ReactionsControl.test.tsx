// a11y:components/room/controls/ReactionsControl.tsx
import { act, fireEvent, render } from "@testing-library/react-native"

import { useLocalParticipant } from "@livekit/react-native"

import {
  BACKGROUND_COLORS,
  BORDER_COLORS,
  TEXT_COLORS,
} from "@/constants/colors"

import { useReactions } from "../reactions/ReactionsProvider"

import { ReactionsControl } from "./ReactionsControl"

jest.mock("@livekit/react-native", () => ({
  useLocalParticipant: jest.fn(),
}))
jest.mock("../reactions/ReactionsProvider", () => ({
  useReactions: jest.fn(),
}))

const mockUseLocalParticipant = useLocalParticipant as jest.Mock
const mockUseReactions = useReactions as jest.Mock
const sendQuickReaction = jest.fn()
const toggleHand = jest.fn()

const reactionState = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  participants: {
    local: { isHandRaised: false, ephemeralReactions: [] },
  },
  canSendQuickReactions: true,
  canUpdateHand: true,
  isHandUpdatePending: false,
  sendQuickReaction,
  toggleHand,
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockUseLocalParticipant.mockReturnValue({
    localParticipant: { identity: "local" },
  })
  mockUseReactions.mockReturnValue(reactionState())
})

test("opens an accessible reaction modal from an expanded-state button", async () => {
  const view = await render(<ReactionsControl />)
  const trigger = view.getByRole("button", { name: "Open reactions" })
  expect(trigger).toHaveProp("accessibilityState", {
    disabled: false,
    expanded: false,
  })

  await fireEvent.press(trigger)

  expect(trigger).toHaveProp("accessibilityState", {
    disabled: false,
    expanded: true,
  })
  expect(view.getByRole("header", { name: "Reactions" })).toBeVisible()
  expect(view.getByTestId("reactions-card")).toHaveProp(
    "accessibilityViewIsModal",
    true,
  )
})

test.each([
  ["Celebrate", "hooray"],
  ["Thumbs up", "thumbsUp"],
  ["Thumbs down", "thumbsDown"],
  ["Heart", "heart"],
  ["Smile", "smile"],
  ["Cry", "cry"],
])("sends %s and keeps the picker open", async (label, type) => {
  const view = await render(<ReactionsControl />)
  await fireEvent.press(view.getByLabelText("Open reactions"))

  await fireEvent.press(view.getByRole("button", { name: label }))

  expect(sendQuickReaction).toHaveBeenCalledWith(type)
  expect(view.getByRole("header", { name: "Reactions" })).toBeVisible()
})

test("toggles the hand with selected and enabled semantics", async () => {
  const view = await render(<ReactionsControl />)
  await fireEvent.press(view.getByLabelText("Open reactions"))

  const hand = view.getByRole("button", { name: "Raise hand" })
  expect(hand).toHaveProp("accessibilityState", {
    selected: false,
    disabled: false,
  })
  await fireEvent.press(hand)

  expect(toggleHand).toHaveBeenCalledTimes(1)
})

test("labels a raised hand for lowering", async () => {
  mockUseReactions.mockReturnValue(
    reactionState({
      participants: {
        local: { isHandRaised: true, ephemeralReactions: [] },
      },
    }),
  )
  const view = await render(<ReactionsControl />)
  await fireEvent.press(view.getByLabelText("Open reactions"))

  expect(view.getByRole("button", { name: "Lower hand" })).toHaveProp(
    "accessibilityState",
    { selected: true, disabled: false },
  )
})

test.each([
  ["metadata permission", { canUpdateHand: false }],
  ["pending update", { isHandUpdatePending: true }],
])(
  "disables the hand action while blocked by %s",
  async (_reason, overrides) => {
    mockUseReactions.mockReturnValue(reactionState(overrides))
    const view = await render(<ReactionsControl />)
    await fireEvent.press(view.getByLabelText("Open reactions"))

    expect(view.getByRole("button", { name: "Raise hand" })).toHaveProp(
      "accessibilityState",
      { selected: false, disabled: true },
    )
  },
)

test("closes from the backdrop and close button", async () => {
  const view = await render(<ReactionsControl />)
  await fireEvent.press(view.getByLabelText("Open reactions"))
  const backdrop = view.container.queryAll(
    instance => instance.props.accessibilityLabel === "Dismiss reactions",
  )[0]
  await fireEvent.press(backdrop)
  expect(view.queryByText("Reactions")).not.toBeOnTheScreen()

  await fireEvent.press(view.getByLabelText("Open reactions"))
  await fireEvent.press(view.getByLabelText("Close reactions"))
  expect(view.queryByText("Reactions")).not.toBeOnTheScreen()
})

test("closes from the modal request-close callback", async () => {
  const view = await render(<ReactionsControl />)
  await fireEvent.press(view.getByLabelText("Open reactions"))
  const modal = view.container.queryAll(
    instance => instance.type === "Modal",
  )[0]

  await act(() => modal.props.onRequestClose())

  expect(view.queryByText("Reactions")).not.toBeOnTheScreen()
})

test("disables the trigger without data publishing permission", async () => {
  mockUseReactions.mockReturnValue(
    reactionState({ canSendQuickReactions: false }),
  )
  const view = await render(<ReactionsControl />)

  expect(view.getByLabelText("Open reactions")).toHaveProp(
    "accessibilityState",
    { disabled: true, expanded: false },
  )
})

test("uses semantic colors and 44px minimum action targets", async () => {
  const view = await render(<ReactionsControl />)
  await fireEvent.press(view.getByLabelText("Open reactions"))

  for (const label of [
    "Celebrate",
    "Thumbs up",
    "Thumbs down",
    "Heart",
    "Smile",
    "Cry",
    "Raise hand",
    "Close reactions",
  ]) {
    expect(view.getByRole("button", { name: label })).toHaveStyle({
      minWidth: 44,
      minHeight: 44,
      backgroundColor: BACKGROUND_COLORS.elevated,
      borderColor: BORDER_COLORS.selectionIndicator,
    })
  }
  expect(view.getByText("Raise hand")).toHaveStyle({ color: TEXT_COLORS.light })
})
