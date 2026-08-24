import type { EmitterSubscription } from "react-native"

import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from "expo-router/testing-library"

interface FakeRoom {
  // Whether the fake connection remains live
  isConnected: boolean
  // Disconnects the fake room and reports the event while mounted
  disconnect: jest.Mock<Promise<void>, []>
}

interface LinkEvent {
  // Deep link delivered by Expo Linking
  url: string
}

type LinkListener = (event: LinkEvent) => void

const rooms: FakeRoom[] = []

jest.mock("@/constants/env", () => ({
  env: { serverUrl: "wss://integration.livekit.cloud" },
  configError: null,
}))
jest.mock("@/services/livekitToken", () => ({
  fetchParticipantToken: jest.fn(() => Promise.resolve("token-abc")),
}))
jest.mock("@/services/recentRooms", () => ({
  getRecentRooms: jest.fn(() => Promise.resolve([])),
  getRecentRoom: jest.fn(() => Promise.resolve(null)),
  saveRecentRoom: jest.fn(() => Promise.resolve()),
}))
jest.mock("@/components/room/grid/GridPreview", () => ({
  GridPreview: () => null,
}))
jest.mock("@/components/room/VideoConference", () => ({
  VideoConference: () => null,
}))
jest.mock("@/components/room/ControlBar", () => {
  const React = jest.requireActual("react")
  const { Text } = jest.requireActual("react-native")

  return { ControlBar: () => React.createElement(Text, null, "In call") }
})

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
          disconnect: jest.fn<Promise<void>, []>(async () => {
            if (!fake.isConnected) return

            fake.isConnected = false
            onDisconnectedRef.current?.()
          }),
        }
        rooms.push(fake)
        return fake
      }, [])

      return React.createElement(
        RoomContext.Provider,
        { value: room },
        React.createElement(View, null, children),
      )
    },
    useRoomContext: () => React.useContext(RoomContext),
  }
})

const mockLinking = jest.requireMock(
  "expo-linking",
) as typeof import("expo-linking")
let listeners: LinkListener[] = []
let app: ReturnType<typeof renderRouter>

const renderApp = async (): Promise<void> => {
  app = renderRouter(
    {
      _layout: require("./_layout"),
      index: require("./index"),
      "[company]/index": require("./[company]/index"),
      "[company]/[slug]": require("./[company]/[slug]"),
      "+native-intent": require("./+native-intent"),
    },
    { initialUrl: "/nkolosov" },
  )
  await app
}

const joinRoom = async (slug: string): Promise<void> => {
  await fireEvent.changeText(screen.getByLabelText("Room code"), slug)
  await fireEvent.press(screen.getByLabelText("Join room"))
  await fireEvent.changeText(screen.getByLabelText("Participant name"), "Ada")
  await fireEvent.press(screen.getByLabelText("Join room"))
  await waitFor(() => expect(screen.getByText("In call")).toBeVisible())
}

const openLink = async (url: string): Promise<void> => {
  await act(async () => {
    listeners.forEach(listener => listener({ url }))
  })
}

beforeEach(() => {
  rooms.length = 0
  listeners = []
  jest
    .spyOn(mockLinking, "addEventListener")
    .mockImplementation((_type, listener) => {
      listeners.push(listener)
      return {
        remove: () => {
          listeners = listeners.filter(item => item !== listener)
        },
      } as EmitterSubscription
    })
})

afterEach(() => jest.restoreAllMocks())

test("tears down the active call before a link opens another company room", async () => {
  await renderApp()
  await joinRoom("room-a")

  await openLink("nk-meet://globex/room-a")

  await waitFor(() => expect(rooms[0].disconnect).toHaveBeenCalled())
  expect(app.getPathname()).toBe("/globex/room-a")
  expect(screen.getByText("Room: room-a")).toBeVisible()
  expect(screen.queryByText("In call")).not.toBeOnTheScreen()
})

test("keeps the call alive for an equivalent company and room link", async () => {
  await renderApp()
  await joinRoom("room-a")

  await openLink("nk-meet://Nkolosov/Room-A")

  expect(rooms[0].disconnect).not.toHaveBeenCalled()
  expect(app.getPathname()).toBe("/nkolosov/room-a")
  expect(screen.getByText("In call")).toBeVisible()
})

test("routes a company-only deep link to its landing after teardown", async () => {
  await renderApp()
  await joinRoom("room-a")

  await openLink("nk-meet:/globex")

  await waitFor(() => expect(rooms[0].disconnect).toHaveBeenCalled())
  expect(app.getPathname()).toBe("/globex")
  expect(screen.getByLabelText("Room code")).toBeVisible()
})
