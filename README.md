# NK Meet

[![CI](https://github.com/NKolosov097/nk-meet/actions/workflows/ci.yml/badge.svg)](https://github.com/NKolosov097/nk-meet/actions/workflows/ci.yml)

A cross-platform video meeting app by [NKolosov](https://nkolosov.com), built
with React Native, Expo Router, LiveKit, and TypeScript. NK Meet supports room
creation and joining, real-time audio and video, participant controls, and
shareable deep links on iOS and Android.

## Features

- 🎥 Real-time video calls
- 🎙️ Audio chat
- 📱 Cross-platform (iOS/Android)
- 🔧 Simple setup with Expo
- 🎛️ Camera and microphone controls
- 🖥️ Screen sharing
- 😊 Quick reactions and raise/lower hand
- 📝 Full TypeScript typing
- ♿ Accessibility support
- 🛡️ Error handling and validation

## Installation and setup

### 1. Install dependencies

```bash
pnpm install --frozen-lockfile
```

### 2. Configure the backend

Create a [LiveKit Cloud project](https://cloud.livekit.io/) and copy its project
URL, API key and API secret into a local backend environment file:

```bash
cp backend/.env.example backend/.env
```

Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` and
`HOST_CODE_ENCRYPTION_KEY`. Generate the encryption key locally with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Keep that key and the API secret on the backend. Never put them in
`EXPO_PUBLIC_*` variables. The gitignored `backend/.env` is loaded by the
backend dev/start commands. `DATABASE_PATH` defaults to
`./data/meetings.sqlite` relative to `backend/`.

```bash
pnpm dev:backend
```

The initial backend supports one Node process and one persistent SQLite file.
For deployment, mount persistent storage, back up the database consistently,
and retain its encryption key separately. Losing the key prevents recovery of
stored host codes. Add shared storage and locking before running multiple replicas.
Production must serve the API over HTTPS. If a local reverse proxy supplies the
client IP, enable `TRUST_LOCAL_PROXY` only behind that trusted local proxy.
Set `WEB_ORIGINS` to the allowed browser origins.

### 3. Configure the frontend

```bash
cp frontend/.env.example frontend/.env.local
```

Set `EXPO_PUBLIC_BACKEND_URL` to the backend address reachable from the device or
browser. On a physical device, use the development computer's LAN address;
`localhost` refers to the device itself. The API returns the authorized
LiveKit URL and token after a room Join request.

Local environment files are gitignored. Expo inlines `EXPO_PUBLIC_*` values
at build time; restart Metro with `pnpm start --clear` after changing them.
Keep any existing root environment file as a local backup; the app now reads
its configuration from `frontend/`.

### 4. Run the app

⚠️ **Important**: this app uses LiveKit native modules and screen-sharing
extensions/services. Run it in an Expo Development Build, not Expo Go. Rebuild
the native app after changing `frontend/app.config.ts` or the config plugins.

```bash
# Initial setup (generates the native folders)
pnpm prebuild

# Development with the Development Client
pnpm start

# iOS simulator (macOS only)
pnpm ios

# Android emulator
pnpm android

# Web version (limited functionality)
pnpm web

# Cloud build for iOS (via EAS)
pnpm build:ios
```

#### First run:

1. **Android**: `pnpm android` (installs the Development Client automatically)
2. **iOS**: requires macOS or a cloud build via EAS
3. **Web**: works, but without video/audio features

Screen sharing differs by platform: on iOS, starting a share opens the system
ReplayKit broadcast picker and requires the bundled broadcast extension and App
Group. On Android, the system asks for screen-capture permission and runs a
foreground service with a notification. Declining either system prompt leaves
the room connected. Validate capture and stopping on physical devices before
relying on screen sharing in a release.

## Usage

1. Open the default company landing, `/nkolosov`.
2. Create a room with your own eight-digit host code, displayed as `0000-0000`.
3. Share the guest link. Participants join with their name and receive no host code.
4. To join as host, select host mode and enter the current room code.
5. Before joining, open Settings by verifying the current host code; changing it
   requires the current code and a manually entered replacement.

After a code change, connected hosts retain their role and receive a notification.
`Show new host code` explicitly retrieves, displays and copies the current code;
receiving the notification never reveals it. Automatic reconnect preserves host
access. After leaving, a new host Join requires the current code.

Only backend-registered rooms can be joined. Old unregistered links show
`Meeting not found`; their room code is never treated as host authorization.

### Room links

Every company landing and room has a shareable link under the app's own URL scheme:

```
nk-meet://<company>
nk-meet://<company>/<room-slug>
nk-meet://nkolosov/team-sync
```

Opening a company-only link shows that company's landing; a room link opens its
join screen. Company and room segments are canonicalized exactly like a
typed room code (lowercased, anything else collapsed into `-`), so
`nk-meet://NKolosov/Team Sync` and `nk-meet://nkolosov/team-sync` select the same
meeting. A link with extra path segments redirects to the safe root screen. A
link that arrives while a call is in progress disconnects that call first,
unless it selects the same company and room.

Open a link by hand to test it:

```bash
# Android (device or emulator)
npx uri-scheme open "nk-meet://nkolosov/test-room" --android

# iOS simulator
xcrun simctl openurl booted "nk-meet://nkolosov/test-room"
```

The scheme is declared in `frontend/app.config.ts` (`scheme`), so it only reaches the
native projects through `pnpm --dir frontend exec expo prebuild` — run it (or `pnpm --dir frontend exec expo prebuild
--clean`) before expecting a link to open the app.

## Configuration

### Permissions

The app automatically requests the following permissions:

**iOS:**

- `NSCameraUsageDescription` - camera access
- `NSMicrophoneUsageDescription` - microphone access

**Android:**

- `android.permission.CAMERA` - camera access
- `android.permission.RECORD_AUDIO` - microphone access
- `android.permission.MODIFY_AUDIO_SETTINGS` - change audio settings
- `android.permission.INTERNET` - internet access
- `android.permission.ACCESS_NETWORK_STATE` - check network state
- `android.permission.WAKE_LOCK` - prevent the screen from locking
- `android.permission.FOREGROUND_SERVICE` - run screen capture in the foreground
- `android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION` - foreground screen-capture service

### Expo plugins

The project is configured with:

- `@livekit/react-native-expo-plugin` - the main LiveKit plugin for Expo
- `./plugins/withScreenShareNotificationIcon` - Android screen-sharing notification icon
- `./plugins/withIosBroadcastExtension` - iOS ReplayKit broadcast extension and App Group
- `expo-router` - file-based routing
- `expo-status-bar` - status bar styling
- `expo-splash-screen` - splash screen configuration

## Project structure

```
nk-meet/
??? frontend/                 # Expo app, assets, native plugins and client tests
?   ??? app/                  # Expo Router routes and routing tests
?   ??? screens/              # Landing, joining and conference screens
?   ??? components/           # Conference UI, controls, icons and participant tiles
?   ??? services/             # Tokens, room slugs, identity and recents
?   ??? constants/            # Theme and environment configuration
?   ??? types/                # Client TypeScript types
?   ??? plugins/              # Android notification and iOS broadcast extension
?   ??? assets/               # Icons and splash images
??? backend/                  # Server application and tests
??? specs/                    # Requirements, plans and implementation tasks
??? patches/                  # Existing dependency patches
??? pnpm-workspace.yaml       # Workspace settings and dependency overrides
??? pnpm-lock.yaml            # Shared dependency lockfile
```

## TypeScript

The project is fully typed with TypeScript:

- **Strict typing** - all components and functions have explicit types
- **Interfaces** - defined in `frontend/types/index.ts` for all core data structures
- **Type safety** - prevents runtime errors
- **IntelliSense** - improved IDE support

### Core types:

- `ConnectionState` - session state: access token and last error

## App capabilities

### Login screen

- Participant name input
- Access token authorized by the backend for a registered room
- Environment configuration and connection errors shown inline

### Video call screen

- Video display for all participants
- Microphone control (mute/unmute)
- Camera control (on/off)
- Screen sharing (start/stop)
- Quick reactions and raise/lower hand
- Participant count display
- Disconnect from room button

## Development

Run the documented `pnpm` commands from the repository root; Expo and EAS
commands forward to `frontend/`. Direct Expo/EAS commands must run from that
folder. App config is `frontend/app.config.ts`; native projects are generated
in `frontend/android/` and `frontend/ios/`. Existing root native folders and
local environment files are preserved but are no longer the app working paths.

Backend commands are `pnpm dev:backend`, `pnpm build:backend`, and
`pnpm test:backend`. Root lint/type-check cover both workspaces; `pnpm test`
runs frontend Jest and `pnpm test:node` runs frontend Node tests and backend tests.

### Requirements

- Node.js 24
- Expo CLI
- EAS CLI: `npm install -g eas-cli`
- iOS Simulator (for iOS development, macOS only)
- Android emulator or device (for Android development)
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Unit tests

Run the Jest unit and component suite:

```bash
pnpm test
```

Run the retained dependency-free geometry tests:

```bash
pnpm test:node
```

### Debugging

```bash
# Show logs
pnpm --dir frontend exec expo logs

# Clear the cache
pnpm start --clear

# Check TypeScript types
pnpm type-check

# Check types in watch mode
pnpm --dir frontend exec tsc --noEmit --watch
```

## Useful links

- [LiveKit Documentation](https://docs.livekit.io/)
- [LiveKit React Native SDK](https://docs.livekit.io/client-sdk-js/react-native/)
- [Expo Documentation](https://docs.expo.dev/)
- [LiveKit Cloud](https://cloud.livekit.io/)

## Troubleshooting

### Error "The package '@livekit/react-native' doesn't seem to be linked"

This error happens when you try to use Expo Go instead of a Development Build:

1. **On Android**:

   ```bash
   pnpm android
   ```

2. **On iOS (macOS only)**:

   ```bash
   pnpm ios
   ```

3. **For iOS on Windows/Linux**:
   ```bash
   pnpm build:ios
   ```

### Other issues

- **Native module problems**: run `pnpm prebuild`
- **Cache problems**: use `pnpm start --clear`
- **Metro bundler errors**: restart the development server

## Production cutover

Build and deploy the backend with persistent storage, then rebuild the frontend
with its production API URL. Disable the LiveKit sandbox token server in the
LiveKit project before production use; an accessible sandbox issuer bypasses
this backend's authorization. Previously installed sandbox clients must update.
Disabling the external sandbox and deploying this server have not been performed
by this repository change. Validate calls and screen sharing on devices before release.

## Support

If you run into problems:

1. Verify you are using a Development Build, not Expo Go
2. Make sure all dependencies are installed correctly
3. Check that `frontend/.env.local` exists and its API URL is reachable
4. Check that the backend is running and its LiveKit credentials are configured
5. Consult the LiveKit documentation

## License

MIT License
