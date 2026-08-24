// a11y:components/room/controls/DeviceDropdown.tsx
import { useState } from "react"

import { fireEvent, render, screen } from "@testing-library/react-native"

import { BORDER_COLORS, TEXT_COLORS } from "@/constants/colors"

import { DeviceDropdown } from "./DeviceDropdown"

const DeviceDropdownSelectionHarness = () => {
  const [selectedDeviceId, setSelectedDeviceId] = useState("mic-1")

  return (
    <DeviceDropdown
      sections={[
        {
          title: "Select microphone",
          items: [
            {
              deviceId: "mic-1",
              label: "Desk microphone",
              selected: selectedDeviceId === "mic-1",
              onPress: () => setSelectedDeviceId("mic-1"),
            },
            {
              deviceId: "mic-2",
              label: "Headset microphone",
              selected: selectedDeviceId === "mic-2",
              onPress: () => setSelectedDeviceId("mic-2"),
            },
          ],
        },
      ]}
      emptyMessage="No audio devices found"
    />
  )
}

test("announces selected and unselected device rows as buttons", async () => {
  await render(
    <DeviceDropdown
      sections={[
        {
          title: "Select microphone",
          items: [
            {
              deviceId: "mic-1",
              label: "Desk microphone",
              selected: true,
              onPress: (): void => undefined,
            },
            {
              deviceId: "mic-2",
              label: "Headset microphone",
              selected: false,
              onPress: (): void => undefined,
            },
          ],
        },
      ]}
      emptyMessage="No audio devices found"
    />,
  )

  expect(screen.getByLabelText("Desk microphone device")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(screen.getByLabelText("Desk microphone device")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ selected: true }),
  )
  expect(screen.getByText("Desk microphone")).toHaveStyle({
    color: TEXT_COLORS.onPrimary,
  })
  expect(screen.getByLabelText("Desk microphone device")).toHaveStyle({
    borderBottomColor: BORDER_COLORS.controlDivider,
  })
  expect(screen.getByLabelText("Headset microphone device")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(screen.getByLabelText("Headset microphone device")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ selected: false }),
  )
})

test("moves the visible selection indicator to the newly selected device", async () => {
  await render(<DeviceDropdownSelectionHarness />)

  expect(screen.getByLabelText("Desk microphone device")).toHaveStyle({
    borderColor: BORDER_COLORS.selectionIndicator,
    borderWidth: 2,
  })

  await fireEvent.press(screen.getByLabelText("Headset microphone device"))

  expect(screen.getByLabelText("Desk microphone device")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ selected: false }),
  )
  expect(screen.getByLabelText("Headset microphone device")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ selected: true }),
  )
  expect(screen.getByLabelText("Headset microphone device")).toHaveStyle({
    borderColor: BORDER_COLORS.selectionIndicator,
    borderWidth: 2,
  })
})
