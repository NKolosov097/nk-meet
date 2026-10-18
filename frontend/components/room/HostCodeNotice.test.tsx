// a11y:components/room/HostCodeNotice.tsx
import { AppState, type AppStateStatus } from "react-native"

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native"

import { ConnectionState, RoomEvent } from "livekit-client"

import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"
import { contrastRatio } from "@/utils/accessibility/contrast"

import { HostCodeNotice } from "./HostCodeNotice"

import type { MeetingEntry } from "@/services/livekitToken"

const listeners = new Map<string, (...args: unknown[]) => void>()
const mockRoom = {
  state: ConnectionState.Connected,
  on: jest.fn((event, handler) => {
    listeners.set(event, handler)
    return undefined
  }),
  off: jest.fn(event => {
    listeners.delete(event)
    return undefined
  }),
}
jest.mock("@livekit/react-native", () => ({ useRoomContext: () => mockRoom }))
jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
}))
jest.mock("@/services/livekitToken", () => ({
  getHostCodeVersion: jest.fn(),
  revealHostCode: jest.fn(),
}))
const api = jest.requireMock("@/services/livekitToken")
const clipboard = jest.requireMock("expo-clipboard")
const entry: MeetingEntry = {
  serverUrl: "wss://livekit.example",
  participantToken: "token",
  participantIdentity: "host-id",
  role: "host",
  hostAccess: "cap",
  codeVersion: 1,
}
const renderNotice = () =>
  render(<HostCodeNotice company="nkolosov" slug="weekly-sync" entry={entry} />)
beforeEach(() => {
  jest.useFakeTimers()
  listeners.clear()
  mockRoom.state = ConnectionState.Connected
  api.getHostCodeVersion.mockReset().mockResolvedValue({ codeVersion: 1 })
  api.revealHostCode
    .mockReset()
    .mockResolvedValue({ codeVersion: 2, hostCode: "00112233" })
  clipboard.setStringAsync.mockReset().mockResolvedValue(true)
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})
test("server hints verify version without auto-reveal; participant hints ignored", async () => {
  try {
    await renderNotice()
    const initial = api.getHostCodeVersion.mock.calls.length
    await act(() =>
      listeners.get(RoomEvent.DataReceived)?.(
        new Uint8Array(),
        { identity: "guest" },
        undefined,
        "nk.host-code.changed",
      ),
    )
    expect(api.getHostCodeVersion).toHaveBeenCalledTimes(initial)
    api.getHostCodeVersion.mockResolvedValue({ codeVersion: 2 })
    await act(() =>
      listeners.get(RoomEvent.DataReceived)?.(
        new Uint8Array(),
        undefined,
        undefined,
        "nk.host-code.changed",
      ),
    )
    expect(screen.getByText("Host code changed")).toBeVisible()
    expect(api.revealHostCode).not.toHaveBeenCalled()
    expect(clipboard.setStringAsync).not.toHaveBeenCalled()
    await fireEvent.press(
      screen.getByLabelText("Show new host code and copy to clipboard"),
    )
    expect(screen.getByText("0011-2233")).toBeVisible()
    expect(clipboard.setStringAsync).toHaveBeenCalledWith("0011-2233")
    expect(
      contrastRatio(TEXT_COLORS.light, BACKGROUND_COLORS.lightBackground),
    ).toBeGreaterThanOrEqual(4.5)
  } catch (error) {
    throw error
  }
})
test("stale in-flight reveal cannot display or copy after newer confirmed rotation", async () => {
  let resolve!: (value: { codeVersion: number; hostCode: string }) => void
  api.getHostCodeVersion.mockResolvedValue({ codeVersion: 2 })
  api.revealHostCode.mockReturnValue(
    new Promise(result => {
      resolve = result
    }),
  )
  try {
    await renderNotice()
    await fireEvent.press(
      screen.getByLabelText("Show new host code and copy to clipboard"),
    )
    expect(
      screen.getByLabelText("Show new host code and copy to clipboard"),
    ).toBeDisabled()
    api.getHostCodeVersion.mockResolvedValue({ codeVersion: 3 })
    await act(() =>
      listeners.get(RoomEvent.DataReceived)?.(
        new Uint8Array(),
        undefined,
        undefined,
        "nk.host-code.changed",
      ),
    )
    await act(() => resolve({ codeVersion: 2, hostCode: "00112233" }))
    expect(screen.queryByText("0011-2233")).toBeNull()
    expect(clipboard.setStringAsync).not.toHaveBeenCalled()
  } catch (error) {
    throw error
  }
})
test.each([false, "reject"])(
  "clipboard denial %s keeps code visible and permits gesture retry",
  async result => {
    api.getHostCodeVersion.mockResolvedValue({ codeVersion: 2 })
    if (result === false) clipboard.setStringAsync.mockResolvedValueOnce(false)
    else clipboard.setStringAsync.mockRejectedValueOnce(new Error("denied"))
    try {
      await renderNotice()
      await fireEvent.press(
        screen.getByLabelText("Show new host code and copy to clipboard"),
      )
      expect(screen.getByText("0011-2233")).toBeVisible()
      expect(screen.getByRole("alert")).toHaveTextContent(/Could not copy/)
      await fireEvent.press(screen.getByText("Retry copying"))
      expect(api.revealHostCode).toHaveBeenCalledTimes(1)
      expect(screen.queryByText("Retry copying")).toBeNull()
    } catch (error) {
      throw error
    }
  },
)
test("recovery suspends requests; reconnect and foreground catch up without reveal", async () => {
  let onForeground: ((state: AppStateStatus) => void) | undefined
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, callback) => {
      onForeground = callback
      return { remove: jest.fn() }
    })
  try {
    await renderNotice()
    const initial = api.getHostCodeVersion.mock.calls.length
    mockRoom.state = ConnectionState.Reconnecting
    await act(() => listeners.get(RoomEvent.ConnectionStateChanged)?.())
    await act(() => {
      jest.advanceTimersByTime(30000)
    })
    expect(api.getHostCodeVersion).toHaveBeenCalledTimes(initial)
    api.getHostCodeVersion.mockResolvedValue({ codeVersion: 3 })
    mockRoom.state = ConnectionState.Connected
    await act(() => listeners.get(RoomEvent.Reconnected)?.())
    await waitFor(() =>
      expect(screen.getByText("Host code changed")).toBeVisible(),
    )
    await act(() => onForeground?.("active"))
    expect(api.getHostCodeVersion.mock.calls.length).toBeGreaterThan(
      initial + 1,
    )
    expect(api.revealHostCode).not.toHaveBeenCalled()
    expect(clipboard.setStringAsync).not.toHaveBeenCalled()
  } catch (error) {
    throw error
  }
})
