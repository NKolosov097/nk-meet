import { useEffect, useState } from "react"

import { Room, RoomEvent, Track } from "livekit-client"

import type { InputDeviceKind } from "@/types"

export type InputDeviceSource = Track.Source.Camera | Track.Source.Microphone

export type ActiveDeviceTarget = InputDeviceSource

type AvailableMediaDevice = Pick<MediaDeviceInfo, "deviceId">

const getMediaDeviceKind = (target: ActiveDeviceTarget): InputDeviceKind => {
  switch (target) {
    case Track.Source.Camera:
      return "videoinput"
    case Track.Source.Microphone:
      return "audioinput"
    default: {
      const exhaustiveTarget: never = target

      return exhaustiveTarget
    }
  }
}

export const initializeActiveMediaDevice = async (
  room: Room,
  sourceOrKind: ActiveDeviceTarget,
  availableDevices: AvailableMediaDevice[],
): Promise<void> => {
  const mediaDeviceKind = getMediaDeviceKind(sourceOrKind)
  const activeDevice = room.getActiveDevice(mediaDeviceKind)
  const hasActiveDevice = availableDevices.some(
    device => device.deviceId === activeDevice,
  )
  const fallbackDevice = availableDevices[0]

  if (hasActiveDevice || !fallbackDevice) {
    return
  }

  await room.switchActiveDevice(mediaDeviceKind, fallbackDevice.deviceId)
}

export const useActiveMediaDevice = (
  room: Room,
  sourceOrKind: ActiveDeviceTarget,
): string | undefined => {
  const mediaDeviceKind = getMediaDeviceKind(sourceOrKind)
  const [activeDevice, setActiveDevice] = useState(() =>
    room.getActiveDevice(mediaDeviceKind),
  )

  useEffect(() => {
    const synchronizeActiveDevice = () => {
      setActiveDevice(room.getActiveDevice(mediaDeviceKind))
    }
    const handleActiveDeviceChanged = (changedKind: MediaDeviceKind) => {
      if (changedKind === mediaDeviceKind) {
        synchronizeActiveDevice()
      }
    }

    synchronizeActiveDevice()
    room.on(RoomEvent.ActiveDeviceChanged, handleActiveDeviceChanged)

    return () => {
      room.off(RoomEvent.ActiveDeviceChanged, handleActiveDeviceChanged)
    }
  }, [room, mediaDeviceKind])

  return activeDevice
}

export const subscribeToMediaDevicesChanged = (
  room: Room,
  onChange: VoidFunction,
): VoidFunction => {
  room.on(RoomEvent.MediaDevicesChanged, onChange)

  return () => {
    room.off(RoomEvent.MediaDevicesChanged, onChange)
  }
}
