// a11y:components/room/controls/CameraControl.tsx
// a11y:components/room/controls/MicrophoneControl.tsx
// a11y:components/icons/CameraDisabledIcon.tsx
// a11y:components/icons/CameraIcon.tsx
// a11y:components/icons/MicDisabledIcon.tsx
// a11y:components/icons/MicIcon.tsx
import { Alert } from "react-native"

import { act, fireEvent, render, waitFor } from "@testing-library/react-native"

import { RoomEvent } from "livekit-client"

import { TEXT_COLORS } from "@/constants/colors"

import { CameraControl } from "./CameraControl"
import { MicrophoneControl } from "./MicrophoneControl"

jest.mock("@livekit/react-native", () => ({
  useRoomContext: jest.fn(),
}))

const { useRoomContext: mockUseRoomContext } = jest.requireMock(
  "@livekit/react-native",
) as { useRoomContext: jest.Mock }

const devices: MediaDeviceInfo[] = [
  {
    deviceId: "mic-1",
    groupId: "audio",
    kind: "audioinput",
    label: "Desk microphone",
    toJSON: jest.fn(),
  },
  {
    deviceId: "speaker-1",
    groupId: "audio",
    kind: "audiooutput",
    label: "Desk speakers",
    toJSON: jest.fn(),
  },
  {
    deviceId: "camera-1",
    groupId: "video",
    kind: "videoinput",
    label: "Front camera",
    toJSON: jest.fn(),
  },
]

const microphoneProps = (onCloseDropdown = jest.fn()) => ({
  isMuted: false,
  onToggleMute: jest.fn(),
  disabled: false,
  isDropdownVisible: true,
  onToggleDropdown: jest.fn(),
  onCloseDropdown,
})

const cameraProps = (onCloseDropdown = jest.fn()) => ({
  isVideoEnabled: true,
  onToggleVideo: jest.fn(),
  disabled: false,
  isDropdownVisible: true,
  onToggleDropdown: jest.fn(),
  onCloseDropdown,
})

let enumeratedDevices: MediaDeviceInfo[]
let mediaDevicesChangedCallback: VoidFunction | undefined

const enumerateDevices = jest.fn<Promise<MediaDeviceInfo[]>, []>()
const addEventListener = jest.fn()
const removeEventListener = jest.fn()
const getActiveDevice = jest.fn<string | undefined, [MediaDeviceKind]>()
const switchActiveDevice = jest.fn<Promise<void>, [MediaDeviceKind, string]>()
const on = jest.fn()
const off = jest.fn()
const room = {
  getActiveDevice,
  switchActiveDevice,
  on,
  off,
}

const waitForText = async (
  view: Awaited<ReturnType<typeof render>>,
  text: string,
) => {
  await waitFor(() => {
    expect(view.getByText(text)).toBeVisible()
  })

  return view.getByText(text)
}

beforeAll(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      enumerateDevices,
      addEventListener,
      removeEventListener,
    },
  })
})

beforeEach(() => {
  jest.clearAllMocks()
  enumeratedDevices = devices
  mediaDevicesChangedCallback = undefined
  enumerateDevices.mockImplementation(async () => enumeratedDevices)
  getActiveDevice.mockReturnValue(undefined)
  switchActiveDevice.mockResolvedValue(undefined)
  on.mockImplementation((event: RoomEvent, callback: VoidFunction) => {
    if (event === RoomEvent.MediaDevicesChanged) {
      mediaDevicesChangedCallback = callback
    }
  })
  mockUseRoomContext.mockReturnValue(room)
})

afterEach(() => {
  jest.restoreAllMocks()
})

test("discovers only audio devices in the microphone dropdown", async () => {
  const view = await render(<MicrophoneControl {...microphoneProps()} />)

  expect(await waitForText(view, "Select microphone")).toBeVisible()
  expect(await waitForText(view, "Desk microphone")).toBeVisible()
  expect(view.getByText("Desk speakers")).toBeVisible()
  expect(view.queryByText("Front camera")).not.toBeOnTheScreen()
})

test("discovers only cameras in the camera dropdown", async () => {
  const view = await render(<CameraControl {...cameraProps()} />)

  expect(await waitForText(view, "Select camera")).toBeVisible()
  expect(await waitForText(view, "Front camera")).toBeVisible()
  expect(view.queryByText("Desk microphone")).not.toBeOnTheScreen()
  expect(view.queryByText("Desk speakers")).not.toBeOnTheScreen()
})

test("announces selected and unselected camera, microphone, and speaker rows", async () => {
  enumeratedDevices = [
    ...devices,
    {
      deviceId: "mic-2",
      groupId: "audio",
      kind: "audioinput",
      label: "Travel microphone",
      toJSON: jest.fn(),
    },
    {
      deviceId: "speaker-2",
      groupId: "audio",
      kind: "audiooutput",
      label: "Headset speakers",
      toJSON: jest.fn(),
    },
    {
      deviceId: "camera-2",
      groupId: "video",
      kind: "videoinput",
      label: "Rear camera",
      toJSON: jest.fn(),
    },
  ]
  getActiveDevice.mockImplementation(kind => {
    if (kind === "audioinput") return "mic-1"
    if (kind === "videoinput") return "camera-1"

    return undefined
  })
  const microphone = await render(<MicrophoneControl {...microphoneProps()} />)

  await waitForText(microphone, "Desk microphone")
  expect(microphone.getByLabelText("Desk microphone device")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(microphone.getByLabelText("Desk microphone device")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ selected: true }),
  )
  expect(microphone.getByText("Desk microphone")).toHaveStyle({
    color: TEXT_COLORS.onPrimary,
  })
  expect(microphone.getByLabelText("Travel microphone device")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(microphone.getByLabelText("Travel microphone device")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ selected: false }),
  )
  expect(microphone.getByLabelText("Desk speakers device")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(microphone.getByLabelText("Desk speakers device")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ selected: false }),
  )

  await fireEvent.press(microphone.getByLabelText("Desk speakers device"))

  await waitFor(() => {
    expect(microphone.getByLabelText("Desk speakers device")).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ selected: true }),
    )
  })
  expect(microphone.getByText("Desk speakers")).toHaveStyle({
    color: TEXT_COLORS.onPrimary,
  })
  expect(microphone.getByLabelText("Headset speakers device")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(microphone.getByLabelText("Headset speakers device")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ selected: false }),
  )

  await microphone.unmount()
  const camera = await render(<CameraControl {...cameraProps()} />)

  await waitForText(camera, "Front camera")
  expect(camera.getByLabelText("Front camera device")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(camera.getByLabelText("Front camera device")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ selected: true }),
  )
  expect(camera.getByText("Front camera")).toHaveStyle({
    color: TEXT_COLORS.onPrimary,
  })
  expect(camera.getByLabelText("Rear camera device")).toHaveProp(
    "accessibilityRole",
    "button",
  )
  expect(camera.getByLabelText("Rear camera device")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ selected: false }),
  )
})

test("keeps the microphone control stable when device enumeration rejects", async () => {
  const error = new Error("audio enumeration failed")
  const consoleError = jest.spyOn(console, "error").mockImplementation()
  enumerateDevices.mockRejectedValueOnce(error)

  const view = await render(<MicrophoneControl {...microphoneProps()} />)

  await waitFor(() => {
    expect(consoleError).toHaveBeenCalledWith(
      "Error loading audio devices: ",
      error,
    )
  })
  expect(view.getByLabelText("Mute microphone")).toBeVisible()
  expect(view.getByLabelText("Select audio device")).toBeVisible()
  expect(view.getByText("No audio devices found")).toBeVisible()
})

test("keeps the camera control stable when device enumeration rejects", async () => {
  const error = new Error("camera enumeration failed")
  const consoleError = jest.spyOn(console, "error").mockImplementation()
  enumerateDevices.mockRejectedValueOnce(error)

  const view = await render(<CameraControl {...cameraProps()} />)

  await waitFor(() => {
    expect(consoleError).toHaveBeenCalledWith(
      "Error loading video devices: ",
      error,
    )
  })
  expect(view.getByLabelText("Turn off camera")).toBeVisible()
  expect(view.getByLabelText("Select camera")).toBeVisible()
  expect(view.getByText("No cameras found")).toBeVisible()
})

test("shows empty device states", async () => {
  enumeratedDevices = []
  const microphone = await render(<MicrophoneControl {...microphoneProps()} />)

  expect(await waitForText(microphone, "No audio devices found")).toBeVisible()
  const camera = await render(<CameraControl {...cameraProps()} />)
  expect(await waitForText(camera, "No cameras found")).toBeVisible()
})

test("uses fallback labels with combined audio device suffixes", async () => {
  enumeratedDevices = [
    {
      deviceId: "microphone-abcdef123",
      groupId: "audio",
      kind: "audioinput",
      label: "",
      toJSON: jest.fn(),
    },
  ]
  const microphone = await render(<MicrophoneControl {...microphoneProps()} />)

  expect(
    await waitForText(microphone, "Microphone micropho (Input)"),
  ).toBeVisible()

  await microphone.unmount()
  enumeratedDevices = [
    {
      deviceId: "speaker-abcdef123",
      groupId: "audio",
      kind: "audiooutput",
      label: "",
      toJSON: jest.fn(),
    },
  ]
  const speaker = await render(<MicrophoneControl {...microphoneProps()} />)

  expect(await waitForText(speaker, "Speaker speaker- (Output)")).toBeVisible()

  await speaker.unmount()
  enumeratedDevices = [
    {
      deviceId: "camera-abcdef123",
      groupId: "video",
      kind: "videoinput",
      label: "",
      toJSON: jest.fn(),
    },
  ]
  const camera = await render(<CameraControl {...cameraProps()} />)

  expect(await waitForText(camera, "Camera camera-a")).toBeVisible()
})

test("initializes missing audio and camera devices with the first matching device", async () => {
  getActiveDevice.mockImplementation(kind => {
    if (kind === "audioinput") return "missing-mic"
    if (kind === "videoinput") return "missing-camera"

    return undefined
  })
  const microphone = await render(<MicrophoneControl {...microphoneProps()} />)
  await waitForText(microphone, "Desk microphone")

  await waitFor(() => {
    expect(switchActiveDevice).toHaveBeenCalledWith("audioinput", "mic-1")
  })
  const camera = await render(<CameraControl {...cameraProps()} />)
  await waitForText(camera, "Front camera")
  await waitFor(() => {
    expect(switchActiveDevice).toHaveBeenCalledWith("videoinput", "camera-1")
  })
})

test("preserves audio and camera devices that are still available", async () => {
  getActiveDevice.mockImplementation(kind => {
    if (kind === "audioinput") return "mic-1"
    if (kind === "videoinput") return "camera-1"

    return undefined
  })
  const microphone = await render(<MicrophoneControl {...microphoneProps()} />)
  await waitForText(microphone, "Desk microphone")

  await waitFor(() => {
    expect(enumerateDevices).toHaveBeenCalledTimes(1)
  })
  const camera = await render(<CameraControl {...cameraProps()} />)
  await waitForText(camera, "Front camera")
  await waitFor(() => {
    expect(enumerateDevices).toHaveBeenCalledTimes(2)
  })
  expect(switchActiveDevice).not.toHaveBeenCalled()
})

test("switches selected input, output, and camera devices then closes each dropdown", async () => {
  getActiveDevice.mockImplementation(kind => {
    if (kind === "audioinput") return "mic-1"
    if (kind === "videoinput") return "camera-1"

    return undefined
  })
  const closeInput = jest.fn()
  const input = await render(
    <MicrophoneControl {...microphoneProps(closeInput)} />,
  )
  await fireEvent.press(await waitForText(input, "Desk microphone"))
  await waitFor(() => {
    expect(switchActiveDevice).toHaveBeenCalledWith("audioinput", "mic-1")
    expect(closeInput).toHaveBeenCalledTimes(1)
  })

  await input.unmount()
  const closeOutput = jest.fn()
  const output = await render(
    <MicrophoneControl {...microphoneProps(closeOutput)} />,
  )
  await fireEvent.press(await waitForText(output, "Desk speakers"))
  await waitFor(() => {
    expect(switchActiveDevice).toHaveBeenCalledWith("audiooutput", "speaker-1")
    expect(closeOutput).toHaveBeenCalledTimes(1)
  })

  await output.unmount()
  const closeCamera = jest.fn()
  const camera = await render(<CameraControl {...cameraProps(closeCamera)} />)
  await fireEvent.press(await waitForText(camera, "Front camera"))
  await waitFor(() => {
    expect(switchActiveDevice).toHaveBeenCalledWith("videoinput", "camera-1")
    expect(closeCamera).toHaveBeenCalledTimes(1)
  })
})

test("keeps the audio dropdown open and alerts when audio selection fails", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation()
  jest.spyOn(console, "error").mockImplementation()
  const closeDropdown = jest.fn()
  getActiveDevice.mockImplementation(kind =>
    kind === "audioinput" ? "mic-1" : undefined,
  )
  switchActiveDevice.mockRejectedValueOnce(new Error("audio failed"))
  const view = await render(
    <MicrophoneControl {...microphoneProps(closeDropdown)} />,
  )

  await fireEvent.press(await waitForText(view, "Desk microphone"))

  await waitFor(() => {
    expect(alert).toHaveBeenCalledWith("Error", "Failed to switch audio device")
  })
  expect(closeDropdown).not.toHaveBeenCalled()
  expect(view.getByText("Desk microphone")).toBeVisible()
})

test("keeps the camera dropdown open and alerts when camera selection fails", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation()
  jest.spyOn(console, "error").mockImplementation()
  const closeDropdown = jest.fn()
  getActiveDevice.mockImplementation(kind =>
    kind === "videoinput" ? "camera-1" : undefined,
  )
  switchActiveDevice.mockRejectedValueOnce(new Error("camera failed"))
  const view = await render(<CameraControl {...cameraProps(closeDropdown)} />)

  await fireEvent.press(await waitForText(view, "Front camera"))

  await waitFor(() => {
    expect(alert).toHaveBeenCalledWith("Error", "Failed to switch camera")
  })
  expect(closeDropdown).not.toHaveBeenCalled()
  expect(view.getByText("Front camera")).toBeVisible()
})

test("refreshes audio devices and removes the subscribed callback on unmount", async () => {
  const view = await render(<MicrophoneControl {...microphoneProps()} />)

  expect(await waitForText(view, "Desk microphone")).toBeVisible()
  await waitFor(() => {
    expect(mediaDevicesChangedCallback).toEqual(expect.any(Function))
  })
  const registeredCallback = mediaDevicesChangedCallback
  enumeratedDevices = [
    {
      deviceId: "usb-mic-1",
      groupId: "audio",
      kind: "audioinput",
      label: "USB microphone",
      toJSON: jest.fn(),
    },
  ]

  await act(async () => {
    await mediaDevicesChangedCallback?.()
  })

  expect(await waitForText(view, "USB microphone (Input)")).toBeVisible()
  expect(view.queryByText("Desk microphone")).not.toBeOnTheScreen()

  await view.unmount()

  expect(off).toHaveBeenCalledWith(
    RoomEvent.MediaDevicesChanged,
    registeredCallback,
  )
})

test("refreshes cameras and removes the subscribed callback on unmount", async () => {
  const view = await render(<CameraControl {...cameraProps()} />)

  expect(await waitForText(view, "Front camera")).toBeVisible()
  await waitFor(() => {
    expect(mediaDevicesChangedCallback).toEqual(expect.any(Function))
  })
  const registeredCallback = mediaDevicesChangedCallback
  enumeratedDevices = [
    {
      deviceId: "usb-camera-1",
      groupId: "video",
      kind: "videoinput",
      label: "USB camera",
      toJSON: jest.fn(),
    },
  ]

  await act(async () => {
    await mediaDevicesChangedCallback?.()
  })

  expect(await waitForText(view, "USB camera")).toBeVisible()
  expect(view.queryByText("Front camera")).not.toBeOnTheScreen()

  await view.unmount()

  expect(off).toHaveBeenCalledWith(
    RoomEvent.MediaDevicesChanged,
    registeredCallback,
  )
})

test("sizes the microphone device overlay to cover the full window", async () => {
  const view = await render(<MicrophoneControl {...microphoneProps()} />)

  const overlay = view.getByLabelText("Close device list")
  expect(overlay).toHaveProp("accessibilityRole", "button")
  const flattenedStyle = Object.assign({}, ...overlay.props.style)

  expect(flattenedStyle.width).toBeGreaterThan(0)
  expect(flattenedStyle.height).toBeGreaterThan(0)
})

test("sizes the camera device overlay to cover the full window", async () => {
  const view = await render(<CameraControl {...cameraProps()} />)

  const overlay = view.getByLabelText("Close camera list")
  expect(overlay).toHaveProp("accessibilityRole", "button")
  const flattenedStyle = Object.assign({}, ...overlay.props.style)

  expect(flattenedStyle.width).toBeGreaterThan(0)
  expect(flattenedStyle.height).toBeGreaterThan(0)
})
