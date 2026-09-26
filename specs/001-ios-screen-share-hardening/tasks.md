# iOS Screen Share Hardening Tasks

- [x] Add focused failing tests for safe host close and run them red.
- [x] Generate/register the minimal pnpm patch for the pinned WebRTC host socket and run the focused test green.
- [x] Add failing native-source contract tests for timeout origin, ReplayKit attachment API, and sample lifetime/queue behavior; run them red.
- [x] Implement the minimal Objective-C corrections and run those tests green.
- [x] Add failing plugin behavior tests for EAS extension declaration, preservation, and idempotency; run them red.
- [x] Merge the extension declaration into evaluated config and run the plugin tests green.
- [x] Pass frozen offline install without a trust override.
- [x] Run the complete verification suite.
- [x] Review the implementation against every requirement and record device-only gaps without claiming device validation.

## Traceability

| Requirement                      | Owning task/tests                     |
| -------------------------------- | ------------------------------------- |
| Safe cancel before connection    | WebRTC patch test and patch task      |
| Deadline begins after `starting` | Broadcast picker source-contract test |
| ReplayKit orientation            | Sample uploader source-contract test  |
| Bounded lifetime/queue           | Sample uploader source-contract test  |
| EAS extension discovery          | Config plugin behavior tests          |
| Existing behavior preserved      | Full Jest/Node/type/lint/format gates |
