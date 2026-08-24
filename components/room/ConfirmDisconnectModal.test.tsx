// a11y:components/room/ConfirmDisconnectModal.tsx
import { fireEvent, render } from "@testing-library/react-native"

import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"

import { ConfirmDisconnectModal } from "./ConfirmDisconnectModal"

test("does not render its content when not visible", async () => {
  const view = await render(
    <ConfirmDisconnectModal
      visible={false}
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
    />,
  )

  expect(view.queryByText("Disconnect?")).not.toBeOnTheScreen()
})

test("shows the confirmation card when visible", async () => {
  const view = await render(
    <ConfirmDisconnectModal
      visible
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
    />,
  )

  expect(view.getByText("Disconnect?")).toBeVisible()
  expect(view.getByLabelText("Cancel")).toBeVisible()
  expect(view.getByLabelText("Confirm disconnect")).toBeVisible()
  expect(view.getByLabelText("Close disconnect confirmation")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(view.getByLabelText("Cancel")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(view.getByLabelText("Confirm disconnect")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(view.getByLabelText("Confirm disconnect")).toHaveStyle({
    backgroundColor: BACKGROUND_COLORS.dangerAction,
  })
  expect(view.getByText("Disconnect")).toHaveStyle({
    color: TEXT_COLORS.onDanger,
  })
})

test("calls onConfirm when the Disconnect button is pressed", async () => {
  const onConfirm = jest.fn()
  const onCancel = jest.fn()
  const view = await render(
    <ConfirmDisconnectModal
      visible
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )

  await fireEvent.press(view.getByLabelText("Confirm disconnect"))

  expect(onConfirm).toHaveBeenCalledTimes(1)
  expect(onCancel).not.toHaveBeenCalled()
})

test("calls onCancel when the Cancel button is pressed", async () => {
  const onConfirm = jest.fn()
  const onCancel = jest.fn()
  const view = await render(
    <ConfirmDisconnectModal
      visible
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )

  await fireEvent.press(view.getByLabelText("Cancel"))

  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(onConfirm).not.toHaveBeenCalled()
})

test("calls onCancel when the backdrop is pressed", async () => {
  const onConfirm = jest.fn()
  const onCancel = jest.fn()
  const view = await render(
    <ConfirmDisconnectModal
      visible
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )

  await fireEvent.press(view.getByLabelText("Close disconnect confirmation"))

  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(onConfirm).not.toHaveBeenCalled()
})
