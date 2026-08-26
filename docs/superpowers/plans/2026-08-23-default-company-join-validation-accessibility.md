# Default Company, Join Validation, and WCAG AA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Default the app to NKolosov, prevent nameless joins, and enforce WCAG 2.2 AA contrast and semantics across every visual component.

**Architecture:** Centralize default-company identity and semantic colors, add a pure contrast calculator plus repository-wide contracts, then migrate each screen/component to tested semantic tokens and accessibility states. Keep route identities canonical lowercase, keep visual component tests colocated with their owners, and use an opaque participant badge so video frames cannot change contrast.

**Tech Stack:** Expo 57, React Native 0.86, TypeScript 6, Expo Router, Jest 29, React Native Testing Library 14.

**Spec:** `docs/superpowers/specs/2026-08-23-default-company-join-validation-accessibility-design.md`

## Global Constraints

- Display the default company as `NKolosov`; store and route it as `nkolosov`.
- Preserve canonical deep links and existing recent-room company identities.
- WCAG 2.2 AA thresholds are 4.5:1 for normal text/placeholders and 3:1 for large text and meaningful non-text UI.
- Disabled controls must be programmatically disabled and expose disabled accessibility state.
- Runtime UI colors must come from `constants/colors.ts`.
- Every changed visual component needs contrast and accessibility-semantics coverage.
- Follow `CLAUDE.md`: `VoidFunction`, comments on interface fields, short comments, named imports, and `try/catch` around every `await`.

---

### Task 1: Default company identity and root routing

**Files:**
- Create: `constants/company.ts`
- Modify: `app/index.tsx`
- Modify: `app/index.test.tsx`
- Modify: `screens/HomeScreen.tsx`
- Modify: `screens/HomeScreen.test.tsx`

**Interfaces:**
- Produces: `DEFAULT_COMPANY_ID: "nkolosov"` and `companyDisplayName(company: string): string`.
- Consumes: Expo Router `Redirect`; `HomeScreen.company` remains canonical lowercase.

- [x] **Step 1: Write failing route and display tests**

```tsx
test("redirects the root route to the default company", async () => {
  await render(<RootScreen />)
  expect(screen.getByTestId("root-redirect")).toHaveProp("href", "/nkolosov")
})

test("displays the branded default company name", async () => {
  await render(<HomeScreen company="nkolosov" />)
  expect(screen.getByText("NKolosov")).toBeVisible()
})
```

- [x] **Step 2: Run the focused tests and verify RED**

Run: `pnpm.cmd test -- app/index.test.tsx screens/HomeScreen.test.tsx`

Expected: FAIL because root renders fallback copy and Home renders the canonical ID.

- [x] **Step 3: Add the identity boundary and redirect**

```ts
export const DEFAULT_COMPANY_ID = "nkolosov"

export const companyDisplayName = (company: string): string =>
  company === DEFAULT_COMPANY_ID ? "NKolosov" : company
```

Render `<Redirect testID="root-redirect" href={`/${DEFAULT_COMPANY_ID}`} />` at `/`, and call `companyDisplayName(item.company)` wherever a company is displayed. Do not rewrite stored recent rooms.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm.cmd test -- app/index.test.tsx screens/HomeScreen.test.tsx app/routing.integration.test.tsx app/deepLink.integration.test.tsx`

Expected: PASS, including non-default deep links.

- [x] **Step 5: Commit**

```powershell
git add constants/company.ts app/index.tsx app/index.test.tsx screens/HomeScreen.tsx screens/HomeScreen.test.tsx
git commit -m "feat: default root route to nkolosov"
```

### Task 2: Disable Join until a name exists

**Files:**
- Modify: `screens/JoinScreen.tsx`
- Modify: `screens/JoinScreen.test.tsx`

**Interfaces:**
- Consumes: controlled `name: string` state.
- Produces: `isJoinDisabled: boolean`; media controls keep their existing initialization/config disabled behavior.

- [x] **Step 1: Write failing empty-name behavior tests**

```tsx
test("keeps Join disabled until a non-whitespace name is entered", async () => {
  await render(<JoinScreen roomSlug="room-a" onJoined={jest.fn()} />)
  expect(screen.getByLabelText("Join room")).toBeDisabled()
  await fireEvent.changeText(screen.getByLabelText("Participant name"), "  Ada  ")
  expect(screen.getByLabelText("Join room")).toBeEnabled()
  await fireEvent.changeText(screen.getByLabelText("Participant name"), "   ")
  expect(screen.getByLabelText("Join room")).toBeDisabled()
})

test("does not request a token or show an error for an empty submit", async () => {
  await fireEvent(screen.getByLabelText("Participant name"), "submitEditing")
  expect(mockFetchParticipantToken).not.toHaveBeenCalled()
  expect(screen.queryByText("Please enter your name")).toBeNull()
})
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `pnpm.cmd test -- screens/JoinScreen.test.tsx`

Expected: FAIL because Join is currently enabled after initialization with an empty name.

- [x] **Step 3: Separate form and media disabled states**

```ts
const areMediaControlsDisabled =
  isLoading || !initializationComplete || configError !== null
const isJoinDisabled = areMediaControlsDisabled || name.trim() === ""
```

Use `areMediaControlsDisabled` for input/media controls and `isJoinDisabled` for Join. Replace the empty-name error assignment in `join()` with an early return.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm.cmd test -- screens/JoinScreen.test.tsx`

Expected: PASS; valid saved names still restore and enable Join.

- [x] **Step 5: Commit**

```powershell
git add screens/JoinScreen.tsx screens/JoinScreen.test.tsx
git commit -m "fix: require participant name before joining"
```

### Task 3: Contrast calculator and semantic palette contract

**Files:**
- Create: `utils/accessibility/contrast.ts`
- Create: `utils/accessibility/contrast.test.ts`
- Modify: `constants/colors.ts`
- Create: `constants/colors.test.ts`

**Interfaces:**
- Produces: `contrastRatio(foreground: string, background: string): number` and `compositeColor(foreground: string, background: string): string`.
- Produces semantic tokens with exact values: primary `#0062CC`, danger action `#D72C21`, placeholder-on-light `#767676`, pagination icon `#8CC8FF`, participant badge `#333333`, participant status danger `#FF6B63`.

- [x] **Step 1: Write failing calculator and palette tests**

```ts
expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 2)
expect(contrastRatio("#767676", "#FFFFFF")).toBeGreaterThanOrEqual(4.5)
expect(contrastRatio("#FFFFFF", "#0062CC")).toBeGreaterThanOrEqual(4.5)
expect(contrastRatio("#FFFFFF", "#D72C21")).toBeGreaterThanOrEqual(4.5)
expect(contrastRatio("#8CC8FF", "#4A4A4A")).toBeGreaterThanOrEqual(3)
expect(contrastRatio("#FF6B63", "#333333")).toBeGreaterThanOrEqual(3)
expect(contrastRatio(TEXT_COLORS.disabled, BACKGROUND_COLORS.disabled)).toBeGreaterThanOrEqual(4.5)
```

- [x] **Step 2: Run tests and verify RED**

Run: `pnpm.cmd test -- utils/accessibility/contrast.test.ts constants/colors.test.ts`

Expected: FAIL because the utility and semantic tokens do not exist.

- [x] **Step 3: Implement strict color parsing, alpha composition, luminance, and semantic tokens**

Support `#RRGGBB` and `rgba(r, g, b, a)`. Reject unsupported formats with a descriptive error. Calculate WCAG sRGB linearization using the `0.04045` threshold and `(channel + 0.055) / 1.055` exponent `2.4`.

Expose tokens by semantic purpose, including `TEXT_COLORS.onPrimary`, `onDanger`, `placeholderOnLight`, `paginationIcon`, `participantStatusDanger`, and `BACKGROUND_COLORS.participantBadge`. Keep aliases only where existing call sites still need migration within this plan.

- [x] **Step 4: Run tests and verify GREEN**

Run: `pnpm.cmd test -- utils/accessibility/contrast.test.ts constants/colors.test.ts`

Expected: PASS with ratios at or above their thresholds.

- [x] **Step 5: Commit**

```powershell
git add utils/accessibility/contrast.ts utils/accessibility/contrast.test.ts constants/colors.ts constants/colors.test.ts
git commit -m "test: enforce semantic color contrast"
```

### Task 4: Home and Join screen accessibility contracts

**Files:**
- Modify: `screens/HomeScreen.tsx`
- Modify: `screens/HomeScreen.test.tsx`
- Modify: `screens/JoinScreen.tsx`
- Modify: `screens/JoinScreen.test.tsx`
- Modify: `app/index.tsx`
- Modify: `app/index.test.tsx`

**Interfaces:**
- Consumes: semantic action and placeholder tokens from Task 3.
- Produces: button/header roles and AA-compliant primary actions/placeholders.

- [x] **Step 1: Add failing state-matrix assertions**

Assert Home Join/Create, JoinScreen Join, both placeholders, Back, settings, recent-room actions, and visual headings. Each actionable element must have `accessibilityRole="button"`; headings must have `accessibilityRole="header"`; disabled Join must expose `accessibilityState.disabled`.

```tsx
expect(screen.getByLabelText("Join room")).toHaveAccessibilityValue(undefined)
expect(screen.getByLabelText("Join room")).toHaveProp("accessibilityRole", "button")
expect(screen.getByText("NK Meet")).toHaveProp("accessibilityRole", "header")
expect(screen.getByPlaceholderText("Enter your name")).toHaveProp(
  "placeholderTextColor",
  TEXT_COLORS.placeholderOnLight,
)
```

- [x] **Step 2: Run tests and verify RED**

Run: `pnpm.cmd test -- app/index.test.tsx screens/HomeScreen.test.tsx screens/JoinScreen.test.tsx`

Expected: FAIL on roles and old primary/placeholder tokens.

- [x] **Step 3: Migrate styles and semantics**

Use `BACKGROUND_COLORS.primary`, `TEXT_COLORS.onPrimary`, and `TEXT_COLORS.placeholderOnLight`. Add explicit button/header roles without changing labels or navigation behavior.

- [x] **Step 4: Run tests and verify GREEN**

Run: `pnpm.cmd test -- app/index.test.tsx screens/HomeScreen.test.tsx screens/JoinScreen.test.tsx`

Expected: PASS for default, enabled, disabled, error, and recent-room states.

- [x] **Step 5: Commit**

```powershell
git add app/index.tsx app/index.test.tsx screens/HomeScreen.tsx screens/HomeScreen.test.tsx screens/JoinScreen.tsx screens/JoinScreen.test.tsx
git commit -m "fix: meet AA on landing and join screens"
```

### Task 5: Room controls, dropdown, pagination, and modal contracts

**Files:**
- Modify: `components/room/ControlBar.tsx`
- Modify: `components/room/ControlBar.integration.test.tsx`
- Modify: `components/room/controls/MediaDeviceButton.tsx`
- Modify: `components/room/controls/MediaDeviceButton.test.tsx`
- Modify: `components/room/controls/DeviceDropdown.tsx`
- Create: `components/room/controls/DeviceDropdown.test.tsx`
- Modify: `components/room/grid/PaginationBar.tsx`
- Modify: `components/room/grid/PaginationBar.test.tsx`
- Modify: `components/room/ConfirmDisconnectModal.tsx`
- Modify: `components/room/ConfirmDisconnectModal.test.tsx`

**Interfaces:**
- Consumes: `onPrimary`, `onDanger`, `paginationIcon`, and meaningful-divider tokens.
- Produces: buttons with roles; disclosure controls report `expanded`; selected device rows and destructive action meet 4.5:1; enabled pagination icons meet 3:1.

- [x] **Step 1: Write failing component contracts**

For every enabled/disabled/open/closed/selected state, assert role, label, state, and semantic style. Include:

```tsx
expect(screen.getByLabelText("Select camera")).toHaveAccessibilityState({
  expanded: true,
})
expect(screen.getByLabelText("Camera 1 device")).toHaveAccessibilityState({
  selected: true,
})
expect(screen.getByLabelText("Previous page")).toHaveProp("accessibilityRole", "button")
expect(screen.getByLabelText("Confirm disconnect")).toHaveStyle({
  backgroundColor: BACKGROUND_COLORS.danger,
})
```

- [x] **Step 2: Run focused tests and verify RED**

Run: `pnpm.cmd test -- components/room/ControlBar.integration.test.tsx components/room/controls/MediaDeviceButton.test.tsx components/room/controls/DeviceDropdown.test.tsx components/room/grid/PaginationBar.test.tsx components/room/ConfirmDisconnectModal.test.tsx`

Expected: FAIL on missing roles/expanded state and old colors.

- [x] **Step 3: Migrate control semantics and colors**

Add `accessibilityRole="button"` to actions, replace disclosure `selected` with `expanded`, retain selected state only for device rows, use `TEXT_COLORS.onPrimary`/`onDanger`, and use `TEXT_COLORS.paginationIcon` for enabled chevrons. Disabled chevrons may use opacity only while the button is programmatically disabled.

- [x] **Step 4: Run focused tests and verify GREEN**

Run the Task 5 command again. Expected: PASS for all state matrices and existing interaction tests.

- [x] **Step 5: Commit**

```powershell
git add components/room/ControlBar.tsx components/room/ControlBar.integration.test.tsx components/room/controls/MediaDeviceButton.tsx components/room/controls/MediaDeviceButton.test.tsx components/room/controls/DeviceDropdown.tsx components/room/controls/DeviceDropdown.test.tsx components/room/grid/PaginationBar.tsx components/room/grid/PaginationBar.test.tsx components/room/ConfirmDisconnectModal.tsx components/room/ConfirmDisconnectModal.test.tsx
git commit -m "fix: expose accessible room control states"
```

### Task 6: Deterministic ParticipantTile contrast

**Files:**
- Modify: `components/participant/ParticipantTile.tsx`
- Create: `components/participant/ParticipantTile.test.tsx`
- Modify: `components/icons/ParticipantPlaceholderIcon.tsx`

**Interfaces:**
- Consumes: opaque `BACKGROUND_COLORS.participantBadge`, `TEXT_COLORS.light`, and `TEXT_COLORS.participantStatusDanger`.
- Produces: deterministic badge contrast independent of video pixels and a 3:1 placeholder/status icon contract.

- [x] **Step 1: Write failing preview, placeholder, and video tests**

Mock `VideoTrack`, `BlurView`, and LiveKit hooks. Assert both connected and preview variants render an opaque badge token, participant label text uses `TEXT_COLORS.light`, mute icon uses `participantStatusDanger`, and the placeholder icon uses an AA-compliant meaningful icon token.

```tsx
expect(screen.getByTestId("participant-badge")).toHaveStyle({
  backgroundColor: BACKGROUND_COLORS.participantBadge,
})
expect(screen.getByText("Ada")).toHaveStyle({ color: TEXT_COLORS.light })
```

- [x] **Step 2: Run focused test and verify RED**

Run: `pnpm.cmd test -- components/participant/ParticipantTile.test.tsx`

Expected: FAIL because the video path relies on a translucent blur badge and uses local literal color.

- [x] **Step 3: Use one opaque badge implementation**

Remove `BADGE_BACKGROUND` and the contrast dependency on `BlurView`. Use an opaque semantic background for both video and placeholder paths, retain radius/spacing, add `testID="participant-badge"`, and use semantic icon colors.

- [x] **Step 4: Run focused and grid integration tests**

Run: `pnpm.cmd test -- components/participant/ParticipantTile.test.tsx components/room/VideoConference.integration.test.tsx components/room/grid/useParticipantGrid.test.ts`

Expected: PASS with no layout/participant regressions.

- [x] **Step 5: Commit**

```powershell
git add components/participant/ParticipantTile.tsx components/participant/ParticipantTile.test.tsx components/icons/ParticipantPlaceholderIcon.tsx
git commit -m "fix: guarantee participant overlay contrast"
```

### Task 7: Repository-wide accessibility guardrails and remaining visual components

**Files:**
- Create: `tests/accessibility/componentContracts.test.tsx`
- Create: `tests/accessibility/noLiteralUiColors.test.ts`
- Modify: `components/room/grid/GridPreview.tsx`
- Modify: `components/room/grid/ControlBarPreview.tsx`
- Modify: `components/room/ActiveRoom.tsx`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: all semantic tokens and component-level contracts from Tasks 3–6.
- Produces: complete visual-component inventory and source guard against unreviewed literal runtime colors.

- [x] **Step 1: Write failing inventory and source-policy tests**

Create an explicit inventory containing every runtime visual component/screen. Each entry names its owning contract test or marks it structural/decorative with a reason. Scan `.tsx` production sources for `#[0-9a-fA-F]{3,8}` and `rgba?(`, excluding `constants/colors.ts`, test files, generated/native directories, and asset SVGs; report file and line for violations.

```ts
expect(uncoveredVisualComponents).toEqual([])
expect(literalUiColorViolations).toEqual([])
```

- [x] **Step 2: Run guardrail tests and verify RED**

Run: `pnpm.cmd test -- tests/accessibility/componentContracts.test.tsx tests/accessibility/noLiteralUiColors.test.ts`

Expected: FAIL on the current inventory gaps and ParticipantTile literal if Task 6 has not removed it.

- [x] **Step 3: Complete preview/structural contracts and add the project rule**

Migrate GridPreview primary styles to semantic tokens. Assert ActiveRoom and ControlBarPreview delegate visuals to covered children. Append this exact policy to `CLAUDE.md`:

```md
- Accessibility: every visual UI change must meet WCAG 2.2 AA. Normal text and placeholders require at least 4.5:1 contrast; large text requires 3:1; meaningful icons, component boundaries, selected/error/focus indicators require 3:1. Disabled controls are exempt from those contrast criteria only when programmatically disabled, but must expose `accessibilityState={{ disabled: true }}` and remain reasonably readable. Use semantic color tokens only—no literal runtime UI colors outside `constants/colors.ts`—and add contrast and semantics tests for every changed visual component; validate dynamic image/video backgrounds with device visual tests.
```

- [x] **Step 4: Run all accessibility contracts and verify GREEN**

Run: `pnpm.cmd test -- constants/colors.test.ts utils/accessibility/contrast.test.ts tests/accessibility components screens app`

Expected: PASS with an empty uncovered-component list and no literal runtime UI colors.

- [x] **Step 5: Commit**

```powershell
git add tests/accessibility components/room/grid/GridPreview.tsx components/room/grid/ControlBarPreview.tsx components/room/ActiveRoom.tsx CLAUDE.md
git commit -m "test: enforce accessibility contracts project-wide"
```

### Task 8: Full regression and Android device verification

**Files:**
- Modify only files required by failures traced to Tasks 1–7.

**Interfaces:**
- Consumes: completed application and accessibility contracts.
- Produces: fresh verification evidence and a manual device-check record in the final handoff.

- [x] **Step 1: Run complete automated verification**

```powershell
pnpm.cmd test
pnpm.cmd test:node
pnpm.cmd type-check
pnpm.cmd lint
pnpm.cmd format:check
git diff --check
```

Expected: every command exits 0 with zero failed suites/tests/errors.

- [ ] **Step 2: Exercise Android states**

Open `/nkolosov`, verify the visible `NKolosov` identity, create/open a room, verify empty and populated participant-name states, open both device dropdowns, join a call, paginate participants, inspect video and no-video ParticipantTile badges, and open the disconnect confirmation.

- [ ] **Step 3: Verify accessibility behavior on device**

Confirm enabled/disabled distinction is not color-only, all labels remain legible at the tested font scale, dropdown and modal layers do not obscure text, and opaque participant badges remain readable over light and dark camera frames. Record limitations: TalkBack traversal and maximum system font scale require explicit manual checks if automation cannot drive them.

- [ ] **Step 4: Review the final diff against the specification**

Run: `git status --short` and `git diff --stat`; verify every acceptance criterion maps to passing test/device evidence and no unrelated user changes were overwritten.

- [ ] **Step 5: Commit any verification-only corrections**

```powershell
git add <only-files-corrected-during-verification>
git commit -m "fix: complete accessibility verification"
```

Skip this commit when verification required no corrections.

## Future TODO

- [ ] Replace the best-effort participant timestamp and client-clock calculation with a backend-authoritative `startedAt` and server-time offset.
- [ ] Add a persistent banner that communicates the current room connection state.
- [ ] Build custom toast notifications for errors, with an extensible foundation for success, info, and warning variants.
