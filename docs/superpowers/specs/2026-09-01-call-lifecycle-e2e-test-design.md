# Call Lifecycle E2E Test Design

## Goal

Close the outstanding TODO item: no test currently walks the full call path —
open `JoinScreen` → acquire a token → enter the room → toggle the camera →
disconnect — through the real component tree. Existing integration tests
cover pieces of this path in isolation (`[slug].test.tsx` stubs `ActiveRoom`
entirely; `ControlBar.integration.test.tsx` mounts `ControlBar` standalone),
but none exercises the whole chain together.

## Test Boundary

Same boundary policy as `docs/superpowers/specs/2026-08-12-integration-tests-design.md`:
render real project components, replace only system/external boundaries.

Mocked:

- `expo-router` (`useLocalSearchParams`, `useRouter`)
- `@/constants/env`, `@/services/livekitToken`, `@/services/recentRooms`
- `@livekit/react-native`: `LiveKitRoom`, `useRoomContext`, `useLocalParticipant`,
  `useTracks`, `useTrackMutedIndicator`, `useIsSpeaking`, `isTrackReference`,
  `VideoTrack`, `VideoView`
- `livekit-client`: only `createLocalVideoTrack` (pre-join camera preview);
  everything else (`Track`, `ParticipantKind`, `VideoPresets`) stays real
  since `app/[company]/[slug].tsx` imports them at module load

Real, unstubbed: `RoomScreen`, `JoinScreen`, `ActiveRoom`,
`MeetingInfoBanner`, `VideoConference`, `ControlBar`, `CameraControl`,
`MicrophoneControl`, `ConfirmDisconnectModal`. This is the boundary that
makes the new test distinct from every existing integration test.

The `LiveKitRoom` mock renders its children and exposes its props
(`serverUrl`, `token`, `onDisconnected`, `onError`, ...) for assertions, same
pattern as `[slug].test.tsx`. `useLocalParticipant`/`useRoomContext` return
values driven by test-local mutable variables, updated and then propagated
through `rerender`, same pattern as `ControlBar.integration.test.tsx` — no
event-emitting fake `Room` is needed because that pattern is already proven
sufficient in this codebase.

## File

`app/callLifecycle.integration.test.tsx` — a cross-cutting scenario, not tied
to one component, alongside `app/deepLink.integration.test.tsx` and
`app/routing.integration.test.tsx`.

## Scenarios

1. **Full lifecycle (primary).** Render `RoomScreen` → `JoinScreen` visible →
   fill participant name, press "Join room" → `fetchParticipantToken` called,
   `LiveKitRoom` mounted with the returned token → `ActiveRoom` visible
   (banner, `ControlBar`, "No participants in the room") → press "Turn on
   camera" → `localParticipant.setCameraEnabled(true)` called → update the
   mocked hook state and `rerender` → button now reads "Turn off camera" →
   press "Disconnect from room" → confirm in the modal → `room.disconnect()`
   called → mocked `LiveKitRoom` invokes `onDisconnected` → `JoinScreen` for
   the same company/room is visible again.
2. **Connection error mid-flow.** After joining, invoke the mocked
   `LiveKitRoom`'s `onError` → `JoinScreen` is shown again with the LiveKit
   error message, matching the existing single-boundary test in
   `[slug].test.tsx` but now reached through the unstubbed `ActiveRoom` tree.
3. **Re-join after disconnect.** After completing scenario 1 through
   disconnect, repeat the join step (new name, new token) and confirm the
   same full path succeeds a second time on the same rendered tree.

No new production behavior is being added — these are characterization
tests of the already-working flow.

## Verification

- `pnpm test` (full Jest suite), `pnpm test:node`, `pnpm type-check`,
  `pnpm lint`, `pnpm format:check`.
- Mutation check for the new test: temporarily break one branch it depends on
  (e.g. drop the `onDisconnected` call from the `LiveKitRoom` mock, or skip
  updating the mocked camera state), confirm the new test fails, restore, and
  rerun green. This follows the same characterization-test method used in
  `docs/superpowers/specs/2026-08-12-integration-tests-design.md`.

## Follow-up

Update `TODO.md`: mark "End-to-end тест полного сценария звонка" as done,
with a short note on what was covered and where (mirroring the style of the
other closed items in that file).
