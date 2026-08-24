import { redirectSystemPath } from "./+native-intent"

test("routes a company landing link to its canonical company path", () => {
  expect(redirectSystemPath({ path: "nk-meet://Nkolosov" })).toBe("/nkolosov")
})

test("routes a company meeting link with both canonical segments", () => {
  expect(
    redirectSystemPath({
      path: "nk-meet://Nkolosov/Expo%20Development%20Client",
    }),
  ).toBe("/nkolosov/expo-development-client")
})

test("drops unsupported deep-link paths to the root fallback", () => {
  expect(redirectSystemPath({ path: "nk-meet://nkolosov/room-a/extra" })).toBe(
    "/",
  )
})
