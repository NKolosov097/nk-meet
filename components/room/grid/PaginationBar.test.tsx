// a11y:components/room/grid/PaginationBar.tsx
// a11y:components/icons/ChevronLeftIcon.tsx
// a11y:components/icons/ChevronRightIcon.tsx
import { act, fireEvent, render } from "@testing-library/react-native"

import { BORDER_COLORS, TEXT_COLORS } from "@/constants/colors"

import { FADE_DURATION_MS, PaginationBar } from "./PaginationBar"

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// Renders and lets the mount's fade-in animation finish, so subsequent
// assertions and unmount-time cleanup don't race a pending animation frame.
const renderSettled = async (
  ui: Parameters<typeof render>[0],
): Promise<ReturnType<typeof render>> => {
  const view = await render(ui)

  await act(async () => {
    jest.advanceTimersByTime(FADE_DURATION_MS)
  })

  return view
}

test("shows the current page out of the total", async () => {
  const view = await renderSettled(
    <PaginationBar
      currentPage={1}
      totalPages={3}
      isVisible
      onPrevious={jest.fn()}
      onNext={jest.fn()}
    />,
  )

  expect(view.getByText("2 / 3")).toBeVisible()
})

test("disables the previous button on the first page", async () => {
  const onPrevious = jest.fn()
  const view = await renderSettled(
    <PaginationBar
      currentPage={0}
      totalPages={3}
      isVisible
      onPrevious={onPrevious}
      onNext={jest.fn()}
    />,
  )

  const previousButton = view.getByLabelText("Previous page")
  expect(previousButton).toBeDisabled()
  expect(previousButton).toHaveProp("accessibilityRole", "button")
  expect(previousButton).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ disabled: true }),
  )

  await fireEvent.press(previousButton)
  expect(onPrevious).not.toHaveBeenCalled()
})

test("disables the next button on the last page", async () => {
  const onNext = jest.fn()
  const view = await renderSettled(
    <PaginationBar
      currentPage={2}
      totalPages={3}
      isVisible
      onPrevious={jest.fn()}
      onNext={onNext}
    />,
  )

  const nextButton = view.getByLabelText("Next page")
  expect(nextButton).toBeDisabled()
  expect(nextButton).toHaveProp("accessibilityRole", "button")
  expect(nextButton).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ disabled: true }),
  )

  await fireEvent.press(nextButton)
  expect(onNext).not.toHaveBeenCalled()
})

test("calls onPrevious and onNext when the buttons are enabled", async () => {
  const onPrevious = jest.fn()
  const onNext = jest.fn()
  const view = await renderSettled(
    <PaginationBar
      currentPage={1}
      totalPages={3}
      isVisible
      onPrevious={onPrevious}
      onNext={onNext}
    />,
  )

  await fireEvent.press(view.getByLabelText("Previous page"))
  await fireEvent.press(view.getByLabelText("Next page"))

  expect(onPrevious).toHaveBeenCalledTimes(1)
  expect(onNext).toHaveBeenCalledTimes(1)
  expect(view.getByLabelText("Previous page")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(view.getByLabelText("Previous page")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ disabled: false }),
  )
  expect(view.getByLabelText("Next page")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(view.getByLabelText("Next page")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ disabled: false }),
  )
  expect(
    view.getByLabelText("Previous page").props.children[0].props.color,
  ).toBe(TEXT_COLORS.paginationIcon)
  expect(view.getByLabelText("Next page").props.children[0].props.color).toBe(
    TEXT_COLORS.paginationIcon,
  )
  expect(view.getByLabelText("Previous page")).toHaveStyle({
    borderRightColor: BORDER_COLORS.controlDivider,
  })
  expect(view.getByLabelText("Next page")).toHaveStyle({
    borderLeftColor: BORDER_COLORS.controlDivider,
  })
})

test("renders as an absolutely-positioned overlay so it never affects the grid's layout", async () => {
  const view = await renderSettled(
    <PaginationBar
      currentPage={0}
      totalPages={2}
      isVisible
      onPrevious={jest.fn()}
      onNext={jest.fn()}
    />,
  )

  expect(view.getByTestId("pagination-bar")).toHaveStyle({
    position: "absolute",
  })
})

test("allows touches to pass through to the grid while faded out", async () => {
  const view = await renderSettled(
    <PaginationBar
      currentPage={0}
      totalPages={2}
      isVisible={false}
      onPrevious={jest.fn()}
      onNext={jest.fn()}
    />,
  )

  expect(view.getByTestId("pagination-bar").props.pointerEvents).toBe("none")
})

test("keeps its buttons tappable while visible", async () => {
  const view = await renderSettled(
    <PaginationBar
      currentPage={0}
      totalPages={2}
      isVisible
      onPrevious={jest.fn()}
      onNext={jest.fn()}
    />,
  )

  expect(view.getByTestId("pagination-bar").props.pointerEvents).toBe(
    "box-none",
  )
})

test("fades in when shown and fades out when hidden", async () => {
  const view = await renderSettled(
    <PaginationBar
      currentPage={0}
      totalPages={2}
      isVisible
      onPrevious={jest.fn()}
      onNext={jest.fn()}
    />,
  )

  expect(view.getByTestId("pagination-bar")).toHaveStyle({ opacity: 1 })

  await view.rerender(
    <PaginationBar
      currentPage={0}
      totalPages={2}
      isVisible={false}
      onPrevious={jest.fn()}
      onNext={jest.fn()}
    />,
  )

  await act(async () => {
    jest.advanceTimersByTime(FADE_DURATION_MS)
  })

  expect(view.getByTestId("pagination-bar")).toHaveStyle({ opacity: 0 })
})
