# Meeting backend

Requires Node 24.19+. Copy `.env.example` to `.env`, provision LiveKit server credentials
and a separate 32-byte base64 encryption key, then run `pnpm --dir backend dev` from
the repository root. Production runs `build`, then `start` from this package.
The example contains no signing secrets or generated host code.

Run one backend process with a persistent SQLite file and retain the encryption key
separately from consistent database backups. Losing the key makes codes unrecoverable.
Production binds to loopback behind an HTTPS reverse proxy. Enable `TRUST_LOCAL_PROXY`
only when that same-host proxy overwrites `X-Real-IP`; web origins are exact allowlisted
origins. Native requests need no Origin header.

Host verification, joining and code changes share 20 attempts per room and 60 per
source per 15 minutes, including successes. Creation allows 5/hour/source, guest entry
60/minute/source and the API 120/minute/source. `429` returns `Retry-After` in seconds.
Counters and code versions survive restart; denied requests do not extend cooldowns.

Capabilities authorize retrieval only while the stored identity is ACTIVE in LiveKit.
Transient absence preserves recovery authority. Explicit revocation prevents retrieval
and leaves issued LiveKit JWTs unchanged. Abandoned capability hashes remain stored
until future controlled maintenance; no expiry timer interrupts SDK recovery.
Code rotation similarly does not revoke JWTs or guarantee notification delivery.

Deployment, external credential/sandbox cutover, key rotation tooling and real LiveKit
reconnect/device checks are outside these local checks. Disable or rotate old sandbox
issuance before production cutover. Do not add workers or replicas without shared room
locking and database design.
