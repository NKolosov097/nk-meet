import { renderRouter, screen, waitFor } from "expo-router/testing-library"

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
)

jest.mock("@/constants/env", () => ({ env: {}, configError: null }))

test("routes the root path to the default company landing", async () => {
  const app = renderRouter(
    {
      index: require("./index"),
      "[company]/index": require("./[company]/index"),
    },
    { initialUrl: "/" },
  )
  await app

  await waitFor(() => expect(app.getPathname()).toBe("/nkolosov"))
  expect(screen.getByLabelText("Room code")).toBeVisible()
  expect(screen.getByText("NK Meet")).toHaveProp("accessibilityRole", "header")
  expect(screen.getByLabelText("Join room")).toHaveProp(
    "accessibilityRole",
    "button",
  )
})
