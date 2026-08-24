import { act, renderHook } from "@testing-library/react-native"

import { useRegisterActiveRoomDisconnect } from "./useRegisterActiveRoomDisconnect"

import type { ActiveRoomRegistration } from "@/services/activeRoomConnection"

const mockDisconnect = jest.fn()
const mockRegister = jest.fn()
const mockUnregister = jest.fn()

jest.mock("@livekit/react-native", () => ({
  useRoomContext: () => ({ disconnect: mockDisconnect }),
}))

jest.mock("@/services/activeRoomConnection", () => ({
  registerActiveRoom: (...args: unknown[]) => mockRegister(...args),
  unregisterActiveRoom: (...args: unknown[]) => mockUnregister(...args),
}))

const registeredRegistration = (call: number): ActiveRoomRegistration =>
  mockRegister.mock.calls[call][0] as ActiveRoomRegistration

beforeEach(() => {
  mockRegister.mockReset()
  mockUnregister.mockReset()
  mockDisconnect.mockReset()
})

test("registers a disconnect handler bound to the current company and room", async () => {
  await renderHook(() =>
    useRegisterActiveRoomDisconnect("nkolosov", "quiet-tiger-42", jest.fn()),
  )

  expect(mockRegister).toHaveBeenCalledTimes(1)
  const registration = registeredRegistration(0)
  expect(registration.company).toBe("nkolosov")
  expect(registration.slug).toBe("quiet-tiger-42")
  registration.disconnect()
  expect(mockDisconnect).toHaveBeenCalledTimes(1)
})

test("forwards the forced-disconnect callback to the registry", async () => {
  const onForcedDisconnect = jest.fn<void, []>()
  await renderHook(() =>
    useRegisterActiveRoomDisconnect(
      "nkolosov",
      "quiet-tiger-42",
      onForcedDisconnect,
    ),
  )

  registeredRegistration(0).onForcedDisconnect()

  expect(onForcedDisconnect).toHaveBeenCalledTimes(1)
})

test("releases only its own registration on unmount", async () => {
  const { unmount } = await renderHook(() =>
    useRegisterActiveRoomDisconnect("nkolosov", "quiet-tiger-42", jest.fn()),
  )
  await act(() => unmount())

  expect(mockUnregister).toHaveBeenCalledTimes(1)
  expect(mockUnregister).toHaveBeenCalledWith(registeredRegistration(0))
})
