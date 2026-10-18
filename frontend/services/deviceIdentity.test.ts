const mockGetItem = jest.fn<Promise<string | null>, [string]>()
const mockSetItem = jest.fn<Promise<void>, [string, string]>()

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: mockGetItem,
    setItem: mockSetItem,
  },
}))

const loadGetDeviceIdentity = () => {
  let getDeviceIdentity: typeof import("./deviceIdentity").getDeviceIdentity

  jest.isolateModules(() => {
    ;({ getDeviceIdentity } = require("./deviceIdentity"))
  })

  return getDeviceIdentity!
}

beforeEach(() => {
  mockGetItem.mockReset()
  mockSetItem.mockReset()
})

afterEach(() => {
  jest.restoreAllMocks()
})

test("reuses a stored identity without replacing it", async () => {
  mockGetItem.mockResolvedValue("device-stored")
  const getDeviceIdentity = loadGetDeviceIdentity()

  await expect(getDeviceIdentity()).resolves.toBe("device-stored")
  expect(mockSetItem).not.toHaveBeenCalled()
})

test("generates and persists an identity when storage is empty", async () => {
  mockGetItem.mockResolvedValue(null)
  jest.spyOn(Math, "random").mockReturnValueOnce(0.5).mockReturnValueOnce(0.25)
  const getDeviceIdentity = loadGetDeviceIdentity()

  const identity = await getDeviceIdentity()

  expect(identity).toMatch(/^device-[a-z0-9]+$/)
  expect(mockSetItem).toHaveBeenCalledWith("nk-meet.device-identity", identity)
})

test("reuses the in-memory identity without reading storage again", async () => {
  mockGetItem.mockResolvedValue("device-stored")
  const getDeviceIdentity = loadGetDeviceIdentity()

  const firstIdentity = await getDeviceIdentity()

  await expect(getDeviceIdentity()).resolves.toBe(firstIdentity)
  expect(mockGetItem).toHaveBeenCalledTimes(1)
})

test("returns and persists a generated identity when reading storage fails", async () => {
  const readFailure = new Error("storage read failed")
  mockGetItem.mockRejectedValue(readFailure)
  const consoleError = jest.spyOn(console, "error").mockImplementation()
  const getDeviceIdentity = loadGetDeviceIdentity()

  const identity = await getDeviceIdentity()

  expect(identity).toMatch(/^device-[a-z0-9]+$/)
  expect(mockSetItem).toHaveBeenCalledWith("nk-meet.device-identity", identity)
  expect(consoleError).toHaveBeenCalledWith(
    "Failed to read the device identity: ",
    readFailure,
  )
})

test("returns a generated identity when persisting it fails", async () => {
  const writeFailure = new Error("storage write failed")
  mockGetItem.mockResolvedValue(null)
  mockSetItem.mockRejectedValue(writeFailure)
  const consoleError = jest.spyOn(console, "error").mockImplementation()
  const getDeviceIdentity = loadGetDeviceIdentity()

  const identity = await getDeviceIdentity()

  expect(identity).toMatch(/^device-[a-z0-9]+$/)
  expect(consoleError).toHaveBeenCalledWith(
    "Failed to persist the device identity: ",
    writeFailure,
  )
})
