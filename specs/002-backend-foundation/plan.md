# Backend Foundation Implementation Plan

Status: implementation completed locally; product decisions are resolved. Local evidence
is recorded below. Real-provider/device validation remains outstanding;
this is not a deployment or release-readiness claim.

## Architecture and Dependencies

Use one pnpm workspace with frontend and backend packages. Keep the existing Expo 57
application and LiveKit client versions. Backend uses Node 24.19+, TypeScript 6,
node:http, node:crypto, node:sqlite DatabaseSync, and livekit-server-sdk 2.19.1 pinned
in the lockfile. No HTTP framework, ORM, Redis, account system, or shared package.
The installed Node v24.19.0 was checked to expose DatabaseSync.

One backend process with one persistent SQLite file is the initial deployment model.
It fits this small registration/authorization workload and supports atomic changes
and rate limits without another service. Do not run multiple backend replicas or
cluster workers against this design. Add a shared database/locking design before
horizontal scaling; record this limit as a shortcut comment at the room lock.

Backend source modules: server.ts (configuration and startup), http.ts (routing,
validation and errors), meetings.ts (operations and per-room ordering), store.ts
(schema/prepared SQL), credentials.ts (code encryption/capability hashing), livekit.ts
(SDK calls). Keep small direct functions; no repository/service class hierarchy.
Tests use node:test and node:assert/strict with temporary SQLite files and stubbed
LiveKit calls; frontend retains Jest and its existing Node geometry/plugin tests.

Use ESM and NodeNext TypeScript with strict checking, type-only imports, erasable TS,
relative .ts imports and rewriteRelativeImportExtensions for compiled output. Backend
scripts: dev via node --watch --env-file-if-exists=.env src/server.ts; type-check via
tsc --noEmit; build via tsc; start via node --env-file-if-exists=.env dist/server.js.
Run backend test files explicitly with node --test (list the small test set in the
package script rather than relying on platform-dependent shell glob expansion).

## Workspace and Existing Callers

- Move app/, screens/, components/, services/, constants/, types/, utils/, assets/,
  plugins/, tests if present, index.js, app.config.ts, metro.config.js, jest.setup.ts,
  frontend tsconfig, ESLint config and eas.json together into frontend/.
- Root retains specs/, .github/, patches/, pnpm-lock.yaml, pnpm-workspace.yaml,
  packageManager pnpm@11.21.0, existing overrides, patchedDependencies, hoisted linker,
  build approvals, audit settings and repository tooling. Declare packages frontend
  and backend; update lockfile importers without changing unrelated dependency pins.
- Give packages names @nk-meet/frontend and @nk-meet/backend. Existing root Expo/EAS
  commands forward to frontend. Root test continues frontend Jest; test:node runs
  existing frontend Node tests plus backend tests. Root lint/type-check cover both
  packages; format/check remain repository-wide and ignore generated output/data.
  Add backend dev/build root entry points. Existing CI .github/workflows/ci.yml keeps
  its root quality commands and adds backend build verification on Node 24.
- Keep frontend aliases local, make Metro resolve the hoisted workspace normally,
  and verify native plugin assets/extensions and EAS paths from frontend/. Preserve
  gitignored TODO, local .env and native work; relocate needed local app config
  without printing secrets, deleting ignored files, or checking them into git.
- Integration reaches HomeScreen, JoinScreen, services/livekitToken.ts, constants/env.ts,
  connection types, app/[company]/[slug].tsx, ActiveRoom and existing disconnect hooks.
  Audit all callers before changing token-only signatures. Device identity may remain
  for unrelated local behavior, but it no longer supplies a token identity.
- ReactionsProvider and useSharedMeetingStartedAt use setAttributes. Preserve
  canUpdateOwnMetadata and data publishing; attributes/metadata are never host proof.

## Persistent State and Credentials

SQLite uses WAL, foreign keys, prepared statements, a 5-second busy timeout and schema
version PRAGMA user_version. Startup applies the initial schema transactionally.
Tables are deliberately small:

- rooms: company, slug composite primary key; encrypted code bytes, 12-byte nonce,
  16-byte authentication tag; code_version integer starting at 1; created_at.
- host_access: SHA-256 capability hash primary key; company/slug foreign key;
  server-generated participant_identity unique; created_at. A row means a host
  authorization issued by this backend; there is no client-writable role column.
- rate_limits: scope/key primary key, window_started_at, attempts. Expired windows
  reset transactionally; opportunistically delete expired keys to bound storage.

Codes are strings of exactly eight ASCII digits, retaining leading zeros. HTTP accepts
only that canonical form; frontend strips the display hyphen before sending. Reject
extra keys, wrong types, too-long values and noncanonical room path segments. Company
and slug match [a-z0-9]+(?:-[a-z0-9]+)* with a 64-character maximum each; do not silently
normalize API paths into another room. Display names are trimmed, 1-80 characters.

Use node:crypto AES-256-GCM with fresh random nonce on every write and AAD containing
the company, slug and code version. HOST_CODE_ENCRYPTION_KEY is a required 32-byte
base64 server secret, separate from SQLite and the LiveKit secret. Decrypt only for
constant-time equal-length code comparison or authorized reveal. This recoverable
representation is required by reveal; a hash-only store cannot support it. Never
log plaintext, ciphertext-bearing request bodies, tokens or authorization headers.
Back up the database consistently and retain its key separately; losing the key means
codes cannot be recovered. Key rotation tooling is outside this increment.

All code verification, issuance, settings changes and reveal commit points for a room
share a per-room promise queue. Serialize async JWT signing against rotation inside
that queue, but never hold a SQLite transaction across a network await. After signing,
commit host_access before returning the token. On failure return no credential; release
locks in finally. Capability deletion uses the same room queue. Rotation is one SQLite
update of ciphertext and incremented version.
A token authorized before rotation may reach a client afterward; it is an already-issued
JWT, not authorization with the old code after rotation.

## HTTP Contract

Prefix room routes with /v1/rooms/:company/:slug, denoted R below. Responses are JSON
with Cache-Control: no-store. The backend registry is authoritative; no join or settings
operation inserts a missing room. LiveKit may instantiate transport rooms on first
connection only after this backend has issued a token for a registered room.

| Method and route        | Request                                                                | Success                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| POST /v1/rooms          | {hostCode}                                                             | 201 {company:"nkolosov",slug}; server chooses a 12-hex-character random slug, retries only a unique-key collision |
| GET R                   | none                                                                   | 200 {company,slug}; no code/version/host proof                                                                    |
| POST R/join             | {displayName,mode:"participant"} or {displayName,mode:"host",hostCode} | 200 {serverUrl,participantToken,participantIdentity,role,codeVersion?,hostAccess?}                                |
| POST R/settings/verify  | {hostCode}                                                             | 200 {codeVersion}; no meeting token or settings credential                                                        |
| PUT R/host-code         | {currentHostCode,newHostCode,expectedVersion}                          | 200 {codeVersion}; same code is a successful no-op, no version bump/event                                         |
| GET R/host-code/version | Authorization: Bearer hostAccess                                       | 200 {codeVersion}; no code                                                                                        |
| GET R/host-code         | Authorization: Bearer hostAccess                                       | 200 {hostCode,codeVersion}; only explicit reveal action                                                           |
| DELETE R/host-access    | Authorization: Bearer hostAccess                                       | 204; idempotently delete matching capability, including when participant is already gone                          |
| GET /healthz            | none                                                                   | 200 {ok:true}; 503 if storage unavailable                                                                         |

Creation accepts no client company/slug override. It has no account requirement, keeps
nkolosov as the current creation destination, and grants no company administration.
Return a route identity; frontend constructs the existing guest link without secrets.
On an ambiguous create network failure report retry honestly; do not auto-retry a
mutation or claim that an unconfirmed room was not created.

GET R runs when opening prejoin so old/deep/recent links immediately show Room not found.
All room operations return 404 {error:{code:"ROOM_NOT_FOUND",message:"Room not found"}}
for an unregistered room. Other stable errors: 400 INVALID_REQUEST; 401 INVALID_HOST_CODE
or INVALID_HOST_ACCESS; 409 CODE_CHANGED (stale expectedVersion) or HOST_NOT_ACTIVE;
429 RATE_LIMITED with Retry-After seconds; 503 SERVICE_UNAVAILABLE. Do not return raw
SDK errors, SQL, request contents or secrets. Network/SDK timeouts are 5 seconds;
client requests time out after 10 seconds and re-enable controls.

Settings verify merely opens the form. Retain the entered current code in component
memory while settings are open; PUT re-verifies it and expectedVersion under the room
queue. Clear on close, mode change or success. A boolean verification result never
authorizes a mutation. Two concurrent changes cannot both succeed from one version.

## Host Authority and LiveKit Lifecycle

Each manual join receives a fresh crypto.randomUUID identity; reject client identity
or role fields. Participant and host JWTs allow roomJoin, publish, subscribe, data,
and canUpdateOwnMetadata for existing media/reactions. Never grant roomAdmin,
roomCreate, roomList or recording rights to a client. Host is an application role,
not an unrestricted LiveKit administration token. Initial JWT TTL is 5 minutes.

Only successful code-authorized host join generates a separate 32-random-byte base64url
hostAccess credential and persists its hash bound to room and identity. Return it once,
keep it in frontend connection memory, and never put it in URLs, AsyncStorage, participant
metadata/attributes, events, recent-room records or analytics. No hostAccess for guests.
The response codeVersion is the notification baseline, not the host code.

For version/reveal requests, look up that capability for the targeted room, then use
RoomServiceClient.getParticipant(roomName, storedIdentity). Require the returned exact
identity and ACTIVE state. Never accept identity, role, metadata, SID or a reconnect flag
asserted by the client. Recheck capability existence under the room queue after the
network call so a concurrent explicit revoke cannot be bypassed. Capability + active
LiveKit presence is bearer authorization: theft of both applicable credentials remains
a credential-compromise risk, not a problem solved by client role flags.

Use the established room name company--slug. LIVEKIT_URL is the client wss URL; map
wss/https to https (ws/http to http only in development) for RoomServiceClient. LiveKit SDK automatic recovery, including
full reconnect and refreshed JWTs, owns reconnection. Keep hostAccess and role in memory
through recovery; do not add a session expiry or reconnect timeout. Transient absence,
non-ACTIVE state or remote ParticipantDisconnected only defers retrieval (409 or 503),
never deletes authority. Resume verification when the local room is connected again.

Explicit Leave, forced local exit, or final local Disconnected clears entry state and
sends one best-effort DELETE using the captured capability, without blocking exit on
network failure. DELETE checks possession/room only, not ACTIVE, so cleanup works after
leaving. Clear secrets locally even on failure. New manual Join always asks the current
code and obtains new identity/token/capability. The app must not reuse cached join tokens.

Successful DELETE immediately prevents further backend retrieval with that credential;
it does not revoke a LiveKit JWT. If the request never reaches the backend, the hashed
row may remain but cannot retrieve without the associated identity being ACTIVE. Do not
add cleanup timers that invalidate SDK recovery. Remove abandoned records only through
future controlled maintenance; document this storage limit. A leaked valid JWT can still
be accepted by LiveKit until expiry or provider revocation, including refreshed tokens;
rotation is not revocation and this increment adds no moderation/removal API.

## Guessing and Transport Controls

Persist counters in SQLite and check/increment atomically before comparing codes.
Settings verify, host join and code change share the same budgets: 20 attempts per
existing room per 15 minutes and 60 per source IP per 15 minutes, counting successes
as well as failures. Hitting either returns 429 until that window expires; denied
attempts do not extend it. Room limits cannot be evaded by changing IP or identity.
The finite room cooldown is an intentional availability tradeoff, shown through Retry-After.

Also limit creation to 5/hour/IP, guest join to 60/minute/IP and all API requests to
120/minute/IP. Expired counters may be pruned on writes; never reset on backend restart.
No persistent room-key buckets for nonexistent rooms, to avoid arbitrary-key growth.

node:http accepts JSON objects only, caps bodies at 4 KiB while streaming, rejects
unsupported content types/methods, malformed JSON and unknown routes, and catches async
errors once. Set headersTimeout 10s and requestTimeout 15s. No cookies; use bearer
headers. Allow web origins only from an exact configured allowlist; native requests
without Origin are supported. Allow only required methods/headers in CORS preflight.

Deployment binds backend to loopback behind an HTTPS reverse proxy on the same host.
The proxy must overwrite X-Real-IP; honor it only from loopback with TRUST_LOCAL_PROXY
explicitly enabled. Otherwise use socket.remoteAddress and ignore forwarding headers.
Normalize IPv4-mapped IPv6 addresses. Never infer rate-limit IP from arbitrary headers.
Local native development may bind a LAN address with proxy trust off. HTTPS is required
outside development. Configuration fails fast on missing or invalid secrets/URLs/keys.

## In-Room Notifications and Code Reveal

After a committed rotation, use RoomServiceClient.listParticipants and intersect ACTIVE
identities with nonrevoked host_access rows. sendData reliable on topic nk.host-code.changed
with explicit destinationIdentities and payload {codeVersion}; never send when that list
is empty (an empty destination list broadcasts). No code or capability enters LiveKit data,
metadata or attributes. Failure to notify does not roll back an already-committed code.

Frontend listens inside ActiveRoom and treats events only as a hint to fetch the protected
version endpoint. Ignore participant-originated messages; never trust an event version
as authorization or let an invented high version poison state. Reconcile on first
Connected, Reconnected, app foreground and every 30 seconds while connected host. This
small version poll covers lost notifications/backend send failure without an outbox or
another realtime transport. Suspend during recovery and cleanup on exit.

If the confirmed version exceeds the join/last-seen baseline, clear a displayed code
and show/update the in-room notification. Do not fetch the secret until Show new host
code is pressed. Its accessible label explains showing and copying. The button fetches
code+version, rejects responses older than a subsequently confirmed version, reveals
and copies the formatted code. A later rotation clears the display. No claim that a
clipboard can stay current after future rotations; do not overwrite it automatically.

Add expo-clipboard with the Expo 57-compatible version (~57.0.2) for native/web clipboard
support. Handle both false and rejected copy results: show the fetched code, a truthful
copy failure and retry-copy button. Web may require a fresh user gesture after async fetch;
the retry uses the displayed value without another await first, unless a newer version
has invalidated it. No polling/reconnect/event handler copies a code. Pending operations
have disabled actions, accessible status/error text and retry without duplicate submits.

## Frontend Behavior and Cutover

HomeScreen Create reveals one Host code input; eight digits with an inserted hyphen,
then Create registers and navigates only on success. Preserve default nkolosov even when
viewing another company. Reuse a small code-format/validation helper across create,
JoinScreen and settings, including paste/delete and leading zeros. No separate code
confirmation field or generator. Do not use recent-room storage for codes.

JoinScreen defaults to participant. Join as host reveals Host code beneath the name;
Join as participant preserves the name and clears/hides the code without joining.
Host Join validates and requests its token in the same operation. Settings uses the
entered current code to open the replacement-code form without entering the room.
Preserve media preview/device choices, loaders, disabled controls and error recovery.
Never place code/capability in route params to carry it between screens.

Replace sandbox token issuance with the backend client. EXPO_PUBLIC_BACKEND_URL replaces
EXPO_PUBLIC_LIVEKIT_SANDBOX_ID; use serverUrl from join response for the connected room.
Remove production sandbox calls and avoid retaining a silent fallback. Backend config:
LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, HOST_CODE_ENCRYPTION_KEY, DATABASE_PATH,
HOST (default 127.0.0.1), PORT (3000), WEB_ORIGINS and TRUST_LOCAL_PROXY (false). Provide
empty/example config only; never migrate real secrets into tracked files.

app/[company]/[slug].tsx currently clears token on onDisconnected and onError. Inspect
installed SDK callback semantics and ensure transient recovery does not route to prejoin;
final Disconnected does. Integrate capability cleanup with ActiveRoom and existing forced
exit hooks, not a second disconnect manager. Preserve ReactionsProvider's Reconnected
handling and existing media/screen-share behavior.

Production needs a persistent volume and retained encryption key, HTTPS, restricted
backend credentials and a LiveKit project whose sandbox issuance is disabled. Remove
or rotate the old sandbox signing path before calling cutover secure; a client-only
switch cannot close it. Older clients then require update, and old unregistered links
show Room not found. No implicit import or migration. Deployment, credential provisioning
and external project changes are not performed by this implementation plan.

## Verification and Completion Evidence

Local results recorded on 2026-10-10, re-confirmed on 2026-10-13 against the same
working tree (README env-var naming was the only drift, corrected on re-check):

- Full frontend Jest: 43 suites, 369 tests passed. One rerun under concurrent
  load (lint/type-check/build/format running in parallel) flaked a single
  deep-link navigation test; an isolated rerun and a second full clean run both
  passed 43/369. Treat as a timing-sensitive test under CPU contention, not a
  code regression; no fix applied since behavior is correct when not resource-starved.
- Frontend Node tests: 57 passed. Backend tests: 18 passed.
- Both workspace type checks, backend build and formatting check passed.
- Final root recursive lint passed after making the frontend resolver independent of working directory.
- Android and iOS Metro exports passed (2131/2004 modules); this verifies JavaScript bundles, not native builds or device behavior.
- Real LiveKit reconnect/notification checks, physical-device media/clipboard checks,
  deployment and production sandbox cutover have not been validated.

Blocked as of 2026-10-13: no `backend/.env` or `frontend/.env.local` is present in
this environment, so no LiveKit Cloud project credentials are configured; no
Android emulator/device is currently attached (`adb devices` empty); this is a
Windows host, so iOS device/simulator validation is unavailable here regardless
of credentials. Real-provider and device verification requires a LiveKit Cloud
project (or equivalent), a running Android target, and a macOS host for iOS —
none of which this session has. Provide LiveKit credentials and a reachable
Android target to unblock at least the Android half of this check.

Required verification scope:

- Preserve passing relocation checks before feature work: frozen-lockfile install, root
  format:check, lint, type-check, test, test:node; backend build; Expo config/bundle and
  native plugin fixture paths. Verify from root and independent workspace commands.
- Backend tests use temporary persisted DBs and injected clock/LiveKit calls: valid
  create and restart, malformed codes, unknown/old link 404 without writes, canonical
  paths, body limits, safe errors; host vs guest grants and unpredictable identities;
  wrong-room/revoked/fake capability and spoofed metadata denied; ACTIVE presence checks.
- Exercise concurrent authorization/signing versus rotation and two expectedVersion
  updates; old code cannot authorize after rotation; record-before-response failures
  do not leak credentials. Verify cipher tampering/wrong key fails closed and logs are clean.
- Test persisted room/IP budgets across join/verify/change and process restart, parallel
  guesses, source spoofing, cooldown expiry and Retry-After without permanent lockout.
- Test explicit revoke concurrent with reveal, final exit with unavailable backend,
  SDK recovery through changed SID/temporary absence and unchanged server identity,
  no revoke from remote ParticipantDisconnected, and fresh manual join after final exit.
- Test targeted sendData recipient selection (especially no active hosts), notification
  failure followed by version polling/catch-up, forged client hints, out-of-order versions,
  no auto-reveal/copy, clipboard failure/retry and accessible pending states.
- Frontend tests cover all three code inputs, name preservation, role mode switching,
  settings authorization changes, creation default nkolosov, Room not found, and no
  plaintext/capability persistence. Existing reactions/raised hand/time sharing still work.
- Before release, run a real LiveKit test with two hosts and a participant: rotate during
  an SDK full reconnect, confirm host retention and catch-up, deny participant reveal,
  Leave/manual Join rejects old code, and check Android/iOS/web clipboard and screen share.
  Mocked APIs alone do not prove provider reconnect/data-delivery behavior.

## Sources and Design Limits

- [Node 24.19 SQLite API](https://github.com/nodejs/node/blob/v24.19.0/doc/api/sqlite.md)
  supports the built-in synchronous database; verified locally as well.
- [LiveKit RoomServiceClient](https://docs.livekit.io/reference/server-sdk-js/classes/RoomServiceClient.html)
  provides participant lookup and server data sending;
  [SDK source](https://github.com/livekit/node-sdks/blob/main/packages/livekit-server-sdk/src/RoomServiceClient.ts)
  defines destinationIdentities. Verify the pinned SDK types during implementation.
- [LiveKit grants and token lifecycle](https://docs.livekit.io/frontends/reference/tokens-grants/)
  describes metadata permissions, refresh and the limits of initial token expiration.
- [LiveKit reconnect](https://docs.livekit.io/intro/basics/connect/#network-changes-and-reconnection)
  owns automatic recovery, including full reconnect.
- [Expo Clipboard](https://docs.expo.dev/versions/latest/sdk/clipboard/)
  supplies native/web support and documents asynchronous WebKit restrictions.

The design intentionally stays single-process, retains inert failed-cleanup capability
hashes, and accepts bounded code-guessing cooldowns. It does not promise JWT revocation,
exactly-once notifications, or production readiness without real-provider/device checks.
