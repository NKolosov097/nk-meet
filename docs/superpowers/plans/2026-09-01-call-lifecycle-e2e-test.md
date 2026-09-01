# Call Lifecycle E2E Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Jest integration test that walks the full call lifecycle — open `JoinScreen` → acquire a token → enter the room → toggle the camera → disconnect — through the real, unstubbed component tree, closing the last open item in the "Технический долг" section of `TODO.md`.

**Architecture:** One new test file, `app/callLifecycle.integration.test.tsx`, renders the real `RoomScreen` (`app/[company]/[slug].tsx`) with only the external LiveKit/router/token/storage boundary mocked — `ActiveRoom`, `VideoConference`, `ControlBar`, `CameraControl`, `MicrophoneControl`, and `ConfirmDisconnectModal` all run for real, which is what distinguishes this from the existing narrower integration tests.

**Tech Stack:** Jest (`jest-expo` preset), `@testing-library/react-native`, TypeScript. No new dependencies.

## Global Constraints

- Use `VoidFunction` instead of `() => void` (not needed in this plan's code, noted for completeness).
- Prefer `interface` over `type` when either can express the same shape; a generic utility instantiation (`PropsWithChildren<LiveKitRoomProps>`) is the established exception already used in `app/[company]/[slug].test.tsx`.
- No double type assertions (`as unknown as X`). A single assertion such as `{} as Record<string, string>` is allowed.
- Use `nkolosov` for the single company this test needs (per project convention, distinct companies only when a scenario requires them — this one doesn't).
- No inline object/array literals as JSX props except `style` — not triggered here since the only JSX is `<RoomScreen />` (no props) and `React.createElement` calls in mock factories, which are not JSX.
- Every `interface` field gets a one-line comment above it explaining what it holds.
- Comments are 1-3 lines max.
- No wildcard package imports.
- Commits use the project owner's configured git identity (`Nikita Kolosov` / `nikita.kolosov@brightpattern.com`), no AI attribution or co-author trailers.
- No production code or visual UI changes in this plan, so the WCAG/accessibility-test requirement in `CLAUDE.md` is not triggered.
- `docs/superpowers/` is gitignored in this repo but its existing contents are force-added and tracked (`git ls-files` confirms it) — use `git add -f` for any file under it.

---

### Task 1: Add the call lifecycle integration test

**Files:**
- Create: `app/callLifecycle.integration.test.tsx`
- Modify: `TODO.md` (mark the E2E item done)

**Interfaces:**
- Consumes: `RoomScreen` default export from `app/[company]/[slug].tsx` (no props — reads company/slug from the mocked `expo-router`); `fetchParticipantToken(name: string, roomName: string): Promise<string>` from `@/services/livekitToken`; accessibility labels already established by `JoinScreen`, `ControlBar`, `CameraControl`, `ConfirmDisconnectModal` ("Participant name", "Join room", "Turn on camera", "Turn off camera", "Disconnect from room", "Confirm disconnect"); `testID="active-room"` from `ActiveRoom`.
- Produces: nothing consumed by later tasks — this is the only task in this plan.

- [ ] **Step 1: Write the test file**

Create `app/callLifecycle.integration.test.tsx` with this exact content:

```tsx
import type { PropsWithChildren } from "react"

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native"

import type { LiveKitRoomProps } from "@livekit/react-native"

import RoomScreen from "./[company]/[slug]"

type LiveKitBoundaryProps = PropsWithChildren<LiveKitRoomProps>

let mockCompany: string | undefined = "nkolosov"
let mockSlug: string | undefined = "weekly-sync"
let latestLiveKitProps: LiveKitBoundaryProps | undefined
let mockCameraEnabled = false
let mockMicrophoneEnabled = true
const mockReplace = jest.fn()
const mockBack = jest.fn()

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ company: mockCompany, slug: mockSlug }),
  useRouter: () => ({
    replace: mockReplace,
    back: mockBack,
    canGoBack: () => true,
  }),
}))

jest.mock("@/constants/env", () => ({
  env: { serverUrl: "wss://e2e.livekit.cloud" },
  configError: null,
}))

jest.mock("@/services/livekitToken", () => ({
  fetchParticipantToken: jest.fn(),
}))

jest.mock("@/services/recentRooms", () => ({
  getRecentRoom: jest.fn(() => Promise.resolve(null)),
  saveRecentRoom: jest.fn(() => Promise.resolve()),
}))

jest.mock("livekit-client", () => ({
  ...jest.requireActual("livekit-client"),
  createLocalVideoTrack: jest.fn(() =>
    Promise.resolve({
      stop: jest.fn(),
      mediaStream: { toURL: () => "preview" },
    }),
  ),
}))

const mockLocalParticipant = {
  setCameraEnabled: jest.fn<Promise<void>, [boolean]>(),
  setMicrophoneEnabled: jest.fn<Promise<void>, [boolean]>(),
  attributes: {} as Record<string, string>,
  setAttributes: jest.fn<Promise<void>, [Record<string, string>]>(),
}

const mockRoom = {
  disconnect: jest.fn<Promise<void>, []>(),
  getActiveDevice: jest.fn<string | undefined, [MediaDeviceKind]>(),
  switchActiveDevice: jest.fn<Promise<void>, [MediaDeviceKind, string]>(),
  on: jest.fn(),
  off: jest.fn(),
  localParticipant: mockLocalParticipant,
  remoteParticipants: new Map(),
}

jest.mock("@livekit/react-native", () => {
  const React = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")

  return {
    useRoomContext: () => mockRoom,
    useLocalParticipant: () => ({
      isCameraEnabled: mockCameraEnabled,
      isMicrophoneEnabled: mockMicrophoneEnabled,
      localParticipant: mockLocalParticipant,
    }),
    useTracks: () => [],
    useTrackMutedIndicator: () => ({ isMuted: false }),
    useIsSpeaking: () => false,
    isTrackReference: (trackRef: { publication?: unknown }) =>
      Boolean(trackRef.publication),
    VideoTrack: () => null,
    VideoView: () => null,
    LiveKitRoom: (props: LiveKitBoundaryProps) => {
      latestLiveKitProps = props

      return React.createElement(View, null, props.children)
    },
  }
})

const { fetchParticipantToken: mockFetchParticipantToken } = jest.requireMock(
  "@/services/livekitToken",
) as { fetchParticipantToken: jest.Mock<Promise<string>, [string, string]> }

const joinAsParticipant = async (name: string): Promise<void> => {
  await fireEvent.changeText(screen.getByLabelText("Participant name"), name)
  await fireEvent.press(screen.getByLabelText("Join room"))
  await waitFor(() => expect(latestLiveKitProps).toBeDefined())
}

beforeEach(() => {
  mockCompany = "nkolosov"
  mockSlug = "weekly-sync"
  latestLiveKitProps = undefined
  mockCameraEnabled = false
  mockMicrophoneEnabled = true
  mockReplace.mockReset()
  mockBack.mockReset()
  mockFetchParticipantToken.mockReset().mockResolvedValue("token-abc")
  mockRoom.disconnect.mockReset().mockResolvedValue(undefined)
  mockRoom.getActiveDevice.mockReset().mockReturnValue(undefined)
  mockRoom.switchActiveDevice.mockReset().mockResolvedValue(undefined)
  mockLocalParticipant.attributes = {}
  mockLocalParticipant.setAttributes.mockReset().mockResolvedValue(undefined)
  mockLocalParticipant.setCameraEnabled.mockReset().mockResolvedValue(undefined)
  mockLocalParticipant.setMicrophoneEnabled
    .mockReset()
    .mockResolvedValue(undefined)
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: jest.fn(),
      enumerateDevices: jest.fn(() => Promise.resolve([])),
    },
  })
})

test("walks the full call lifecycle: join, enable camera, disconnect", async () => {
  const view = await render(<RoomScreen />)
  await joinAsParticipant("Ada")

  expect(mockFetchParticipantToken).toHaveBeenCalledWith(
    "Ada",
    "nkolosov--weekly-sync",
  )
  expect(view.getByTestId("active-room")).toBeVisible()
  expect(view.getByText("No participants in the room")).toBeVisible()

  await fireEvent.press(view.getByLabelText("Turn on camera"))

  await waitFor(() => {
    expect(mockLocalParticipant.setCameraEnabled).toHaveBeenCalledWith(true)
  })

  mockCameraEnabled = true
  await view.rerender(<RoomScreen />)

  expect(view.getByLabelText("Turn off camera")).toBeVisible()

  await fireEvent.press(view.getByLabelText("Disconnect from room"))
  await fireEvent.press(view.getByLabelText("Confirm disconnect"))

  await waitFor(() => expect(mockRoom.disconnect).toHaveBeenCalledTimes(1))
  await act(async () => {
    latestLiveKitProps?.onDisconnected?.()
  })

  expect(mockReplace).toHaveBeenCalledWith("/nkolosov")
  expect(view.getByLabelText("Participant name")).toBeVisible()
})

test("returns to the join screen with the connection error message", async () => {
  const view = await render(<RoomScreen />)
  await joinAsParticipant("Ada")

  await act(async () => {
    latestLiveKitProps?.onError?.(new Error("room unavailable"))
  })

  expect(await view.findByText("room unavailable")).toBeVisible()
  expect(view.getByLabelText("Participant name")).toBeVisible()
})

test("supports joining again after a disconnect", async () => {
  const view = await render(<RoomScreen />)
  await joinAsParticipant("Ada")

  await fireEvent.press(view.getByLabelText("Disconnect from room"))
  await fireEvent.press(view.getByLabelText("Confirm disconnect"))
  await waitFor(() => expect(mockRoom.disconnect).toHaveBeenCalledTimes(1))
  await act(async () => {
    latestLiveKitProps?.onDisconnected?.()
  })

  mockFetchParticipantToken.mockResolvedValue("token-def")
  latestLiveKitProps = undefined
  await joinAsParticipant("Grace")

  expect(mockFetchParticipantToken).toHaveBeenLastCalledWith(
    "Grace",
    "nkolosov--weekly-sync",
  )
  expect(view.getByTestId("active-room")).toBeVisible()
})
```

- [ ] **Step 2: Run the new test file and confirm it passes**

Run: `pnpm test -- app/callLifecycle.integration.test.tsx`
Expected: PASS, 3 tests. This is a characterization test of already-working behavior (no production code changes in this plan), so the expected outcome is a pass on the first run, not a red/green cycle.

- [ ] **Step 3: Mutation-check the primary assertion path**

Temporarily edit `components/room/ControlBar.tsx`: in the `disconnect` callback, comment out the `await room.disconnect()` line (leave `setIsConfirmingDisconnect(false)` in the `finally` block). Run:

Run: `pnpm test -- app/callLifecycle.integration.test.tsx`
Expected: FAIL — `"walks the full call lifecycle..."` times out waiting for `mockRoom.disconnect` to have been called.

Revert the edit in `components/room/ControlBar.tsx` (restore the `await room.disconnect()` line exactly as it was).

Run: `pnpm test -- app/callLifecycle.integration.test.tsx`
Expected: PASS again, confirming the test genuinely exercises the disconnect path rather than passing vacuously.

- [ ] **Step 4: Run the full verification suite**

Run each of these and confirm a clean result before moving on:

```bash
pnpm test
pnpm test:node
pnpm type-check
pnpm lint
pnpm format:check
```

If `format:check` reports the pre-existing `eas.json` discrepancy noted in `docs/superpowers/specs/2026-08-12-integration-tests-design.md`, that is out of scope for this plan — do not fix it. Any other formatting or lint failure must be fixed before continuing.

- [ ] **Step 5: Update `TODO.md`**

Open `TODO.md` and replace this entry:

```markdown
- [ ] End-to-end тест полного сценария звонка
      → Тесты (`*.test.tsx`, `*.integration.test.tsx`) покрывают компоненты и роутинг по отдельности; нет теста,
      который проходит путь "открыть JoinScreen → получить токен → зайти в комнату → включить камеру → отключиться"
      от начала до конца на реальном/фейковом LiveKit-соединении.
```

with:

```markdown
- [x] End-to-end тест полного сценария звонка
      → Добавлен `app/callLifecycle.integration.test.tsx`: рендерит настоящий `RoomScreen` целиком
      (`JoinScreen` → `LiveKitRoom` → `ActiveRoom`/`VideoConference`/`ControlBar`, без стаба `ActiveRoom`,
      в отличие от `[slug].test.tsx`), с фейком LiveKit только на границе `@livekit/react-native`/`livekit-client`.
      Три сценария: join → включить камеру → disconnect; возврат на JoinScreen с сообщением об ошибке подключения;
      повторный join после disconnect. Дизайн: `docs/superpowers/specs/2026-09-01-call-lifecycle-e2e-test-design.md`.
```

- [ ] **Step 6: Commit**

```bash
git add app/callLifecycle.integration.test.tsx TODO.md
git commit -m "test: add full call lifecycle integration test"
```

Verify the commit author matches the project owner's configured git identity before finishing (`git log -1 --format='%an <%ae>'`).
