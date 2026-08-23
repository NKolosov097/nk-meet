import { redirectSystemPath } from "./+native-intent"

test("routes a company landing link to its canonical company path", () => {
  expect(redirectSystemPath({ path: "nk-meet://Acme" })).toBe("/acme")
})

test("routes a company meeting link with both canonical segments", () => {
  expect(
    redirectSystemPath({ path: "nk-meet://Acme/Expo%20Development%20Client" }),
  ).toBe("/acme/expo-development-client")
})

test("drops unsupported deep-link paths to the root fallback", () => {
  expect(redirectSystemPath({ path: "nk-meet://acme/room-a/extra" })).toBe("/")
})
