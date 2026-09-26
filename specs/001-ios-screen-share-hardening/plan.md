# iOS Screen Share Hardening Plan

## Root-Cause Analysis

| Finding                    | Root cause                                                                                                                                                                                                                                                                | Evidence                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Cancel can block or race   | The pinned host closes from another queue while the listener may be between `accept` and network-thread startup; a thread-only guard still permits resources to open after close, and closing the descriptor before source cancellation completes risks descriptor reuse. | Local `node_modules/@livekit/react-native-webrtc/.../SocketConnection.m`; listener and close use different queues.       |
| Orientation falls back     | `RPVideoSampleOrientationKey` is a buffer-level attachment, but the uploader searches the per-sample attachment dictionary.                                                                                                                                               | Apple distinguishes `CMGetAttachment` from `CMSampleBufferGetSampleAttachmentsArray`.                                    |
| Timeout starts too early   | The timer is scheduled immediately after opening the picker, before the extension posts `starting`.                                                                                                                                                                       | `BroadcastPicker.m` starts the ten-second timer beside the picker button action.                                         |
| Frame queue can grow       | Every callback retains its full sample before asynchronous readiness/rate checks. ReplayKit says the sample is valid only for the callback duration.                                                                                                                      | `SampleUploader.m` retains then enqueues; Apple documents sequential callbacks and forbids keeping the sample afterward. |
| EAS cannot pre-sign target | The config plugin creates an Xcode target but never adds prebuild-time app-extension metadata to evaluated Expo config.                                                                                                                                                   | Expo CNG app-extension requirements and current plugin output.                                                           |

## Implementation

1. Add a pnpm patch for `@livekit/react-native-webrtc@144.1.2` that serializes listener acceptance and close on one private lifecycle queue. Close marks the connection closed before canceling; a pending handler checks that flag; accepted streams are cleaned only after the handler has completed; and the dispatch-source cancel handler exclusively closes the server descriptor and signals completion before `close` returns.
2. Start `BroadcastPicker`'s ten-second transport timeout only on the first request-scoped `starting` notification.
3. Read ReplayKit orientation with `CMGetAttachment`.
4. Process an accepted sample synchronously on the uploader's serial queue so no sample survives the ReplayKit callback and excess frames are dropped by existing ready/FPS gates instead of queued.
5. Make `withIosBroadcastExtension` merge an idempotent `BroadcastExtension` declaration into `extra.eas.build.experimental.ios.appExtensions`, preserving unrelated configuration.
6. Keep source-contract tests only where Objective-C cannot execute on Windows; use real plugin execution for EAS configuration tests.

## Constraints

- No new runtime dependency or abstraction.
- Keep the existing ten-second deadline and physical calibration constants.
- Do not edit installed `node_modules` as the durable fix; generate and register a pnpm patch.
- Follow repository commit identity, message, and artifact rules.

## Verification

- Focused red/green Node tests for native-source contracts and evaluated plugin configuration.
- Focused Jest tests only if TypeScript behavior changes.
- `pnpm install --offline --frozen-lockfile`
- `pnpm test`
- `pnpm test:node`
- `pnpm type-check`
- `pnpm lint`
- `pnpm format:check`
- Final diff review against `origin/main` and Astra convergence review.

## Remaining Device Checks

- iOS cancel before connect, followed by camera/microphone toggle and retry.
- Delayed picker acceptance, landscape content, stop/restart, call disconnect during startup.
- Sustained sharing memory/thermal behavior and VoiceOver over dynamic content.
