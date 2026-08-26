import { act, renderHook, waitFor } from "@testing-library/react-native"

import { RoomEvent, type RemoteParticipant, type Room } from "livekit-client"

import {
  MEETING_STARTED_AT_ATTRIBUTE,
  useSharedMeetingStartedAt,
} from "./useSharedMeetingStartedAt"

const mockSetAttributes = jest.fn(() => Promise.resolve())
const mockOn = jest.fn()
const mockOff = jest.fn()
const localAttributes: Record<string, string> = {}
const remoteAttributes: Record<string, string> = {}

interface MockRoom {
  // Local participant state and attribute publisher used by the hook.
  localParticipant: Pick<
    Room["localParticipant"],
    "attributes" | "setAttributes"
  >
  // Remote participant attributes used to select the earliest timestamp.
  remoteParticipants: Map<string, Pick<RemoteParticipant, "attributes">>
  // Room event subscription mock.
  on: jest.Mock
  // Room event unsubscription mock.
  off: jest.Mock
}

const mockRoom: MockRoom = {
  localParticipant: {
    attributes: localAttributes,
    setAttributes: mockSetAttributes,
  },
  remoteParticipants: new Map([["remote", { attributes: remoteAttributes }]]),
  on: mockOn,
  off: mockOff,
}

jest.mock("@livekit/react-native", () => ({
  useRoomContext: () => mockRoom,
}))

beforeEach(() => {
  jest.clearAllMocks()
  delete localAttributes[MEETING_STARTED_AT_ATTRIBUTE]
  delete remoteAttributes[MEETING_STARTED_AT_ATTRIBUTE]
})

test("adopts and republishes the earliest participant timestamp", async () => {
  localAttributes[MEETING_STARTED_AT_ATTRIBUTE] = "2000"
  remoteAttributes[MEETING_STARTED_AT_ATTRIBUTE] = "1000"

  let hook: Awaited<ReturnType<typeof renderHook>>
  try {
    hook = await renderHook(useSharedMeetingStartedAt)
  } catch (error) {
    throw error
  }
  const { result } = hook

  expect(result.current).toBe(1000)
  try {
    await waitFor(() =>
      expect(mockSetAttributes).toHaveBeenCalledWith({
        [MEETING_STARTED_AT_ATTRIBUTE]: "1000",
      }),
    )
  } catch (error) {
    throw error
  }
})

test("resynchronizes on participant attribute changes", async () => {
  localAttributes[MEETING_STARTED_AT_ATTRIBUTE] = "2000"
  remoteAttributes[MEETING_STARTED_AT_ATTRIBUTE] = "2000"
  try {
    await renderHook(useSharedMeetingStartedAt)
  } catch (error) {
    throw error
  }
  const attributeListeners = mockOn.mock.calls.filter(
    ([event]) => event === RoomEvent.ParticipantAttributesChanged,
  )
  const attributeListener = attributeListeners[
    attributeListeners.length - 1
  ]?.[1] as VoidFunction | undefined

  remoteAttributes[MEETING_STARTED_AT_ATTRIBUTE] = "1000"
  act(() => attributeListener?.())

  try {
    await waitFor(() =>
      expect(mockSetAttributes).toHaveBeenCalledWith({
        [MEETING_STARTED_AT_ATTRIBUTE]: "1000",
      }),
    )
  } catch (error) {
    throw error
  }
})
