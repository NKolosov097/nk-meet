import { render, screen } from "@testing-library/react-native"

import { DeviceDropdown } from "./DeviceDropdown"

test("announces the selected device as a selected button", async () => {
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
})
