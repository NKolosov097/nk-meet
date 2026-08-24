import { render, screen } from "@testing-library/react-native"

import { TEXT_COLORS } from "@/constants/colors"

import { DeviceDropdown } from "./DeviceDropdown"

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
  expect(screen.getByLabelText("Headset microphone device")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(screen.getByLabelText("Headset microphone device")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ selected: false }),
  )
})
