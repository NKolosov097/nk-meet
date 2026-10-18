# Backend tasks

Derived from the approved backend foundation plan; frontend and workspace tasks are tracked separately.

- [x] B01 Create the Node 24 ESM backend package, configuration, startup and explicit test scripts.
- [x] B02 Add versioned persistent SQLite rooms, protected codes, capability hashes and rate counters.
- [x] B03 Implement canonical JSON HTTP routes, bounded bodies, safe errors, CORS and trusted source handling.
- [x] B04 Implement registration, guest/host entry, verification and atomic code rotation under room ordering.
- [x] B05 Implement scoped active-host reveal/version, revocation and targeted code-free notifications.
- [x] B06 Verify persistence, grants, tampering, concurrency, limits, transport and service failures with stubbed LiveKit.
- [x] B07 Run backend type-check, lint, format, build and tests; record provider/deployment limits.

## Verification

Backend test script passes 18 Node tests. Backend type-check (including tests), lint,
build and scoped Prettier check pass. Tests include real SDK JWT signature/grant/expiry
checks and intercepted SDK requests; active presence/recovery/concurrency and failed
notifications are exercised with injected provider calls and temporary persisted SQLite.

Real LiveKit reconnect/data delivery, deployment/secret provisioning, sandbox cutover
and device clipboard/media checks remain release work described in the approved plan.
