# Default Company, Join Validation, and WCAG AA Design

## Goal

Make `NKolosov` the default displayed company while keeping `nkolosov` as its canonical route identity, prevent joining without a participant name, and establish enforceable WCAG 2.2 AA accessibility requirements across the React Native application.

## Default company

The root route `/` will redirect to `/nkolosov`. Company landing and meeting routes remain canonical lowercase path segments, so the default company is stored and sent to LiveKit as `nkolosov` while the UI renders it as `NKolosov`.

Deep links for other companies remain supported and continue to select their own company scope. Existing recent-room records are not migrated or renamed because their company value represents the route under which the meeting was joined.

The default company ID and display name will be centralized constants rather than repeated literals. Route tests will cover the redirect and canonical identity; screen tests will cover the display name.

## Participant-name validation

The pre-join Join button will be disabled whenever `name.trim()` is empty. Its disabled condition will also continue to cover loading, incomplete initialization, and configuration errors.

Submitting from the keyboard while the trimmed name is empty will be a no-op. The guard inside the asynchronous join function will remain as defense in depth, but it will not surface the obsolete `Please enter your name` error. Entering a non-whitespace name will enable the action, and clearing it will disable the action again.

Tests will prove that whitespace-only input cannot request a token, a valid name enables joining, and no empty-name validation error appears.

## Accessibility color architecture

UI colors will be expressed through semantic tokens in `constants/colors.ts`. Tokens will distinguish at least:

- text on primary and danger actions;
- placeholder text on light inputs;
- meaningful icons on elevated surfaces;
- component boundaries and dividers;
- text and status icons displayed over participant video;
- disabled foreground and background states.

Production components will not contain literal UI colors outside the color-token module. SVG asset colors may remain local when they are build-time assets rather than runtime UI components.

Every supported token pairing must meet these WCAG 2.2 AA thresholds:

- normal text and placeholders: at least 4.5:1;
- large text: at least 3:1;
- meaningful icons, component boundaries, selection indicators, error indicators, and focus indicators: at least 3:1.

Disabled controls are exempt from the WCAG contrast success criteria only when they are programmatically disabled. They must expose disabled state to assistive technology and remain reasonably readable.

## Remediation scope

The implementation will fix all statically identified production and development-preview failures:

- input placeholders on white fields;
- text on primary actions and selected device rows;
- text on the destructive disconnect action;
- enabled pagination arrows;
- the participant placeholder icon when it communicates the no-video state;
- participant name and mute status over arbitrary video frames;
- meaningful dividers or boundaries that currently fall below 3:1.

Participant metadata over video will use an opaque dark semantic surface so its contrast does not depend on the frame or blur implementation.

Interactive elements will expose appropriate roles and states. Buttons will use the button role, disclosure controls will report `expanded`, visual headings will use header semantics where appropriate, and disabled controls will report disabled state. Modal focus behavior will be covered to the extent supported by React Native Testing Library and documented for device verification.

## Automated verification

A pure contrast utility will calculate sRGB relative luminance, alpha composition, and contrast ratio. Its unit tests will cover known reference values and threshold boundaries.

A palette contract test will enumerate supported semantic foreground/background pairs and assert their applicable threshold. A static source test will reject new literal runtime UI colors outside `constants/colors.ts`, with narrow exclusions for tests and non-runtime assets.

Each visual component or screen will have a React Native Testing Library accessibility contract covering its rendered states. Applicable tests will verify:

- the semantic color pair used by text, icons, and meaningful boundaries;
- accessible role and label;
- disabled, selected, and expanded states;
- default, selected, disabled, error, open, closed, and video-placeholder variants where those states exist.

Shared icon-only components may be covered through their owning interactive component when the icon has no independent semantics. Structural components that introduce no visual styling will receive semantics/integration coverage rather than artificial color assertions.

Jest cannot validate final native pixels, video frames, BlurView output, screen-reader focus traversal, or platform font scaling. Android emulator verification will therefore cover representative Home, Join, room, dropdown, pagination, participant, and confirmation-modal states. VoiceOver/TalkBack focus order and large-font behavior remain explicit manual device checks unless an end-to-end accessibility runner is added later.

## Project rule

`CLAUDE.md` will require WCAG 2.2 AA for every visual UI change, semantic color tokens, contrast and semantics tests for changed components, programmatic disabled state, and device validation for dynamic image or video backgrounds.

## Acceptance criteria

- Opening `/` selects `/nkolosov`; the UI displays `NKolosov`.
- Other canonical company routes and deep links continue to work.
- Join cannot be activated with an empty or whitespace-only participant name and no empty-name error is shown.
- All inventoried static foreground/background combinations meet their applicable AA threshold.
- Dynamic participant overlays have a deterministic AA-compliant background.
- Visual components expose appropriate accessible roles and states.
- Every visual component has an appropriate automated accessibility contract, directly or through its owning component.
- The project rule and automated guardrails prevent regression.
- Full tests, type-check, lint, source checks, and representative Android visual checks pass.
