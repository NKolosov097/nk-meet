import type { EmitterSubscription } from "react-native"

import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from "expo-router/testing-library"

// A stand-in for livekit-client's Room: disconnect() eventually makes
// LiveKitRoom report a disconnect while mounted, and stays silent (no
// onDisconnected) if the wrapper itself already unmounted.
interface FakeRoom {
  // Whether the fake room still considers itself connected
  isConnected: boolean
  // Whether the LiveKitRoom wrapper that owns this room has unmounted
  unmounted: boolean
  // Tears the fake connection down and reports it, like RoomEvent.Disconnected
  disconnect: jest.Mock<Promise<void>, []>
}

const mockRooms: FakeRoom[] = []

jest.mock("@/constants/env", () => ({
  env: { serverUrl: "wss://integration.livekit.cloud" },
  configError: null,
}))

jest.mock("@/services/livekitToken", () => ({
  fetchParticipantToken: jest.fn(),
}))

jest.mock("@/services/recentRooms", () => ({
  saveRecentRoom: jest.fn(),
  getRecentRooms: jest.fn(() => Promise.resolve([])),
  getRecentRoom: jest.fn(() => Promise.resolve(null)),
}))

jest.mock("@/components/room/grid/GridPreview", () => ({
  GridPreview: () => null,
}))

// ActiveRoom itself is real — it owns the registration this test exercises —
// but its video/controls subtrees need native LiveKit hooks, so they are not.
jest.mock("@/components/room/VideoConference", () => ({
  VideoConference: () => null,
}))

jest.mock("@/components/room/ControlBar", () => ({
  ControlBar: () => {
    const React = jest.requireActual("react")
    const { Text } = jest.requireActual("react-native")

    return React.createElement(Text, null, "In call")
  },
}))

jest.mock("@livekit/react-native", () => {
  const React = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")
  const RoomContext = React.createContext(null)

  return {
    LiveKitRoom: ({
      children,
      onDisconnected,
    }: {
      children?: React.ReactNode
      onDisconnected?: VoidFunction
    }) => {
      const onDisconnectedRef = React.useRef(onDisconnected)
      onDisconnectedRef.current = onDisconnected

      const room = React.useMemo(() => {
        const fake: FakeRoom = {
          isConnected: true,
          unmounted: false,
          disconnect: jest.fn<Promise<void>, []>(async () => {
            if (!fake.isConnected) {
              return
            }

            // A real disconnect is several awaits deep before the room reports
            // it, so the event always lands after the router has navigated.
            await Promise.resolve()
            fake.isConnected = false

            if (!fake.unmounted) {
              onDisconnectedRef.current?.()
            }
          }),
        }
        mockRooms.push(fake)

        return fake
      }, [])

      React.useEffect(() => {
        return () => {
          room.unmounted = true
          room.disconnect()
        }
      }, [room])

      return React.createElement(
        RoomContext.Provider,
        { value: room },
        React.createElement(View, null, children),
      )
    },
    useRoomContext: () => React.useContext(RoomContext),
  }
})

const { fetchParticipantToken: mockFetchParticipantToken } = jest.requireMock(
  "@/services/livekitToken",
) as { fetchParticipantToken: jest.Mock<Promise<string>, [string, string]> }

// expo-router/testing-library's own expo-linking mock loads too late for a
// hoisted jest.mock to survive, so this spies on the mocked module instance
// directly — the same one _layout.tsx imports.
const mockLinking = jest.requireMock(
  "expo-linking",
) as typeof import("expo-linking")

let linkListeners: ((event: { url: string }) => void)[] = []
let app: ReturnType<typeof renderRouter>

// renderRouter's result is thenable — awaiting it flushes the first render;
// the variable keeps the router helpers that awaiting directly would strip.
const renderApp = async (): Promise<void> => {
  app = renderRouter(
    {
      _layout: require("./_layout"),
      index: require("./index"),
      "[slug]": require("./[slug]"),
      "+native-intent": require("./+native-intent"),
    },
    { initialUrl: "/" },
  )

  await app
}

const joinRoom = async (slug: string) => {
  await fireEvent.changeText(screen.getByLabelText("Room code"), slug)
  await fireEvent.press(screen.getByLabelText("Join room"))

  await waitFor(() => {
    expect(screen.getByLabelText("Participant name")).toBeVisible()
  })
  await fireEvent.changeText(screen.getByLabelText("Participant name"), "Ada")
  await fireEvent.press(screen.getByLabelText("Join room"))

  await waitFor(() => {
    expect(screen.getByText("In call")).toBeVisible()
  })
}

// Delivers a link the way the OS does: firing the "url" event alone drives
// expo-router's own navigation, so no separate router.navigate call is needed.
const openLink = async (url: string) => {
  await act(async () => {
    linkListeners.forEach(listener => listener({ url }))
  })
}

beforeEach(() => {
  mockRooms.length = 0
  linkListeners = []
  mockFetchParticipantToken.mockReset().mockResolvedValue("token-abc")
  jest
    .spyOn(mockLinking, "addEventListener")
    .mockImplementation((_type, listener) => {
      linkListeners.push(listener)

      return {
        remove: () => {
          linkListeners = linkListeners.filter(item => item !== listener)
        },
      } as EmitterSubscription
    })
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

test("stays on the room a mid-call link navigated to", async () => {
  await renderApp()
  await joinRoom("room-a")
  expect(mockRooms).toHaveLength(1)

  await openLink("nk-meet://room-b")

  // The old call is gone but room B stays on screen — disconnect() fires
  // twice (registry + LiveKitRoom's own unmount cleanup) because
  // Room.disconnect() is idempotent, not a double-teardown bug.
  await waitFor(() => {
    expect(mockRooms[0].disconnect).toHaveBeenCalledTimes(2)
  })
  expect(app.getPathname()).toBe("/room-b")
  expect(screen.getByText("Room: room-b")).toBeVisible()
  expect(screen.queryByText("In call")).not.toBeOnTheScreen()
})

test("keeps the call alive when the link targets the room already open", async () => {
  await renderApp()
  await joinRoom("room-a")

  await openLink("nk-meet://room-a")

  expect(mockRooms[0].disconnect).not.toHaveBeenCalled()
  expect(app.getPathname()).toBe("/room-a")
  expect(screen.getByText("In call")).toBeVisible()
})

test("keeps the call alive when an unroutable link (extra path segment) points at the room already open", async () => {
  await renderApp()
  await joinRoom("room-a")

  // An unmatched path would otherwise hit the auto-injected "+not-found"
  // route, unmounting the whole nav tree (live call included) outside the
  // registry's reach — +native-intent.ts collapses it to the known slug first.
  await openLink("nk-meet://room-a/extra")

  expect(mockRooms[0].disconnect).not.toHaveBeenCalled()
  expect(mockRooms[0].unmounted).toBe(false)
  expect(mockRooms[0].isConnected).toBe(true)
  expect(mockRooms).toHaveLength(1)
  expect(app.getPathname()).toBe("/room-a")
  expect(screen.getByText("In call")).toBeVisible()
})

test("drops an unroutable link to a different room instead of stranding on +not-found", async () => {
  await renderApp()
  await joinRoom("room-a")

  await openLink("nk-meet://room-b/extra")

  await waitFor(() => {
    expect(app.getPathname()).toBe("/room-b")
  })
  expect(screen.getByLabelText("Participant name")).toBeVisible()
})

test("keeps the same call alive when a non-canonical link to the room already open arrives", async () => {
  await renderApp()
  await joinRoom("room-a")

  // +native-intent.ts rewrites "Room-A" to the canonical "/room-a" first, so
  // this guards the native-intent + same-room-no-op path end to end: casing
  // differences must not tear down and rejoin the active call.
  await openLink("nk-meet://Room-A")

  await waitFor(() => {
    expect(app.getPathname()).toBe("/room-a")
  })
  expect(mockRooms[0].disconnect).not.toHaveBeenCalled()
  expect(mockRooms[0].isConnected).toBe(true)
  // A second LiveKitRoom mount would push a second fake room here — proof
  // the call was never unmounted, not just that disconnect() wasn't called.
  expect(mockRooms).toHaveLength(1)
  expect(screen.getByText("In call")).toBeVisible()
  expect(screen.queryByLabelText("Participant name")).not.toBeOnTheScreen()
})

test("canonicalizes the slug a link points at before joining", async () => {
  await renderApp()

  await openLink("nk-meet://Room%20B")

  await waitFor(() => {
    expect(app.getPathname()).toBe("/room-b")
  })
  expect(screen.getByText("Room: room-b")).toBeVisible()
})
