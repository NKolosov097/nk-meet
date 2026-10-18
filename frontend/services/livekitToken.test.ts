import {
  createRoom,
  fetchParticipantToken,
  getRoom,
  revealHostCode,
} from "./livekitToken"

jest.mock("@/constants/env", () => ({
  env: { backendUrl: "https://backend.example" },
}))
const response = (value: object, status = 200): Response =>
  ({
    ok: status < 400,
    status,
    headers: new Headers(),
    json: async () => value,
  }) as Response
const mockFetch = jest.fn()
beforeEach(() => {
  global.fetch = mockFetch
  mockFetch.mockReset()
})
test("participant issuance supplies no identity, role claim or code", async () => {
  mockFetch.mockResolvedValue(
    response({
      serverUrl: "wss://livekit.example",
      participantToken: "token",
      participantIdentity: "server-id",
      role: "participant",
    }),
  )
  try {
    const entry = await fetchParticipantToken("Ada", "nkolosov", "weekly-sync")
    expect(entry.role).toBe("participant")
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://backend.example/v1/rooms/nkolosov/weekly-sync/join",
    )
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      displayName: "Ada",
      mode: "participant",
    })
  } catch (error) {
    throw error
  }
})
test("host joins always make fresh requests with canonical code", async () => {
  mockFetch.mockResolvedValue(
    response({
      serverUrl: "wss://livekit.example",
      participantToken: "token",
      participantIdentity: "server-id",
      role: "host",
      hostAccess: "cap",
      codeVersion: 1,
    }),
  )
  try {
    await fetchParticipantToken("Ada", "nkolosov", "weekly-sync", "00112233")
    await fetchParticipantToken("Ada", "nkolosov", "weekly-sync", "00112233")
  } catch (error) {
    throw error
  }
  expect(mockFetch).toHaveBeenCalledTimes(2)
  expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
    displayName: "Ada",
    mode: "host",
    hostCode: "00112233",
  })
})
test("malformed join and reveal responses fail closed", async () => {
  mockFetch.mockResolvedValue(
    response({ role: "host", participantToken: "token" }),
  )
  try {
    await expect(
      fetchParticipantToken("Ada", "nkolosov", "weekly-sync", "00112233"),
    ).rejects.toThrow("Invalid backend response")
  } catch (error) {
    throw error
  }
  mockFetch.mockResolvedValue(response({ hostCode: "1234", codeVersion: 1 }))
  try {
    await expect(
      revealHostCode("nkolosov", "weekly-sync", "cap"),
    ).rejects.toThrow("Invalid backend response")
  } catch (error) {
    throw error
  }
})
test("unknown room message remains distinguishable", async () => {
  mockFetch.mockResolvedValue(
    response({ error: { message: "Room not found" } }, 404),
  )
  try {
    await expect(getRoom("nkolosov", "old-room")).rejects.toThrow(
      "Room not found",
    )
  } catch (error) {
    throw error
  }
})
test("creation only sends organizer code", async () => {
  mockFetch.mockResolvedValue(
    response({ company: "nkolosov", slug: "abc123" }, 201),
  )
  try {
    await createRoom("00112233")
  } catch (error) {
    throw error
  }
  expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
    hostCode: "00112233",
  })
})

test("host request cannot silently downgrade to participant", async () => {
  mockFetch.mockResolvedValue(
    response({
      serverUrl: "wss://livekit.example",
      participantToken: "token",
      participantIdentity: "server-id",
      role: "participant",
    }),
  )
  try {
    await expect(
      fetchParticipantToken("Ada", "nkolosov", "weekly-sync", "00112233"),
    ).rejects.toThrow("Invalid backend response")
  } catch (error) {
    throw error
  }
})
