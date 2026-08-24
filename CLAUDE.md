# Project Conventions

- In TypeScript, use `VoidFunction` instead of writing out `() => void`.
- Do not create inline object or array literals in JSX props except for `style`; assign them to named variables first. This applies to production code and tests.
- In `interface` declarations, add a one-line comment above each field explaining what it holds.
- Comments must be 1-3 lines maximum. If it needs more, it belongs in a doc, not a comment block.
- Never wildcard-import a package (`import * as X from "pkg"`) — import only the named members actually used.
- Every `await` must be wrapped in `try/catch`.
- Create all commits exclusively with the project owner's configured Git identity. Git history and PRs must contain no AI authorship, attribution, `Co-Authored-By` trailers, or tool-generated footers.
- Accessibility: every visual UI change must meet WCAG 2.2 AA. Normal text and placeholders require at least 4.5:1 contrast; large text requires 3:1; meaningful icons, component boundaries, selected/error/focus indicators require 3:1. Disabled controls are exempt from those contrast criteria only when programmatically disabled, but must expose `accessibilityState={{ disabled: true }}` and remain reasonably readable. Use semantic color tokens only—no literal runtime UI colors outside `constants/colors.ts`—and add contrast and semantics tests for every changed visual component; validate dynamic image/video backgrounds with device visual tests.
