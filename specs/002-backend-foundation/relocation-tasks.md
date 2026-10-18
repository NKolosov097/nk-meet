# Frontend relocation tasks

Scope: preserve existing Expo behavior and dependency versions while making the app an independently runnable workspace.

- [x] Move tracked app sources, assets, plugins, tests and app-specific configuration into `frontend/`.
- [x] Declare frontend/backend workspace paths; retain root patches, lockfile, overrides and shared formatting.
- [x] Forward familiar root commands and preserve frontend aliases, native plugin paths and test discovery.
- [x] Resolve dependency fixture paths through Node resolution instead of assuming local node_modules.
- [x] Update ignore rules and README; preserve local TODO, environment originals and generated native folders.
- [x] Update lockfile importers and run frozen installation plus focused relocation checks.
- [x] Run final full lint, types and test suites after feature implementation.
- [x] Run final repository formatting after documentation updates.
- [x] Record native/device checks that require supported build hosts or devices.

Verification: frozen workspace installation passed after one transient pnpm import failure. Final integrated checks passed: frontend Jest 43 suites / 369 tests, frontend Node tests 57/57, backend tests 18/18, workspace type-check and backend build. Android and iOS Metro exports passed (2004/2131 modules). Original frontend dependency versions and aliases are unchanged; expo-clipboard is the separately planned feature dependency.

The frontend ESLint resolver uses its configuration directory so imports resolve consistently from repository and workspace commands. Final root recursive lint passed. Native builds, device calls and screen sharing were not run. Original root .env, android/ and TODO.md were retained; local frontend environment setup is required.
