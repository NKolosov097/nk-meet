# Frontend implementation tasks

- [x] Replace sandbox issuance with timeout-bound backend API and validate response shapes.
- [x] Share canonical code formatting across creation, host entry and replacement settings.
- [x] Register new rooms under server-selected nkolosov; keep secrets out of routes/storage.
- [x] Look up prejoin rooms; show unknown room and retry service errors.
- [x] Default participant entry; host field, mode switch, name preservation and pending controls.
- [x] Verify settings without joining; rotation rechecks current code and expected version.
- [x] Keep backend URL/token/host capability in connection memory; SDK owns recovery.
- [x] Revoke once on final/forced exit; use fresh authorization on every manual join.
- [x] Host-only targeted event hints, protected version reconciliation, reconnect/foreground/poll.
- [x] Explicit reveal/copy, stale response protection, clipboard failure retry.
- [x] Update existing changed-contract fixtures and add focused form/lifecycle/notification regressions.
- [x] Run frontend type-check/lint and meaningful Jest checks; report baseline failures separately.
- [ ] Real-provider Android/iOS/web reconnect, clipboard and media verification before release.

Evidence: full frontend Jest passed 43 suites / 369 tests; type-check and root recursive lint passed. Android/iOS Metro exports passed. Real-provider/device verification remains open.
