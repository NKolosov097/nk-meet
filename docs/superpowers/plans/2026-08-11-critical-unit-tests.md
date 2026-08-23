# Critical Unit Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a focused Jest unit and component test suite that protects device identity, LiveKit token acquisition, media-device initialization, and the room join flow.

**Architecture:** Jest runs through the Expo preset, while React Native Testing Library drives `JoinScreen` through accessible user interactions. Tests keep application logic real and replace only native or external boundaries: AsyncStorage, LiveKit's sandbox token source, and environment configuration.

**Tech Stack:** Expo SDK 57, React 19, React Native 0.86, TypeScript 6, pnpm 11, Jest, `jest-expo`, React Native Testing Library.

## Global Constraints

- Dependency versions must be selected by Expo's installer for compatibility with Expo SDK 57.
- Use Jest with the `jest-expo` preset and React Native Testing Library; do not add `react-test-renderer` directly because React 19 does not support it as a public testing API.
- Test observable behavior, not exact styles, snapshots, private state, or component hierarchy.
- Mock only external boundaries; assertions must describe behavior of project code.
- Make no product behavior changes unless a test exposes a real defect; any correction must be minimal and covered by the failing test first.
- Keep the existing dropdown-layout tests and run them under the unified test command.

---

## File Map

- Modify `package.json`: test scripts, Jest configuration, and test dependencies.
- Modify `pnpm-lock.yaml`: lock resolved test dependencies.
- Create `jest.setup.ts`: stable mocks for Expo status bar and safe-area primitives used by component tests.
- Rename `components/room/controls/deviceDropdownLayout.test.ts` to `components/room/controls/deviceDropdownLayout.node.test.ts`: keep the Node-runner characterization tests from being collected by Jest until converted.
- Create `services/deviceIdentity.test.ts`: identity persistence, cache, and storage-failure tests.
- Create `services/livekitToken.test.ts`: token request contract and failure tests.
- Create `components/room/controls/useActiveMediaDevice.test.ts`: device fallback and subscription tests.
- Create `screens/JoinScreen.test.tsx`: accessible component integration tests for rendering and interaction.

---

### Task 1: Establish the Jest Test Harness

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `jest.setup.ts`
- Move: `components/room/controls/deviceDropdownLayout.test.ts` → `components/room/controls/deviceDropdownLayout.node.test.ts`

**Interfaces:**
- Consumes: Expo SDK 57 package metadata and the existing Node test file.
- Produces: `pnpm test`, `pnpm test:node`, and Jest path alias support for `@/` imports.

- [ ] **Step 1: Prove the missing harness**

Run: `pnpm test -- --runInBand`

Expected: FAIL because `package.json` has no `test` script.

- [ ] **Step 2: Install Expo-compatible test dependencies**

Run on Windows PowerShell:

```powershell
pnpm exec expo install jest-expo jest @types/jest @testing-library/react-native "--" --dev
```

Expected: `package.json` and `pnpm-lock.yaml` contain Expo-selected compatible versions.

- [ ] **Step 3: Configure scripts and Jest**

Add to `package.json`:

```json
{
  "scripts": {
    "test": "jest --runInBand",
    "test:node": "node --test --experimental-strip-types components/room/controls/deviceDropdownLayout.node.test.ts"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEnv": ["<rootDir>/jest.setup.ts"],
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/$1"
    },
    "testPathIgnorePatterns": ["\\.node\\.test\\.ts$"]
  }
}
```

Create `jest.setup.ts` with deterministic surface-level native wrappers:

```ts
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }))

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")

  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
  }
})
```

Rename the existing test so Jest does not try to execute `node:test` declarations.

- [ ] **Step 4: Verify both runners**

Run: `pnpm test -- --passWithNoTests`

Expected: PASS with no Jest tests collected.

Run: `pnpm test:node`

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```powershell
git add package.json pnpm-lock.yaml jest.setup.ts components/room/controls/deviceDropdownLayout.node.test.ts
git commit -m "test: configure Expo unit test harness"
```

---

### Task 2: Protect Device Identity Persistence

**Files:**
- Create: `services/deviceIdentity.test.ts`

**Interfaces:**
- Consumes: `getDeviceIdentity(): Promise<string>` and AsyncStorage's `getItem`/`setItem` boundary.
- Produces: regression coverage for stored, generated, cached, and storage-failure identities.

- [ ] **Step 1: Write isolated tests**

Use `jest.resetModules()` before each import so module-local `cachedIdentity` starts empty. Mock `@react-native-async-storage/async-storage` with complete `getItem` and `setItem` functions. Add separate tests proving:

```ts
expect(await getDeviceIdentity()).toBe("device-stored")
expect(setItem).not.toHaveBeenCalled()
```

```ts
expect(generated).toMatch(/^device-[a-z0-9]{16}$/)
expect(setItem).toHaveBeenCalledWith("nk-meet.device-identity", generated)
```

```ts
expect(await getDeviceIdentity()).toBe(firstIdentity)
expect(getItem).toHaveBeenCalledTimes(1)
```

For rejected reads and writes, spy on `console.error`, assert a valid generated identity is returned, and restore the spy after the test.

- [ ] **Step 2: Mutation-check the tests**

Temporarily replace the cached return in `getDeviceIdentity` with a newly generated identity.

Run: `pnpm test -- services/deviceIdentity.test.ts`

Expected: FAIL in the cache-reuse test because the second result differs or storage is read again. Restore production code immediately.

- [ ] **Step 3: Verify the restored behavior**

Run: `pnpm test -- services/deviceIdentity.test.ts`

Expected: PASS for stored, generated, cached, read-failure, and write-failure cases.

- [ ] **Step 4: Commit**

```powershell
git add services/deviceIdentity.test.ts
git commit -m "test: protect stable device identity"
```

---

### Task 3: Protect the LiveKit Token Contract

**Files:**
- Create: `services/livekitToken.test.ts`

**Interfaces:**
- Consumes: `fetchParticipantToken(participantName: string): Promise<string>`, `env.roomName`, `getDeviceIdentity`, and `TokenSource.sandboxTokenServer`.
- Produces: regression coverage for request payload, returned token, empty token, and server failure.

- [ ] **Step 1: Write boundary-focused tests**

Mock `@/constants/env` with complete values, `getDeviceIdentity` as `jest.fn().mockResolvedValue("device-123")`, and the LiveKit factory with a stable `fetch` spy. Import the service after mocks. Assert the real service result and request contract:

```ts
await expect(fetchParticipantToken("Ada")).resolves.toBe("token-abc")
expect(fetch).toHaveBeenCalledWith(
  {
    roomName: "critical-room",
    participantName: "Ada",
    participantIdentity: "device-123",
  },
  true,
)
```

Add distinct fixtures for `{ participantToken: "" }` and `fetch` rejecting with `new Error("token server offline")`.

- [ ] **Step 2: Mutation-check the payload test**

Temporarily pass `participantName: "wrong"` in `services/livekitToken.ts`.

Run: `pnpm test -- services/livekitToken.test.ts`

Expected: FAIL showing the incorrect participant name. Restore production code immediately.

- [ ] **Step 3: Verify the restored service**

Run: `pnpm test -- services/livekitToken.test.ts`

Expected: PASS, including explicit `Token server returned an empty access token` rejection and propagation of `token server offline`.

- [ ] **Step 4: Commit**

```powershell
git add services/livekitToken.test.ts
git commit -m "test: protect LiveKit token requests"
```

---

### Task 4: Protect Active Media Device Selection

**Files:**
- Create: `components/room/controls/useActiveMediaDevice.test.ts`

**Interfaces:**
- Consumes: `initializeActiveMediaDevice(room, source, availableDevices): Promise<void>` and `subscribeToMediaDevicesChanged(room, onChange): VoidFunction`.
- Produces: regression coverage for audio/video kind mapping, fallback selection, no-op branches, and listener cleanup.

- [ ] **Step 1: Write room-boundary tests**

Create a minimal typed room double with `getActiveDevice`, `switchActiveDevice`, `on`, and `off`. Use literal device lists. Cover:

```ts
await initializeActiveMediaDevice(room, Track.Source.Camera, [
  { deviceId: "camera-1" },
])
expect(switchActiveDevice).toHaveBeenCalledWith("videoinput", "camera-1")
```

Repeat for microphone/`audioinput`; assert no switch for a valid active device or an empty list. For subscriptions, invoke the returned cleanup and assert registration and removal use `RoomEvent.MediaDevicesChanged` with the identical callback.

- [ ] **Step 2: Mutation-check fallback selection**

Temporarily change `fallbackDevice` to `availableDevices[1]`.

Run: `pnpm test -- components/room/controls/useActiveMediaDevice.test.ts`

Expected: FAIL because `camera-1` was not selected. Restore production code immediately.

- [ ] **Step 3: Verify restored behavior**

Run: `pnpm test -- components/room/controls/useActiveMediaDevice.test.ts`

Expected: PASS for all mapping, fallback, no-op, and cleanup cases.

- [ ] **Step 4: Commit**

```powershell
git add components/room/controls/useActiveMediaDevice.test.ts
git commit -m "test: protect active media device selection"
```

---

### Task 5: Protect JoinScreen User Behavior

**Files:**
- Create: `screens/JoinScreen.test.tsx`

**Interfaces:**
- Consumes: `JoinScreen({ error?, onJoined })`, mocked token service, and mocked environment state.
- Produces: component-level protection through `Participant name`, `Join room`, and visible messages.

- [ ] **Step 1: Write component tests with user events**

Mock only `fetchParticipantToken` and `@/constants/env`. Render the real `JoinScreen`. Cover these observable cases:

```ts
await user.type(screen.getByLabelText("Participant name"), "  Ada  ")
await user.press(screen.getByLabelText("Join room"))
expect(fetchParticipantToken).toHaveBeenCalledWith("Ada")
await waitFor(() => expect(onJoined).toHaveBeenCalledWith("token-abc"))
```

```ts
await user.press(screen.getByLabelText("Join room"))
expect(await screen.findByText("Please enter your name")).toBeVisible()
expect(fetchParticipantToken).not.toHaveBeenCalled()
```

Use a deferred promise to prove the input and button become disabled while pending and two presses cause one request. Add separate failures for `new Error("token denied")` and a string rejection. Render with `error="connection lost"` to prove the initial connection error is replaced after a failed current attempt. In a module-isolated case with `configError="Missing room configuration"`, assert the message is visible, both controls are disabled, and the service is not called.

- [ ] **Step 2: Run the component tests**

Run: `pnpm test -- screens/JoinScreen.test.tsx`

Expected: PASS as characterization of current behavior. If a case passes immediately, perform its mutation check before accepting it.

- [ ] **Step 3: Apply only behavior-preserving corrections**

If a test exposes a real defect, first confirm the failure is caused by the production behavior rather than test setup. Then correct `JoinScreen` minimally so validation does not flash loading, pending attempts disable interaction, one request produces one success callback, and the exact existing messages remain visible. Do not change layout or styling.

- [ ] **Step 4: Mutation-check duplicate prevention**

Temporarily remove the `isJoiningRef.current` guard in `screens/JoinScreen.tsx`.

Run: `pnpm test -- screens/JoinScreen.test.tsx`

Expected: FAIL because two presses issue two token requests. Restore the guard immediately.

- [ ] **Step 5: Verify restored behavior**

Run: `pnpm test -- screens/JoinScreen.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add screens/JoinScreen.test.tsx screens/JoinScreen.tsx
git commit -m "test: protect room join behavior"
```

---

### Task 6: Full Verification and Documentation Alignment

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: all test suites and existing quality scripts.
- Produces: documented unit-test command and verified pre-E2E baseline.

- [ ] **Step 1: Document unit testing**

Add a concise Development subsection to `README.md`:

````markdown
### Unit tests

Run the Jest unit and component suite:

```bash
pnpm test
```

Run the retained dependency-free geometry tests:

```bash
pnpm test:node
```
````

- [ ] **Step 2: Run the complete unit suite**

Run: `pnpm test`

Expected: PASS with zero failed suites and zero failed tests.

Run: `pnpm test:node`

Expected: PASS, 5 tests.

- [ ] **Step 3: Run static verification**

Run: `pnpm type-check`

Expected: PASS.

Run: `pnpm lint`

Expected: PASS with zero errors.

Run: `pnpm format:check`

Expected: PASS.

- [ ] **Step 4: Review the change set against the design**

Run: `git diff --check HEAD~5..HEAD`

Expected: no whitespace errors. Confirm each design requirement maps to a named test and no snapshots or style assertions were introduced.

- [ ] **Step 5: Commit documentation**

```powershell
git add README.md
git commit -m "docs: document unit test commands"
```
