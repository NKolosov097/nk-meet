# Backend Foundation Specification

Status: agreed and implemented locally. Automated checks and Android/iOS Metro exports
passed; real-provider and device validation remains outstanding. No deployment is claimed.

## Purpose and Original Behavior

Provide server-controlled meeting entry and host authorization, replacing sandbox
issuance in production. Before this change, the client generated room slugs, used a
local device identity and requested sandbox tokens without server meeting registration.
Sandbox is documented as development/test-only.

## User Scenarios

1. A creator enters an eight-digit host code and registers a meeting in the default
   company nkolosov. Successful registration returns the guest link.
2. A guest opens the link, enters a display name, and joins as a participant.
3. An organizer selects `Join as host`, enters the room code, and receives host access
   only after server authorization and token issuance succeed.
4. On the join page, verification of the current host code opens settings without
   joining the meeting. Settings initially allow only changing that code; theme is deferred.

## Requirements

- A meeting must first be created with a valid host code. Unknown or old unregistered
  links display `Room not found`; joining never creates or claims a room.
- The server registers meetings without overwriting existing rooms. Records distinguish
  company and slug and persist across restarts, including current host-code state.
- The organizer enters the room-specific host code when creating the meeting and when
  changing its code. Both require exactly eight decimal digits, displayed as `0000-1111`;
  this is a format example, never a default. The backend does not generate either code.
- Creation retains the current default company `nkolosov`. This does not establish
  administrator rights or permission to create meetings under other companies.
- Creation cannot complete without a valid code; the backend validates it before
  registering the room. Code changes also validate the replacement before committing.
- Possession of the current room code proves host authority. Display name, client role,
  device identity, and company URL cannot establish authority or impersonate a participant.
- Host-code validation and host-token issuance are one server-authorized operation;
  a separate successful precheck or client boolean cannot authorize token issuance.
- The server validates code format and limits attempts per room and request source
  within finite windows/cooldowns, with a defined retry response. Verification, host
  joining, and code-changing paths must not allow bypassing these shared limits.
- Prejoin verification grants access to code settings but issues no meeting token.
  Changing a code independently requires server-verified authority for that room:
  either recheck the current code or use short-lived, room-scoped authority bound to
  the current code version. Merely opening settings never authorizes a later mutation.
- Rotation is atomic with entry authorization. Once rotation commits, the old code
  cannot authorize future joins or further settings changes. The new code persists.
  Multiple hosts are supported. Already-active hosts remain connected and retain their
  role after another host rotates the code; this active authority is not invalidated
  with prejoin settings grants. New manual host entry requires the current code.
- LiveKit automatic recovery, including full reconnect, preserves the host role without
  asking for the code. Use SDK recovery and token refresh; do not add a custom reconnect
  timeout or session system. An intermediate remote `ParticipantDisconnected` event does
  not terminate host authorization: full reconnect can emit it.
- Explicit Leave or final local room `Disconnected` ends the current app entry flow.
  The next manual host Join must obtain a fresh token through backend verification of
  the current room code; the app must not reuse a cached join token for that new Join.
- Rotation does not revoke issued LiveKit tokens. A previously issued or leaked valid
  token can still be accepted by LiveKit until expiry or revocation. Requiring a new code
  on manual Join is an application/backend issuance rule, not a claim of JWT revocation.
- After rotation, all already-joined hosts receive an in-room notification that the code
  changed, without the code itself. This is an in-room event, not device push.
- Retrieving the latest code requires server verification of an active host session
  scoped to that room. Participants cannot retrieve it through the API or receive it
  in events; a client-declared role or old code is insufficient. While recovering,
  code retrieval is unavailable until the server can verify the restored active host.
  This temporarily defers retrieval without removing the role or asking for the code.
- After recovery, synchronize the room code version using server-verified host authority.
  If it changed while offline, clear any displayed old code and show/update the code-free
  notification. Version catch-up must not fetch, reveal, or copy the secret automatically.
- Signing secrets remain server-side. Host codes and access tokens never appear in
  logs, analytics, or guest links. Host codes are never returned to participants.
  The creator knows the entered initial code; registration need not return it.
  Meeting tokens are returned only to their
  authorized recipient. Stored code material must be protected from direct disclosure.
- Meeting tokens are room-scoped, bounded in lifetime, and carry only authorized rights.
- Invalid requests and service failures yield accessible, retryable errors. Authorization
  failure never silently downgrades to participant or falls back to sandbox issuance.
- Production cutover closes alternative issuance paths that bypass authorization.
- Existing media controls, reactions, and screen sharing remain usable.

## Creation, Join, and Settings Experience

- Creation and code-change forms accept the organizer-entered eight digits, insert
  the hyphen after four digits, and block submission until complete. The server enforces
  the same validation even when frontend checks are bypassed.
- `Join as host` reveals `Host code` below the display name. The frontend inserts a
  hyphen after four digits and requires all eight digits before enabling host Join,
  alongside existing name requirements. The backend enforces the same format rules.
- During Join authorization/token issuance, Join shows a loader; inputs and mode
  switches are disabled. A rejection or service failure restores usable controls.
- `Join as participant` appears below the code field and switches back to guest mode.
- Participant mode is the default; switching
  back preserves the name, hides and clears the code, and does not immediately join.
- Settings are on the join page and open after verification of the current host code.
  The Settings action verifies the entered code; normal Join needs no separate Verify
  action. During settings verification and changes, show a loader and disable inputs
  and actions; on failure show an accessible error and restore controls for retry.
- The in-room notification offers `Show new host code`. Only pressing it fetches the
  current code, reveals it, and copies it; receiving the notification does none of these.
  Its accessible name explains both showing and copying.
  Fetch the current value from the server rather than storing a code in the event, so
  clicking an older notification retrieves the code current when the server answers.
  A subsequent rotation event clears any displayed old code and updates the notification;
  responses older than an already-observed rotation must not reveal or copy a stale code.
- During retrieval disable the action and show a loader; failures allow an accessible
  retry. If clipboard copying fails, keep the fetched code visible, report the failure
  honestly, and offer retry copying without claiming success.

## Acceptance Criteria

- Creation in the default company nkolosov succeeds with the organizer-entered code
  and returns a guest link. Missing or malformed codes prevent creation server-side.
  Code changes similarly reject invalid replacements. Neither flow generates a code.
  Guests join without receiving or supplying the code.
- Missing, malformed, and incorrect codes cannot obtain host access. Check the code
  against the targeted room and scope all resulting grants to it; forged
  role, identity, company, or precheck results cannot bypass server authorization.
- The host form formats eight digits, blocks incomplete input, displays pending state,
  and recovers after rejection. Participant switching follows the behavior above.
- Settings verification alone neither joins nor issues a meeting token. Unauthorized
  changes fail, including changes using stale authority after code rotation.
- Rotation survives restart, rejects the old code for future authorizations, and accepts
  the new code. Concurrent rotation and authorization have a tested ordering.
- Automatic recovery, including full reconnect after rotation, restores the host role
  without code entry. Intermediate remote disconnect events do not revoke authority.
- During recovery, retrieval waits for server-verifiable active-host status. On recovery,
  missed rotations produce a version-based notification without automatic code disclosure.
- After explicit Leave or final local Disconnected, manual host Join checks the current
  code via backend and never reuses the previous join token. Tests do not assert that
  rotation invalidates a JWT already accepted under the LiveKit token lifecycle.
- With multiple active hosts, rotation preserves their connection and host role; all
  receive a code-free in-room notification. Participants receive no code through any path.
- Before pressing `Show new host code`, no code is fetched, revealed, or copied by the
  notification flow. After two rotations, pressing an earlier notification retrieves
  the code current at response time using a server-verified active host session. Further
  events clear an older displayed code; a stale in-flight response cannot reveal/copy it.
- Participant, other-room, and inactive-session retrieval requests fail. Retrieval
  failure and clipboard denial have accessible retry states; clipboard denial leaves
  the code visible and never reports a successful copy.
- Repeated guesses across verification/join/change paths hit documented finite limits;
  changing client identity does not reset room limits. Retry behavior is tested.
- Tokens cannot authorize other rooms; expired tokens cannot establish new sessions.
- Unknown and legacy unregistered rooms return `Room not found` without creating a
  record or issuing a token. Backend outages remain distinguishable and retryable.
- Signing secrets and host codes are absent from guest-facing artifacts; no credentials
  appear in logs. A participant receives only their own authorized meeting token.
- Existing client checks pass; native behavior is verified on devices before release claims.

## Decision Status

No product questions remain for this increment. Creation is under nkolosov, the
organizer supplies both initial and replacement codes, and unregistered links fail.
Technical defaults and verification requirements are specified in plan.md.

## Scope Boundary

This increment covers registration, host/participant entry, prejoin host-code settings,
and in-room host notifications with authorized code retrieval.
Moderation (mute/remove) and waiting room follow separately. Before moderation, decide
whether removal disconnects or bans re-entry and which identity supports that policy.
Chat, device push (APNs/FCM), account administration, themes, and camera effects are outside this increment.
