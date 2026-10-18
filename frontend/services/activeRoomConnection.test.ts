import {
  disconnectActiveRoom,
  registerActiveRoom,
  unregisterActiveRoom,
  type ActiveRoomRegistration,
} from "./activeRoomConnection"

const registration = (
  company: string,
  slug: string,
): ActiveRoomRegistration & {
  disconnect: jest.Mock<Promise<void>, []>
  onForcedDisconnect: jest.Mock<void, []>
} => ({
  company,
  slug,
  disconnect: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  onForcedDisconnect: jest.fn<void, []>(),
})

// Leaves the registry empty for the next test: taking the slot with a throwaway
// registration and then releasing it is the only ownership-checked way to clear
// it, which is exactly the guarantee these tests are about.
afterEach(() => {
  const sentinel = registration("sentinel", "sentinel")
  registerActiveRoom(sentinel)
  unregisterActiveRoom(sentinel)
})

test("does nothing when no room is registered", async () => {
  await expect(
    disconnectActiveRoom({ company: "nkolosov", slug: "room-b" }),
  ).resolves.toBeUndefined()
})

test("disconnects the active room when the link targets another room", async () => {
  const roomA = registration("nkolosov", "room-a")
  registerActiveRoom(roomA)

  await disconnectActiveRoom({ company: "nkolosov", slug: "room-b" })

  expect(roomA.onForcedDisconnect).toHaveBeenCalledTimes(1)
  expect(roomA.disconnect).toHaveBeenCalledTimes(1)
})

test("marks the disconnect as forced before disconnecting", async () => {
  const order: string[] = []
  const roomA = registration("nkolosov", "room-a")
  roomA.onForcedDisconnect.mockImplementation(() => order.push("forced"))
  roomA.disconnect.mockImplementation(async () => {
    order.push("disconnect")
  })
  registerActiveRoom(roomA)

  await disconnectActiveRoom({ company: "nkolosov", slug: "room-b" })

  expect(order).toEqual(["forced", "disconnect"])
})

test("keeps the call alive when the link targets the active company and room", async () => {
  const roomA = registration("nkolosov", "room-a")
  registerActiveRoom(roomA)

  await disconnectActiveRoom({ company: "nkolosov", slug: "room-a" })

  expect(roomA.onForcedDisconnect).not.toHaveBeenCalled()
  expect(roomA.disconnect).not.toHaveBeenCalled()
})

test("disconnects a same-slug call when the link selects another company", async () => {
  const roomA = registration("nkolosov-1", "room-a")
  registerActiveRoom(roomA)

  await disconnectActiveRoom({ company: "nkolosov-2", slug: "room-a" })

  expect(roomA.disconnect).toHaveBeenCalledTimes(1)
})

test("releases the slot so the same handler is never disconnected twice", async () => {
  const roomA = registration("nkolosov", "room-a")
  registerActiveRoom(roomA)

  await disconnectActiveRoom({ company: "nkolosov", slug: "room-b" })
  await disconnectActiveRoom({ company: "nkolosov", slug: "room-c" })

  expect(roomA.disconnect).toHaveBeenCalledTimes(1)
})

test("stops calling a handler after its own registration is cleared", async () => {
  const roomA = registration("nkolosov", "room-a")
  registerActiveRoom(roomA)
  unregisterActiveRoom(roomA)

  await disconnectActiveRoom({ company: "nkolosov", slug: "room-b" })

  expect(roomA.disconnect).not.toHaveBeenCalled()
})

test("logs a failed disconnect instead of rejecting", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation()
  const roomA = registration("nkolosov", "room-a")
  roomA.disconnect.mockRejectedValue(new Error("disconnect failed"))
  registerActiveRoom(roomA)

  await expect(
    disconnectActiveRoom({ company: "nkolosov", slug: "room-b" }),
  ).resolves.toBeUndefined()

  expect(consoleError).toHaveBeenCalledWith(
    "Error disconnecting the active room: ",
    expect.any(Error),
  )
  consoleError.mockRestore()
})

test("keeps the newer registration when an older room unregisters late", async () => {
  const roomA = registration("nkolosov", "room-a")
  const roomB = registration("nkolosov", "room-b")
  registerActiveRoom(roomA)
  registerActiveRoom(roomB)

  unregisterActiveRoom(roomA)
  await disconnectActiveRoom({ company: "nkolosov", slug: "room-c" })

  expect(roomA.disconnect).not.toHaveBeenCalled()
  expect(roomB.disconnect).toHaveBeenCalledTimes(1)
})
