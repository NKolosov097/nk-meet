import { fireEvent, renderRouter, screen } from "expo-router/testing-library"

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
)

jest.mock("@/constants/env", () => ({ env: {}, configError: null }))

jest.mock("@/services/livekitToken", () => ({
  fetchParticipantToken: jest.fn(),
}))

jest.mock("@/services/roomSlug", () => {
  const actual = jest.requireActual("@/services/roomSlug")

  return { ...actual, generateRoomSlug: jest.fn(() => "quiet-tiger-42") }
})

jest.mock("@livekit/react-native", () => ({ LiveKitRoom: () => null }))

test("navigates from a company landing to a generated company room", async () => {
  await renderRouter(
    {
      index: require("./index"),
      "[company]/index": require("./[company]/index"),
      "[company]/[slug]": require("./[company]/[slug]"),
    },
    { initialUrl: "/nkolosov" },
  )

  await fireEvent.press(screen.getByLabelText("Create room"))

  expect(await screen.findByText("Room: quiet-tiger-42")).toBeVisible()
})

test("navigates from a company landing to a typed company room", async () => {
  await renderRouter(
    {
      index: require("./index"),
      "[company]/index": require("./[company]/index"),
      "[company]/[slug]": require("./[company]/[slug]"),
    },
    { initialUrl: "/nkolosov" },
  )

  await fireEvent.changeText(screen.getByLabelText("Room code"), "Team Sync")
  await fireEvent.press(screen.getByLabelText("Join room"))

  expect(await screen.findByText("Room: team-sync")).toBeVisible()
})
