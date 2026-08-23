const mockGetItem = jest.fn<Promise<string | null>, [string]>()
const mockSetItem = jest.fn<Promise<void>, [string, string]>()

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: mockGetItem,
    setItem: mockSetItem,
  },
}))

const loadRecentRooms = () => {
  let getRecentRooms: typeof import("./recentRooms").getRecentRooms
  let saveRecentRoom: typeof import("./recentRooms").saveRecentRoom
  let getRecentRoom: typeof import("./recentRooms").getRecentRoom

  jest.isolateModules(() => {
    ;({
      getRecentRooms,
      saveRecentRoom,
      getRecentRoom,
    } = require("./recentRooms"))
  })

  return {
    getRecentRooms: getRecentRooms!,
    saveRecentRoom: saveRecentRoom!,
    getRecentRoom: getRecentRoom!,
  }
}

beforeEach(() => {
  mockGetItem.mockReset()
  mockSetItem.mockReset()
})

afterEach(() => {
  jest.restoreAllMocks()
})

test("returns an empty list when nothing is stored", async () => {
  mockGetItem.mockResolvedValue(null)
  const { getRecentRooms } = loadRecentRooms()

  await expect(getRecentRooms()).resolves.toEqual([])
  expect(mockGetItem).toHaveBeenCalledWith("nk-meet.recent-rooms")
})

test("returns an empty list when storage read fails", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation()
  const readFailure = new Error("storage read failed")
  mockGetItem.mockRejectedValue(readFailure)
  const { getRecentRooms } = loadRecentRooms()

  await expect(getRecentRooms()).resolves.toEqual([])
  expect(consoleError).toHaveBeenCalledWith(
    "Error reading recent rooms: ",
    readFailure,
  )
})

test("saves a new room as the only entry", async () => {
  mockGetItem.mockResolvedValue(null)
  const { saveRecentRoom } = loadRecentRooms()

  await saveRecentRoom("room-a", "Ada")

  expect(mockSetItem).toHaveBeenCalledWith(
    "nk-meet.recent-rooms",
    expect.any(String),
  )
  const [, savedJson] = mockSetItem.mock.calls[0]
  const saved = JSON.parse(savedJson) as {
    slug: string
    participantName: string
    joinedAt: number
  }[]
  expect(saved).toHaveLength(1)
  expect(saved[0]).toEqual({
    slug: "room-a",
    participantName: "Ada",
    joinedAt: expect.any(Number),
  })
})

test("puts the most recently saved room first", async () => {
  mockGetItem.mockResolvedValue(
    JSON.stringify([{ slug: "room-a", participantName: "Ada", joinedAt: 1 }]),
  )
  const { saveRecentRoom } = loadRecentRooms()

  await saveRecentRoom("room-b", "Grace")

  const [, savedJson] = mockSetItem.mock.calls[0]
  const saved = JSON.parse(savedJson) as { slug: string }[]
  expect(saved.map(room => room.slug)).toEqual(["room-b", "room-a"])
})

test("replaces an existing entry for the same slug instead of duplicating it", async () => {
  mockGetItem.mockResolvedValue(
    JSON.stringify([
      { slug: "room-a", participantName: "Ada", joinedAt: 1 },
      { slug: "room-b", participantName: "Grace", joinedAt: 2 },
    ]),
  )
  const { saveRecentRoom } = loadRecentRooms()

  await saveRecentRoom("room-a", "Ada Lovelace")

  const [, savedJson] = mockSetItem.mock.calls[0]
  const saved = JSON.parse(savedJson) as {
    slug: string
    participantName: string
  }[]
  expect(saved).toHaveLength(2)
  expect(saved[0]).toEqual({
    slug: "room-a",
    participantName: "Ada Lovelace",
    joinedAt: expect.any(Number),
  })
})

test("caps the list at 20 entries, dropping the oldest", async () => {
  const existing = Array.from({ length: 20 }, (_, i) => ({
    slug: `room-${i}`,
    participantName: "Ada",
    joinedAt: i,
  }))
  mockGetItem.mockResolvedValue(JSON.stringify(existing))
  const { saveRecentRoom } = loadRecentRooms()

  await saveRecentRoom("room-new", "Ada")

  const [, savedJson] = mockSetItem.mock.calls[0]
  const saved = JSON.parse(savedJson) as { slug: string }[]
  expect(saved).toHaveLength(20)
  expect(saved[0].slug).toBe("room-new")
  expect(saved.find(room => room.slug === "room-19")).toBeUndefined()
})

test("finds a recent room by slug", async () => {
  mockGetItem.mockResolvedValue(
    JSON.stringify([
      { slug: "room-a", participantName: "Ada", joinedAt: 1 },
      { slug: "room-b", participantName: "Grace", joinedAt: 2 },
    ]),
  )
  const { getRecentRoom } = loadRecentRooms()

  await expect(getRecentRoom("room-b")).resolves.toEqual({
    slug: "room-b",
    participantName: "Grace",
    joinedAt: 2,
  })
})

test("returns null when no recent room matches the slug", async () => {
  mockGetItem.mockResolvedValue(
    JSON.stringify([{ slug: "room-a", participantName: "Ada", joinedAt: 1 }]),
  )
  const { getRecentRoom } = loadRecentRooms()

  await expect(getRecentRoom("room-z")).resolves.toBeNull()
})

test("logs and resolves instead of throwing when persisting fails", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation()
  const writeFailure = new Error("storage write failed")
  mockGetItem.mockResolvedValue(null)
  mockSetItem.mockRejectedValue(writeFailure)
  const { saveRecentRoom } = loadRecentRooms()

  await expect(saveRecentRoom("room-a", "Ada")).resolves.toBeUndefined()
  expect(consoleError).toHaveBeenCalledWith(
    "Error saving a recent room: ",
    writeFailure,
  )
})
