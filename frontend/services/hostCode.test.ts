import { formatHostCode, hostCodeDigits, isHostCodeComplete } from "./hostCode"

test("formats paste, delete and leading zeros", () => {
  expect(formatHostCode("0011-2233")).toBe("0011-2233")
  expect(formatHostCode("0011-2")).toBe("0011-2")
  expect(formatHostCode("0011")).toBe("0011")
  expect(hostCodeDigits("0011-2233")).toBe("00112233")
  expect(isHostCodeComplete("0011-2233")).toBe(true)
  expect(isHostCodeComplete("0011-223")).toBe(false)
})
