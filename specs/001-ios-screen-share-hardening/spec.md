# iOS Screen Share Hardening Specification

## Purpose

Make participant screen sharing safe to ship on iOS without changing the existing Android or room-control behavior.

## User Scenarios

### Cancel before the broadcast starts

When a participant opens the ReplayKit picker and cancels before the broadcast extension connects, the pending operation ends promptly. Camera, microphone, disconnect, and a later screen-share retry remain usable.

### Delayed acceptance

When a participant takes time to read and accept the system picker, that decision time does not consume the transport connection deadline. Once the extension starts, failure to establish transport is still reported within the existing ten-second deadline.

### Rotated device content

When ReplayKit supplies landscape or rotated content, the published frame carries ReplayKit's orientation metadata instead of silently falling back to upright portrait.

### Sustained sharing

When frames arrive faster than they can be encoded or written, the extension does not retain an unbounded number of full-resolution sample buffers and does not use a sample buffer after ReplayKit's callback returns.

### Cloud iOS build

When EAS evaluates the managed Expo configuration, it can discover the broadcast extension target, bundle identifier, and App Group entitlement before native project generation so signing credentials can be prepared.

## Requirements

- Preserve the current UI, accessibility semantics, reactions integration, Android screen sharing, and publish-only-after-ready behavior.
- Cancellation before transport connection must not synchronously schedule cleanup on an unstarted native network thread.
- The transport deadline must begin only after the broadcast extension reports that it started.
- Orientation must be read from the ReplayKit sample-buffer attachment identified by `RPVideoSampleOrientationKey`.
- A ReplayKit sample buffer must not be retained beyond `processSampleBuffer:withType:` returning.
- EAS extension metadata must be produced idempotently without deleting unrelated `extra` configuration or other extension declarations.
- The pinned LiveKit/WebRTC versions must remain unchanged; any dependency correction must use the repository's existing pnpm patch mechanism.
- Automated tests must demonstrate red-before-green for every behavior that can run on Windows. Native-only behavior must have the smallest source/config contract test plus an explicit physical-device validation gap.

## Success Criteria

- All new focused tests pass after having failed against the pre-fix tree.
- Jest, Node tests, type-check, lint, formatting, and frozen offline installation pass.
- No generated `ios/` or `android/` directory is committed.
- The final review finds no Critical or Important code-level issue from the five audited findings.

## Out of Scope

- Redesigning the screen-share protocol.
- Changing frame quality, maximum dimension, or frame-rate calibration values.
- Upgrading Expo, LiveKit, React Native, or WebRTC dependencies.
- Claiming physical-device behavior without an actual device run.
