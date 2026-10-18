import { type Room, RoomEvent, Track } from "livekit-client"

import {
  initializeActiveMediaDevice,
  subscribeToMediaDevicesChanged,
} from "./useActiveMediaDevice"

const createRoom = (activeDevice?: string) => {
  const getActiveDevice = jest.fn(() => activeDevice)
  const switchActiveDevice = jest.fn().mockResolvedValue(undefined)
  const on = jest.fn()
  const off = jest.fn()

  return {
    room: {
      getActiveDevice,
      switchActiveDevice,
      on,
      off,
    } as unknown as Room,
    getActiveDevice,
    switchActiveDevice,
    on,
    off,
  }
}

test("selects the first camera when the active camera is unavailable", async () => {
  const { room, switchActiveDevice } = createRoom("missing-camera")

  await initializeActiveMediaDevice(room, Track.Source.Camera, [
    { deviceId: "camera-1" },
    { deviceId: "camera-2" },
  ])

  expect(switchActiveDevice).toHaveBeenCalledWith("videoinput", "camera-1")
})

test("selects the first microphone when the active microphone is unavailable", async () => {
  const { room, switchActiveDevice } = createRoom("missing-microphone")

  await initializeActiveMediaDevice(room, Track.Source.Microphone, [
    { deviceId: "microphone-1" },
  ])

  expect(switchActiveDevice).toHaveBeenCalledWith("audioinput", "microphone-1")
})

test("keeps an active device that remains available", async () => {
  const { room, switchActiveDevice } = createRoom("camera-2")

  await initializeActiveMediaDevice(room, Track.Source.Camera, [
    { deviceId: "camera-1" },
    { deviceId: "camera-2" },
  ])

  expect(switchActiveDevice).not.toHaveBeenCalled()
})

test("does not switch when no devices are available", async () => {
  const { room, switchActiveDevice } = createRoom("missing-camera")

  await initializeActiveMediaDevice(room, Track.Source.Camera, [])

  expect(switchActiveDevice).not.toHaveBeenCalled()
})

test("removes the same media-device listener during cleanup", () => {
  const { room, on, off } = createRoom()
  const onChange = jest.fn()

  const cleanup = subscribeToMediaDevicesChanged(room, onChange)

  expect(on).toHaveBeenCalledWith(RoomEvent.MediaDevicesChanged, onChange)

  cleanup()

  expect(off).toHaveBeenCalledWith(RoomEvent.MediaDevicesChanged, onChange)
})
