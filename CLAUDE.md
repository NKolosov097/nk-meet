# Project Conventions

- In TypeScript, use `VoidFunction` instead of writing out `() => void`.
- In `interface` declarations, add a one-line comment above each field explaining what it holds.
- Comments must be 1-3 lines maximum. If it needs more, it belongs in a doc, not a comment block.
- Never wildcard-import a package (`import * as X from "pkg"`) — import only the named members actually used.
- Every `await` must be wrapped in `try/catch`.
- Create all commits exclusively with the project owner's configured Git identity. Git history and PRs must contain no AI authorship, attribution, `Co-Authored-By` trailers, or tool-generated footers.
