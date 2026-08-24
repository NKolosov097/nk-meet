// a11y:components/room/ControlBar.tsx
// a11y:components/icons/DisconnectIcon.tsx
import { Alert } from "react-native"

import { act, fireEvent, render, waitFor } from "@testing-library/react-native"

import { BACKGROUND_COLORS } from "@/constants/colors"

import { ControlBar } from "./ControlBar"
import { CameraControl } from "./controls/CameraControl"
import { MicrophoneControl } from "./controls/MicrophoneControl"

jest.mock("@livekit/react-native", () => ({
  useLocalParticipant: jest.fn(),
  useRoomContext: jest.fn(),
}))

const {
  useLocalParticipant: mockUseLocalParticipant,
  useRoomContext: mockUseRoomContext,
} = jest.requireMock("@livekit/react-native") as {
  useLocalParticipant: jest.Mock
  useRoomContext: jest.Mock
}

type Deferred = {
  promise: Promise<void>
  resolve: VoidFunction
}

type PressTarget = {
  props: {
    onClick?: () => unknown
  }
}

const noop: VoidFunction = () => undefined

const pressTwice = async (target: PressTarget): Promise<void> => {
  // RNTL's public fireEvent.press awaits the async handler, so invoking it
  // twice cannot exercise two presses in the same pending window.
  await act(async () => {
    if (!target.props.onClick) {
      throw new Error("Accessible control has no onClick handler")
    }

    target.props.onClick()
    target.props.onClick()
  })
}

const createDeferred = (): Deferred => {
  let resolve: VoidFunction = noop
  const promise = new Promise<void>(complete => {
    resolve = complete
  })

  return { promise, resolve }
}

const mockRoom = {
  disconnect: jest.fn<Promise<void>, []>(),
  getActiveDevice: jest.fn<string | undefined, [MediaDeviceKind]>(),
  switchActiveDevice: jest.fn<Promise<void>, [MediaDeviceKind, string]>(),
  on: jest.fn(),
  off: jest.fn(),
}

const mockLocalParticipant = {
  setCameraEnabled: jest.fn<Promise<void>, [boolean]>(),
  setMicrophoneEnabled: jest.fn<Promise<void>, [boolean]>(),
}

let mockCameraEnabled = false
let mockMicrophoneEnabled = true

beforeAll(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { enumerateDevices: jest.fn() },
  })
})

beforeEach(() => {
  jest.clearAllMocks()
  mockCameraEnabled = false
  mockMicrophoneEnabled = true
  mockRoom.disconnect.mockResolvedValue(undefined)
  mockRoom.getActiveDevice.mockReturnValue(undefined)
  mockRoom.switchActiveDevice.mockResolvedValue(undefined)
  mockLocalParticipant.setCameraEnabled.mockResolvedValue(undefined)
  mockLocalParticipant.setMicrophoneEnabled.mockResolvedValue(undefined)
  mockUseRoomContext.mockReturnValue(mockRoom)
  mockUseLocalParticipant.mockImplementation(() => ({
    isCameraEnabled: mockCameraEnabled,
    isMicrophoneEnabled: mockMicrophoneEnabled,
    localParticipant: mockLocalParticipant,
  }))
  ;(navigator.mediaDevices.enumerateDevices as jest.Mock).mockResolvedValue([])
})

afterEach(() => {
  jest.restoreAllMocks()
})

test("updates toggle direction after hook state changes on the same ControlBar instance", async () => {
  const view = await render(<ControlBar />)

  await fireEvent.press(view.getByLabelText("Mute microphone"))
  await fireEvent.press(view.getByLabelText("Turn on camera"))

  await waitFor(() => {
    expect(mockLocalParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(
      false,
    )
    expect(mockLocalParticipant.setCameraEnabled).toHaveBeenCalledWith(true)
  })

  mockMicrophoneEnabled = false
  mockCameraEnabled = true
  await view.rerender(<ControlBar />)

  await fireEvent.press(view.getByLabelText("Unmute microphone"))
  await fireEvent.press(view.getByLabelText("Turn off camera"))

  await waitFor(() => {
    expect(mockLocalParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(
      true,
    )
    expect(mockLocalParticipant.setCameraEnabled).toHaveBeenLastCalledWith(
      false,
    )
  })
})

test("ignores concurrent microphone toggles until the current toggle finishes", async () => {
  const pendingToggle = createDeferred()
  mockLocalParticipant.setMicrophoneEnabled.mockReturnValue(
    pendingToggle.promise,
  )
  const view = await render(<ControlBar />)

  await pressTwice(view.getByLabelText("Mute microphone"))

  expect(mockLocalParticipant.setMicrophoneEnabled).toHaveBeenCalledTimes(1)

  await act(async () => {
    pendingToggle.resolve()
    await pendingToggle.promise
  })

  await fireEvent.press(view.getByLabelText("Mute microphone"))

  expect(mockLocalParticipant.setMicrophoneEnabled).toHaveBeenCalledTimes(2)
})

test("disables the microphone button while its toggle is pending", async () => {
  const pendingToggle = createDeferred()
  mockLocalParticipant.setMicrophoneEnabled.mockReturnValue(
    pendingToggle.promise,
  )
  const view = await render(<ControlBar />)
  const button = view.getByLabelText("Mute microphone")

  await act(async () => {
    button.props.onClick?.()
  })

  expect(
    view.getByLabelText("Mute microphone").props.accessibilityState?.disabled,
  ).toBe(true)

  await act(async () => {
    pendingToggle.resolve()
    await pendingToggle.promise
  })

  expect(
    view.getByLabelText("Mute microphone").props.accessibilityState?.disabled,
  ).toBeFalsy()
})

test("re-enables the microphone button after a failed toggle", async () => {
  jest.spyOn(Alert, "alert").mockImplementation()
  jest.spyOn(console, "error").mockImplementation()
  let rejectToggle: (error: Error) => void = noop
  const pendingToggle = new Promise<void>((_, reject) => {
    rejectToggle = reject
  })
  mockLocalParticipant.setMicrophoneEnabled.mockReturnValue(pendingToggle)
  const view = await render(<ControlBar />)
  const button = view.getByLabelText("Mute microphone")

  await act(async () => {
    button.props.onClick?.()
  })

  expect(
    view.getByLabelText("Mute microphone").props.accessibilityState?.disabled,
  ).toBe(true)

  await act(async () => {
    rejectToggle(new Error("microphone failed"))
    await pendingToggle.catch(noop)
  })

  expect(
    view.getByLabelText("Mute microphone").props.accessibilityState?.disabled,
  ).toBeFalsy()
})

test("dims the microphone button when disabled", async () => {
  const disabled = await render(
    <MicrophoneControl
      isMuted={false}
      onToggleMute={noop}
      disabled
      isDropdownVisible={false}
      onToggleDropdown={noop}
      onCloseDropdown={noop}
    />,
  )
  const enabled = await render(
    <MicrophoneControl
      isMuted={false}
      onToggleMute={noop}
      disabled={false}
      isDropdownVisible={false}
      onToggleDropdown={noop}
      onCloseDropdown={noop}
    />,
  )

  expect(disabled.getByLabelText("Mute microphone")).toHaveStyle({
    opacity: 0.4,
  })
  expect(enabled.getByLabelText("Mute microphone")).toHaveStyle({
    opacity: 1,
  })
})

test("ignores concurrent camera toggles until the current toggle finishes", async () => {
  const pendingToggle = createDeferred()
  mockLocalParticipant.setCameraEnabled.mockReturnValue(pendingToggle.promise)
  const view = await render(<ControlBar />)

  await pressTwice(view.getByLabelText("Turn on camera"))

  expect(mockLocalParticipant.setCameraEnabled).toHaveBeenCalledTimes(1)

  await act(async () => {
    pendingToggle.resolve()
    await pendingToggle.promise
  })

  await fireEvent.press(view.getByLabelText("Turn on camera"))

  expect(mockLocalParticipant.setCameraEnabled).toHaveBeenCalledTimes(2)
})

test("disables the camera button while its toggle is pending", async () => {
  const pendingToggle = createDeferred()
  mockLocalParticipant.setCameraEnabled.mockReturnValue(pendingToggle.promise)
  const view = await render(<ControlBar />)
  const button = view.getByLabelText("Turn on camera")

  await act(async () => {
    button.props.onClick?.()
  })

  expect(
    view.getByLabelText("Turn on camera").props.accessibilityState?.disabled,
  ).toBe(true)

  await act(async () => {
    pendingToggle.resolve()
    await pendingToggle.promise
  })

  expect(
    view.getByLabelText("Turn on camera").props.accessibilityState?.disabled,
  ).toBeFalsy()
})

test("re-enables the camera button after a failed toggle", async () => {
  jest.spyOn(Alert, "alert").mockImplementation()
  jest.spyOn(console, "error").mockImplementation()
  let rejectToggle: (error: Error) => void = noop
  const pendingToggle = new Promise<void>((_, reject) => {
    rejectToggle = reject
  })
  mockLocalParticipant.setCameraEnabled.mockReturnValue(pendingToggle)
  const view = await render(<ControlBar />)
  const button = view.getByLabelText("Turn on camera")

  await act(async () => {
    button.props.onClick?.()
  })

  expect(
    view.getByLabelText("Turn on camera").props.accessibilityState?.disabled,
  ).toBe(true)

  await act(async () => {
    rejectToggle(new Error("camera failed"))
    await pendingToggle.catch(noop)
  })

  expect(
    view.getByLabelText("Turn on camera").props.accessibilityState?.disabled,
  ).toBeFalsy()
})

test("dims the camera button when disabled", async () => {
  const disabled = await render(
    <CameraControl
      isVideoEnabled={false}
      onToggleVideo={noop}
      disabled
      isDropdownVisible={false}
      onToggleDropdown={noop}
      onCloseDropdown={noop}
    />,
  )
  const enabled = await render(
    <CameraControl
      isVideoEnabled={false}
      onToggleVideo={noop}
      disabled={false}
      isDropdownVisible={false}
      onToggleDropdown={noop}
      onCloseDropdown={noop}
    />,
  )

  expect(disabled.getByLabelText("Turn on camera")).toHaveStyle({
    opacity: 0.4,
  })
  expect(enabled.getByLabelText("Turn on camera")).toHaveStyle({
    opacity: 1,
  })
})

test("alerts when the microphone toggle fails", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation()
  const consoleError = jest.spyOn(console, "error").mockImplementation()
  mockLocalParticipant.setMicrophoneEnabled.mockRejectedValue(
    new Error("microphone failed"),
  )
  const view = await render(<ControlBar />)

  await fireEvent.press(view.getByLabelText("Mute microphone"))

  await waitFor(() => {
    expect(alert).toHaveBeenCalledWith("Error", "Failed to toggle microphone")
    expect(consoleError).toHaveBeenCalledWith(
      "Error toggling microphone: ",
      expect.any(Error),
    )
  })
})

test("alerts when the camera toggle fails", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation()
  const consoleError = jest.spyOn(console, "error").mockImplementation()
  mockLocalParticipant.setCameraEnabled.mockRejectedValue(
    new Error("camera failed"),
  )
  const view = await render(<ControlBar />)

  await fireEvent.press(view.getByLabelText("Turn on camera"))

  await waitFor(() => {
    expect(alert).toHaveBeenCalledWith("Error", "Failed to toggle camera")
    expect(consoleError).toHaveBeenCalledWith(
      "Error toggling camera: ",
      expect.any(Error),
    )
  })
})

test("shows a confirmation modal instead of disconnecting immediately", async () => {
  const view = await render(<ControlBar />)

  await fireEvent.press(view.getByLabelText("Disconnect from room"))

  expect(view.getByText("Disconnect?")).toBeVisible()
  expect(mockRoom.disconnect).not.toHaveBeenCalled()
})

test("uses the updated rounded-square shape for disconnect", async () => {
  const view = await render(<ControlBar />)

  const disconnectButton = view.getByLabelText("Disconnect from room")

  expect(disconnectButton).toHaveStyle({
    borderRadius: 8,
  })
  expect(disconnectButton).toHaveProp("accessibilityRole", "button")
  expect(disconnectButton).toHaveStyle({
    backgroundColor: BACKGROUND_COLORS.dangerAction,
  })
})

test("disconnects the room after confirming", async () => {
  const view = await render(<ControlBar />)

  await fireEvent.press(view.getByLabelText("Disconnect from room"))
  await fireEvent.press(view.getByLabelText("Confirm disconnect"))

  await waitFor(() => {
    expect(mockRoom.disconnect).toHaveBeenCalledTimes(1)
  })
})

test("does not disconnect when the confirmation is canceled", async () => {
  const view = await render(<ControlBar />)

  await fireEvent.press(view.getByLabelText("Disconnect from room"))
  await fireEvent.press(view.getByLabelText("Cancel"))

  expect(mockRoom.disconnect).not.toHaveBeenCalled()
  expect(view.queryByText("Disconnect?")).not.toBeOnTheScreen()
})

test("does not disconnect when tapping outside the confirmation", async () => {
  const view = await render(<ControlBar />)

  await fireEvent.press(view.getByLabelText("Disconnect from room"))
  await fireEvent.press(view.getByLabelText("Close disconnect confirmation"))

  expect(mockRoom.disconnect).not.toHaveBeenCalled()
  expect(view.queryByText("Disconnect?")).not.toBeOnTheScreen()
})

test("keeps controls available after a disconnect failure", async () => {
  const error = new Error("disconnect failed")
  const consoleError = jest.spyOn(console, "error").mockImplementation()
  mockRoom.disconnect.mockRejectedValue(error)
  const view = await render(<ControlBar />)

  await fireEvent.press(view.getByLabelText("Disconnect from room"))
  await fireEvent.press(view.getByLabelText("Confirm disconnect"))

  await waitFor(() => {
    expect(consoleError).toHaveBeenCalledWith("Error disconnecting: ", error)
  })
  expect(view.queryByText("Disconnect?")).not.toBeOnTheScreen()
  expect(view.getByLabelText("Mute microphone")).toBeVisible()
  expect(view.getByLabelText("Turn on camera")).toBeVisible()
  expect(view.getByLabelText("Disconnect from room")).toBeVisible()
})

test("coordinates audio and camera device dropdowns", async () => {
  const view = await render(<ControlBar />)

  await fireEvent.press(view.getByLabelText("Select audio device"))

  expect(view.getByLabelText("Close device list")).toBeVisible()
  expect(view.getByText("No audio devices found")).toBeVisible()

  await fireEvent.press(view.getByLabelText("Select camera"))

  expect(view.queryByLabelText("Close device list")).not.toBeOnTheScreen()
  expect(view.getByLabelText("Close camera list")).toBeVisible()
  expect(view.getByText("No cameras found")).toBeVisible()

  await fireEvent.press(view.getByLabelText("Close camera list"))

  expect(view.queryByLabelText("Close camera list")).not.toBeOnTheScreen()
  expect(view.queryByText("No cameras found")).not.toBeOnTheScreen()
})
