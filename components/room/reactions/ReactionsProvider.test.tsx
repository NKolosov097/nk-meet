// a11y:components/room/reactions/ReactionsProvider.tsx
import { AccessibilityInfo, Alert, Pressable, Text, View } from "react-native"

import { act, fireEvent, render, screen } from "@testing-library/react-native"

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
const mockSetAttributes = jest.fn(() => Promise.resolve())
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
Object.assign(localParticipant, {
  permissions: { canPublishData: true, canUpdateMetadata: true },
  setAttributes: mockSetAttributes,
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
  const reactions = useReactions()
  return (
    <View>
      <Text testID="state">{JSON.stringify(reactions.participants)}</Text>
      <Text testID="permissions">
        {JSON.stringify({
          quick: reactions.canSendQuickReactions,
          hand: reactions.canUpdateHand,
          pending: reactions.isHandUpdatePending,
        })}
      </Text>
      <Pressable
        accessibilityLabel="Send heart"
        onPress={() => reactions.sendQuickReaction("heart")}
      />
      <Pressable
        accessibilityLabel="Toggle hand"
        onPress={reactions.toggleHand}
      />
    </View>
  )
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
  Object.assign(localParticipant, {
    permissions: { canPublishData: true, canUpdateMetadata: true },
  })
  bob.attributes = { [HAND_RAISED_ATTRIBUTE]: "" }
  mockSend.mockResolvedValue(undefined)
  mockSetAttributes.mockResolvedValue(undefined)
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

test("reacts to permission revocation without optimistic state or a rerender", async () => {
  await renderProvider()
  Object.assign(localParticipant, {
    permissions: { canPublishData: false, canUpdateMetadata: false },
  })

  await act(() =>
    listeners.get(RoomEvent.ParticipantPermissionsChanged)?.(
      undefined,
      localParticipant,
    ),
  )
  await fireEvent.press(screen.getByLabelText("Send heart"))
  await fireEvent.press(screen.getByLabelText("Toggle hand"))

  expect(
    JSON.parse(String(screen.getByTestId("permissions").props.children)),
  ).toEqual({ quick: false, hand: false, pending: false })
  expect(state().local).toEqual({
    isHandRaised: true,
    ephemeralReactions: [],
  })
  expect(mockSend).not.toHaveBeenCalled()
  expect(mockSetAttributes).not.toHaveBeenCalled()
})

test("reacts separately to data and metadata permission grants", async () => {
  Object.assign(localParticipant, {
    permissions: { canPublishData: false, canUpdateMetadata: false },
  })
  await renderProvider()

  Object.assign(localParticipant, {
    permissions: { canPublishData: true, canUpdateMetadata: false },
  })
  await act(() =>
    listeners.get(RoomEvent.ParticipantPermissionsChanged)?.(
      undefined,
      localParticipant,
    ),
  )
  await fireEvent.press(screen.getByLabelText("Send heart"))
  await fireEvent.press(screen.getByLabelText("Toggle hand"))

  expect(state().local?.ephemeralReactions).toHaveLength(1)
  expect(mockSend).toHaveBeenCalledTimes(1)
  expect(mockSetAttributes).not.toHaveBeenCalled()

  Object.assign(localParticipant, {
    permissions: { canPublishData: true, canUpdateMetadata: true },
  })
  await act(() =>
    listeners.get(RoomEvent.ParticipantPermissionsChanged)?.(
      undefined,
      localParticipant,
    ),
  )
  await fireEvent.press(screen.getByLabelText("Toggle hand"))
  await act(() => Promise.resolve())

  expect(mockSetAttributes).toHaveBeenCalledTimes(1)
})

describe("quick reactions", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(1_726_260_000_000)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  test("adds locally and publishes the exact reliable Proofix packet", async () => {
    await renderProvider()

    await fireEvent.press(screen.getByLabelText("Send heart"))

    expect(state().local?.ephemeralReactions).toEqual([
      {
        id: "local:1726260000000:1",
        type: "heart",
        expiresAt: 1_726_260_002_000,
      },
    ])
    expect(mockSend).toHaveBeenCalledWith(
      encodeReactionMessage({
        type: "ephemeral",
        reactionId: "local:1726260000000:1",
        reaction: "heart",
        participant: "local",
      }),
      { reliable: true },
    )
  })

  test("throttles until exactly 300 milliseconds after the last accepted tap", async () => {
    await renderProvider()
    await fireEvent.press(screen.getByLabelText("Send heart"))
    jest.advanceTimersByTime(299)
    await fireEvent.press(screen.getByLabelText("Send heart"))
    expect(mockSend).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(1)
    await fireEvent.press(screen.getByLabelText("Send heart"))

    expect(mockSend).toHaveBeenCalledTimes(2)
    expect(state().local?.ephemeralReactions).toHaveLength(2)
  })

  test("deduplicates a remote id without extending expiry or announcing twice", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility")
    const alice = participant("alice")
    await renderProvider()
    const packet = {
      payload: encodeReactionMessage({
        type: "ephemeral" as const,
        reactionId: "alice:1:1",
        reaction: "thumbsUp" as const,
        participant: "spoofed",
      }),
      from: alice,
      topic: "reaction-topic",
    }

    await act(() => onDataMessage?.(packet))
    const first = state().alice?.ephemeralReactions
    jest.advanceTimersByTime(500)
    await act(() => onDataMessage?.(packet))

    expect(state().alice?.ephemeralReactions).toEqual(first)
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenCalledWith("Alice reacted with Thumbs up")
  })

  test("keeps only the newest five live reactions per participant", async () => {
    const alice = participant("alice")
    await renderProvider()

    for (let index = 1; index <= 6; index += 1) {
      await act(() =>
        onDataMessage?.({
          payload: encodeReactionMessage({
            type: "ephemeral",
            reactionId: `alice:1:${index}`,
            reaction: "smile",
            participant: "alice",
          }),
          from: alice,
          topic: "reaction-topic",
        }),
      )
    }

    expect(
      state().alice?.ephemeralReactions.map(reaction =>
        String((reaction as { id: string }).id),
      ),
    ).toEqual(["alice:1:2", "alice:1:3", "alice:1:4", "alice:1:5", "alice:1:6"])
  })

  test("suppresses a queue-evicted duplicate until its original expiry", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility")
    const alice = participant("alice")
    await renderProvider()
    const receive = async (reactionId: string): Promise<void> => {
      await act(() =>
        onDataMessage?.({
          payload: encodeReactionMessage({
            type: "ephemeral",
            reactionId,
            reaction: "smile",
            participant: "alice",
          }),
          from: alice,
          topic: "reaction-topic",
        }),
      )
    }

    for (let index = 1; index <= 6; index += 1) {
      await receive(`alice:1:${index}`)
    }
    jest.advanceTimersByTime(1_000)
    await receive("alice:1:1")

    expect(
      state().alice?.ephemeralReactions.map(reaction =>
        String((reaction as { id: string }).id),
      ),
    ).toEqual(["alice:1:2", "alice:1:3", "alice:1:4", "alice:1:5", "alice:1:6"])
    expect(announce).toHaveBeenCalledTimes(6)

    await act(() => jest.advanceTimersByTime(1_000))
    await receive("alice:1:1")
    expect(state().alice?.ephemeralReactions).toEqual([
      {
        id: "alice:1:1",
        type: "smile",
        expiresAt: 1_726_260_004_000,
      },
    ])
    expect(announce).toHaveBeenCalledTimes(7)
  })

  test("drops unique packets beyond the per-participant seen-id limit until expiry", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility")
    const alice = participant("alice")
    await renderProvider()
    const receive = async (reactionId: string): Promise<void> => {
      await act(() =>
        onDataMessage?.({
          payload: encodeReactionMessage({
            type: "ephemeral",
            reactionId,
            reaction: "smile",
            participant: "alice",
          }),
          from: alice,
          topic: "reaction-topic",
        }),
      )
    }

    for (let index = 1; index <= 101; index += 1) {
      await receive(`alice:flood:${index}`)
    }

    expect(
      state().alice?.ephemeralReactions.map(reaction =>
        String((reaction as { id: string }).id),
      ),
    ).toEqual([
      "alice:flood:96",
      "alice:flood:97",
      "alice:flood:98",
      "alice:flood:99",
      "alice:flood:100",
    ])
    expect(announce).toHaveBeenCalledTimes(100)

    await act(() => jest.advanceTimersByTime(2_000))
    await receive("alice:flood:101")

    expect(state().alice?.ephemeralReactions).toHaveLength(1)
    expect(announce).toHaveBeenCalledTimes(101)
  })

  test("uses one cleanup timer per participant and clears it on disconnect", async () => {
    const alice = participant("alice")
    await renderProvider()
    const setTimeoutSpy = jest.spyOn(global, "setTimeout")
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout")
    const receive = async (reactionId: string): Promise<void> => {
      await act(() =>
        onDataMessage?.({
          payload: encodeReactionMessage({
            type: "ephemeral",
            reactionId,
            reaction: "smile",
            participant: "alice",
          }),
          from: alice,
          topic: "reaction-topic",
        }),
      )
    }

    await receive("alice:timer:1")
    jest.advanceTimersByTime(100)
    await receive("alice:timer:2")

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
    const cleanupTimer = setTimeoutSpy.mock.results[0].value

    await act(() => listeners.get(RoomEvent.ParticipantDisconnected)?.(alice))

    expect(clearTimeoutSpy).toHaveBeenCalledWith(cleanupTimer)
  })

  test("expires reactions from absolute timestamps after delayed timer work", async () => {
    await renderProvider()
    await fireEvent.press(screen.getByLabelText("Send heart"))
    jest.advanceTimersByTime(300)
    await fireEvent.press(screen.getByLabelText("Send heart"))

    await act(() => jest.advanceTimersByTime(2_000))

    expect(state().local?.ephemeralReactions).toEqual([])
  })

  test("cancels reaction timers on disconnect and unmount", async () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout")
    const alice = participant("alice")
    const view = await renderProvider()
    await act(() =>
      onDataMessage?.({
        payload: encodeReactionMessage({
          type: "ephemeral",
          reactionId: "alice:1:1",
          reaction: "cry",
          participant: "alice",
        }),
        from: alice,
        topic: "reaction-topic",
      }),
    )
    await fireEvent.press(screen.getByLabelText("Send heart"))

    await act(() => listeners.get(RoomEvent.ParticipantDisconnected)?.(alice))
    await view.unmount()

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2)
  })

  test("keeps optimistic feedback when publishing fails", async () => {
    const error = new Error("offline")
    const consoleSpy = jest.spyOn(console, "error").mockImplementation()
    mockSend.mockRejectedValueOnce(error)
    await renderProvider()

    await fireEvent.press(screen.getByLabelText("Send heart"))
    await act(() => Promise.resolve())

    expect(state().local?.ephemeralReactions).toHaveLength(1)
    expect(consoleSpy).toHaveBeenCalledWith("Failed to send reaction", error)
  })
})

describe("raised-hand publishing", () => {
  test("updates attributes before sending the compatibility packet", async () => {
    localParticipant.attributes = { [HAND_RAISED_ATTRIBUTE]: "" }
    await renderProvider()

    await fireEvent.press(screen.getByLabelText("Toggle hand"))
    await act(() => Promise.resolve())

    expect(state().local?.isHandRaised).toBe(true)
    expect(mockSetAttributes).toHaveBeenCalledWith({
      [HAND_RAISED_ATTRIBUTE]: "true",
    })
    expect(mockSetAttributes.mock.invocationCallOrder[0]).toBeLessThan(
      mockSend.mock.invocationCallOrder[0],
    )
    expect(mockSend).toHaveBeenCalledWith(
      encodeReactionMessage({
        type: "raiseHand",
        isHandRaised: true,
        participant: "local",
      }),
      { reliable: true },
    )
  })

  test("lowers with an empty authoritative marker and a false packet", async () => {
    await renderProvider()

    await fireEvent.press(screen.getByLabelText("Toggle hand"))
    await act(() => Promise.resolve())

    expect(mockSetAttributes).toHaveBeenCalledWith({
      [HAND_RAISED_ATTRIBUTE]: "",
    })
    expect(mockSend).toHaveBeenCalledWith(
      encodeReactionMessage({
        type: "raiseHand",
        isHandRaised: false,
        participant: "local",
      }),
      { reliable: true },
    )
  })

  test("rolls back and alerts once when the authoritative write fails", async () => {
    localParticipant.attributes = { [HAND_RAISED_ATTRIBUTE]: "" }
    const error = new Error("denied")
    const consoleSpy = jest.spyOn(console, "error").mockImplementation()
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation()
    mockSetAttributes.mockRejectedValueOnce(error)
    await renderProvider()

    await fireEvent.press(screen.getByLabelText("Toggle hand"))
    await act(() => Promise.resolve())

    expect(state().local?.isHandRaised).toBe(false)
    expect(mockSend).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith("Failed to update hand", error)
    expect(alertSpy).toHaveBeenCalledTimes(1)
    expect(alertSpy).toHaveBeenCalledWith(
      "Hand update failed",
      "Could not update your hand status",
    )
  })

  test("keeps authoritative state when only compatibility publishing fails", async () => {
    localParticipant.attributes = { [HAND_RAISED_ATTRIBUTE]: "" }
    const error = new Error("offline")
    const consoleSpy = jest.spyOn(console, "error").mockImplementation()
    mockSend.mockRejectedValueOnce(error)
    await renderProvider()

    await fireEvent.press(screen.getByLabelText("Toggle hand"))
    await act(() => Promise.resolve())

    expect(state().local?.isHandRaised).toBe(true)
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to send hand compatibility update",
      error,
    )
  })

  test("blocks a second toggle while the attribute update is pending", async () => {
    let resolveUpdate: VoidFunction = () => undefined
    mockSetAttributes.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveUpdate = resolve
        }),
    )
    await renderProvider()

    await fireEvent.press(screen.getByLabelText("Toggle hand"))
    await fireEvent.press(screen.getByLabelText("Toggle hand"))

    expect(mockSetAttributes).toHaveBeenCalledTimes(1)
    expect(
      JSON.parse(String(screen.getByTestId("permissions").props.children))
        .pending,
    ).toBe(true)
    resolveUpdate()
    await act(() => Promise.resolve())
  })

  test("separates data and metadata permissions", async () => {
    Object.assign(localParticipant, {
      permissions: { canPublishData: true, canUpdateMetadata: false },
    })

    await renderProvider()

    expect(
      JSON.parse(String(screen.getByTestId("permissions").props.children)),
    ).toEqual({ quick: true, hand: false, pending: false })
  })
})
