import { Text } from "react-native"

import { act, render, screen } from "@testing-library/react-native"

import {
  useDataChannel,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/react-native"
import { RoomEvent } from "livekit-client"

import { encodeReactionMessage, HAND_RAISED_ATTRIBUTE } from "./reactions"
import { ReactionsProvider, useReactions } from "./ReactionsProvider"

jest.mock("@livekit/react-native", () => ({
  useDataChannel: jest.fn(),
  useLocalParticipant: jest.fn(),
  useRoomContext: jest.fn(),
}))

const mockUseDataChannel = useDataChannel as jest.Mock
const mockUseLocalParticipant = useLocalParticipant as jest.Mock
const mockUseRoomContext = useRoomContext as jest.Mock
const mockSend = jest.fn(() => Promise.resolve())
const listeners = new Map<RoomEvent, jest.Mock>()
const mockOn = jest.fn((event: RoomEvent, listener: jest.Mock) => {
  listeners.set(event, listener)
})
const mockOff = jest.fn()
let onDataMessage: jest.Mock | undefined

interface ParticipantFixture {
  // Stable LiveKit identity used as the state key.
  identity: string
  // Display name used for announcements.
  name: string
  // Current complete participant attributes.
  attributes: Record<string, string>
}

const participant = (
  identity: string,
  attributes: Record<string, string> = {},
): ParticipantFixture => ({
  identity,
  name: identity === "alice" ? "Alice" : identity,
  attributes,
})

const localParticipant = participant("local", {
  [HAND_RAISED_ATTRIBUTE]: "true",
})
const bob = participant("bob", { [HAND_RAISED_ATTRIBUTE]: "" })
let remoteParticipants = new Map([[bob.identity, bob]])

const room = {
  localParticipant,
  remoteParticipants,
  on: mockOn,
  off: mockOff,
}

const Probe = () => {
  const { participants } = useReactions()
  return <Text testID="state">{JSON.stringify(participants)}</Text>
}

const renderProvider = () =>
  render(
    <ReactionsProvider>
      <Probe />
    </ReactionsProvider>,
  )

const state = (): Record<
  string,
  { isHandRaised: boolean; ephemeralReactions: unknown[] }
> => JSON.parse(String(screen.getByTestId("state").props.children))

beforeEach(() => {
  jest.clearAllMocks()
  listeners.clear()
  remoteParticipants = new Map([[bob.identity, bob]])
  room.remoteParticipants = remoteParticipants
  localParticipant.attributes = { [HAND_RAISED_ATTRIBUTE]: "true" }
  bob.attributes = { [HAND_RAISED_ATTRIBUTE]: "" }
  mockUseRoomContext.mockReturnValue(room)
  mockUseLocalParticipant.mockReturnValue({ localParticipant })
  mockUseDataChannel.mockImplementation(
    (_topic: string, callback: jest.Mock) => {
      onDataMessage = callback
      return { isSending: false, send: mockSend, message: undefined }
    },
  )
})

test("hydrates current local and remote hand attributes on mount", async () => {
  await renderProvider()

  expect(state()).toEqual({
    local: { isHandRaised: true, ephemeralReactions: [] },
    bob: { isHandRaised: false, ephemeralReactions: [] },
  })
  expect(mockUseDataChannel).toHaveBeenCalledTimes(1)
  expect(mockUseDataChannel).toHaveBeenCalledWith(
    "reaction-topic",
    expect.any(Function),
  )
})

test("hydrates a late participant from their current attribute", async () => {
  await renderProvider()
  const carol = participant("carol", {
    [HAND_RAISED_ATTRIBUTE]: "true",
  })

  await act(() => listeners.get(RoomEvent.ParticipantConnected)?.(carol))

  expect(state().carol).toEqual({
    isHandRaised: true,
    ephemeralReactions: [],
  })
})

test("re-reads the complete participant attributes instead of the event delta", async () => {
  await renderProvider()
  bob.attributes = { [HAND_RAISED_ATTRIBUTE]: "true" }

  await act(() =>
    listeners.get(RoomEvent.ParticipantAttributesChanged)?.(
      { [HAND_RAISED_ATTRIBUTE]: "" },
      bob,
    ),
  )

  expect(state().bob?.isHandRaised).toBe(true)
})

test("rebuilds current authoritative hand state after reconnect", async () => {
  await renderProvider()
  bob.attributes = { [HAND_RAISED_ATTRIBUTE]: "true" }
  const carol = participant("carol", { [HAND_RAISED_ATTRIBUTE]: "" })
  remoteParticipants = new Map([[carol.identity, carol]])
  room.remoteParticipants = remoteParticipants

  await act(() => listeners.get(RoomEvent.Reconnected)?.())

  expect(state()).toEqual({
    local: { isHandRaised: true, ephemeralReactions: [] },
    carol: { isHandRaised: false, ephemeralReactions: [] },
  })
})

test("removes a disconnected participant", async () => {
  await renderProvider()

  await act(() => listeners.get(RoomEvent.ParticipantDisconnected)?.(bob))

  expect(state().bob).toBeUndefined()
})

test("removes the same room callbacks on unmount", async () => {
  const view = await renderProvider()
  const registered = [...mockOn.mock.calls]

  await view.unmount()

  expect(mockOff.mock.calls).toEqual(registered)
})

test("keeps an authoritative raised attribute above an out-of-order lower packet", async () => {
  await renderProvider()
  bob.attributes = { [HAND_RAISED_ATTRIBUTE]: "true" }

  await act(() =>
    onDataMessage?.({
      payload: encodeReactionMessage({
        type: "raiseHand",
        isHandRaised: false,
        participant: "spoofed",
      }),
      from: bob,
      topic: "reaction-topic",
    }),
  )

  expect(state().bob?.isHandRaised).toBe(true)
})

test("lets a current authoritative lower marker replace a legacy packet", async () => {
  bob.attributes = {}
  await renderProvider()

  await act(() =>
    onDataMessage?.({
      payload: encodeReactionMessage({
        type: "raiseHand",
        isHandRaised: true,
        participant: "spoofed",
      }),
      from: bob,
      topic: "reaction-topic",
    }),
  )
  expect(state().bob?.isHandRaised).toBe(true)

  bob.attributes = { [HAND_RAISED_ATTRIBUTE]: "" }
  await act(() =>
    listeners.get(RoomEvent.ParticipantAttributesChanged)?.(
      { [HAND_RAISED_ATTRIBUTE]: "" },
      bob,
    ),
  )

  expect(state().bob?.isHandRaised).toBe(false)
})

test("reconnect hydration replaces an earlier legacy fallback", async () => {
  bob.attributes = {}
  await renderProvider()
  await act(() =>
    onDataMessage?.({
      payload: encodeReactionMessage({
        type: "raiseHand",
        isHandRaised: true,
        participant: "bob",
      }),
      from: bob,
      topic: "reaction-topic",
    }),
  )
  bob.attributes = { [HAND_RAISED_ATTRIBUTE]: "" }

  await act(() => listeners.get(RoomEvent.Reconnected)?.())

  expect(state().bob?.isHandRaised).toBe(false)
})
