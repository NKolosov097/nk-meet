import { Text } from "react-native"

import { render, screen } from "@testing-library/react-native"

import { MediaDeviceButton } from "./MediaDeviceButton"

const noop = (): void => undefined

test("renders a compact compound media button with an optional centered label", async () => {
  await render(
    <MediaDeviceButton
      icon={<Text>icon</Text>}
      text="Camera"
      onToggle={noop}
      onToggleDropdown={noop}
      toggleAccessibilityLabel="Toggle camera"
      dropdownAccessibilityLabel="Select camera"
      disabled={false}
      isDropdownVisible={false}
    />,
  )

  expect(screen.getByLabelText("Toggle camera")).toHaveStyle({ height: 44 })
  expect(screen.getByLabelText("Select camera")).toHaveStyle({ height: 44 })
  expect(screen.getByLabelText("Toggle camera")).toHaveStyle({
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  })
  expect(screen.getByLabelText("Select camera")).toHaveStyle({
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  })
  expect(screen.getByTestId("media-device-button-icon")).toHaveStyle({
    position: "absolute",
    left: 12,
  })
  expect(screen.getByTestId("media-device-button-label")).toHaveStyle({
    position: "absolute",
    left: 0,
    right: 0,
  })
  expect(screen.getByTestId("media-device-button-label")).toHaveProp(
    "pointerEvents",
    "none",
  )
})

test("keeps the meeting control icon-only when text is omitted", async () => {
  await render(
    <MediaDeviceButton
      icon={<Text>icon</Text>}
      onToggle={noop}
      onToggleDropdown={noop}
      toggleAccessibilityLabel="Toggle microphone"
      dropdownAccessibilityLabel="Select microphone"
      disabled={false}
      isDropdownVisible={false}
    />,
  )

  expect(screen.queryByTestId("media-device-button-text")).not.toBeOnTheScreen()
  expect(screen.getByLabelText("Toggle microphone")).toHaveStyle({ width: 44 })
})

test("keeps device selection available when only the media toggle is disabled", async () => {
  await render(
    <MediaDeviceButton
      icon={<Text>icon</Text>}
      onToggle={noop}
      onToggleDropdown={noop}
      toggleAccessibilityLabel="Toggle camera"
      dropdownAccessibilityLabel="Select camera"
      disabled
      isDropdownVisible={false}
    />,
  )

  expect(screen.getByLabelText("Toggle camera")).toBeDisabled()
  expect(screen.getByLabelText("Select camera")).toBeEnabled()
})

test("reports the closed and open state of the device selection disclosure", async () => {
  const view = await render(
    <MediaDeviceButton
      icon={<Text>icon</Text>}
      onToggle={noop}
      onToggleDropdown={noop}
      toggleAccessibilityLabel="Toggle camera"
      dropdownAccessibilityLabel="Select camera"
      disabled={false}
      isDropdownVisible={false}
    />,
  )

  expect(screen.getByLabelText("Select camera")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ expanded: false }),
  )

  await view.rerender(
    <MediaDeviceButton
      icon={<Text>icon</Text>}
      onToggle={noop}
      onToggleDropdown={noop}
      toggleAccessibilityLabel="Toggle camera"
      dropdownAccessibilityLabel="Select camera"
      disabled={false}
      isDropdownVisible
    />,
  )

  expect(screen.getByLabelText("Select camera")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ expanded: true }),
  )
})

test("exposes each media action as a button with its disabled state", async () => {
  await render(
    <MediaDeviceButton
      icon={<Text>icon</Text>}
      onToggle={noop}
      onToggleDropdown={noop}
      toggleAccessibilityLabel="Toggle camera"
      dropdownAccessibilityLabel="Select camera"
      disabled
      dropdownDisabled
      isDropdownVisible={false}
    />,
  )

  expect(screen.getByLabelText("Toggle camera")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(screen.getByLabelText("Toggle camera")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ disabled: true }),
  )
  expect(screen.getByLabelText("Select camera")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(screen.getByLabelText("Select camera")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ disabled: true, expanded: false }),
  )
})
