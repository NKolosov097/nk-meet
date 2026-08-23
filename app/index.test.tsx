import { render, screen } from "@testing-library/react-native"

import RootScreen from "./index"

jest.mock("expo-router", () => {
  const { View } = jest.requireActual("react-native")

  return {
    Redirect: ({ href }: { href: string }) => (
      <View href={href} testID="root-redirect" />
    ),
  }
})

test("redirects the root route to the default company", async () => {
  await render(<RootScreen />)

  expect(screen.getByTestId("root-redirect")).toHaveProp("href", "/nkolosov")
})
