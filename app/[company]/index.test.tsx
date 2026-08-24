// a11y:app/[company]/index.tsx
import { render, screen } from "@testing-library/react-native"

import CompanyHomeScreen from "./index"

const mockReplace = jest.fn()
let mockCompany = "Acme Team"

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ company: mockCompany }),
  useRouter: () => ({ replace: mockReplace }),
}))

jest.mock("@/screens/HomeScreen", () => ({
  HomeScreen: ({ company }: { company: string }) => {
    const React = jest.requireActual("react")
    const { Text } = jest.requireActual("react-native")

    return React.createElement(Text, null, `Company home: ${company}`)
  },
}))

beforeEach(() => {
  mockReplace.mockReset()
  mockCompany = "Acme Team"
})

test("renders the canonical company landing", async () => {
  await render(<CompanyHomeScreen />)

  expect(screen.getByText("Company home: acme-team")).toBeVisible()
  expect(mockReplace).toHaveBeenCalledWith("/acme-team")
})

test("returns to the safe root fallback for an invalid company", async () => {
  mockCompany = "!!!"

  await render(<CompanyHomeScreen />)

  expect(mockReplace).toHaveBeenCalledWith("/")
  expect(screen.queryByText(/^Company home:/)).not.toBeOnTheScreen()
})
