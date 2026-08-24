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
- 📝 Full TypeScript typing
- ♿ Accessibility support
- 🛡️ Error handling and validation

## Installation and setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up a LiveKit Cloud project

The app connects to [LiveKit Cloud](https://cloud.livekit.io/) and gets access
tokens from the project's token server, so no backend of your own is needed.

In the project settings you need two values:

- **Project URL** — the `wss://` address of the project
- **Token server ID** — enable "Token server" in the project settings and copy the ID

> The token server issues a token to anyone who asks, with any permissions. It
> is meant for local development and testing, not for production.

### 3. Configure the environment

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable                         | Meaning                                                   |
| -------------------------------- | --------------------------------------------------------- |
| `EXPO_PUBLIC_LIVEKIT_URL`        | Project URL, for example `wss://my-project.livekit.cloud` |
| `EXPO_PUBLIC_LIVEKIT_SANDBOX_ID` | Token server ID                                           |

`.env.local` is git-ignored. If a variable is missing, the login screen says
which one and the "Join" button stays disabled.

Expo inlines `EXPO_PUBLIC_*` values into the bundle at build time, so if
Metro is already running when you edit `.env.local`, restart the dev server
(ideally `npx expo start -c --dev-client`) for the new values to take effect.

### 4. Run the app

⚠️ **Important**: this app uses LiveKit native modules and requires an Expo Development Build, not Expo Go.

```bash
# Initial setup (generates the native folders)
npx expo prebuild --clean

# Development with the Development Client
npx expo start --dev-client

# iOS simulator (macOS only)
npx expo run:ios

# Android emulator
npx expo run:android

# Web version (limited functionality)
npx expo start --web

# Cloud build for iOS (via EAS)
eas build --platform ios --profile development
```

#### First run:

1. **Android**: `npx expo run:android` (installs the Development Client automatically)
2. **iOS**: requires macOS or a cloud build via EAS
3. **Web**: works, but without video/audio features

## Usage

1. Open a company landing, such as `/acme`
2. Enter a room code to join an existing room in that company, or tap "Create a new room"
3. Enter your name
4. Press "Join" — the app requests an access token and joins that room

### Room links

Every company landing and room has a shareable link under the app's own URL scheme:

```
nk-meet://<company>
nk-meet://<company>/<room-slug>
nk-meet://acme/team-sync
```

Opening a company-only link shows that company's landing; a room link opens its
name-entry screen. Company and room segments are canonicalized exactly like a
typed room code (lowercased, anything else collapsed into `-`), so
`nk-meet://Acme/Team Sync` and `nk-meet://acme/team-sync` select the same
meeting. A link with extra path segments redirects to the safe root screen. A
link that arrives while a call is in progress disconnects that call first,
unless it selects the same company and room.

Open a link by hand to test it:

```bash
# Android (device or emulator)
npx uri-scheme open "nk-meet://acme/test-room" --android

# iOS simulator
xcrun simctl openurl booted "nk-meet://acme/test-room"
```

The scheme is declared in `app.config.ts` (`scheme`), so it only reaches the
native projects through `npx expo prebuild` — run it (or `npx expo prebuild
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

### Expo plugins

The project is configured with:

- `@livekit/react-native-expo-plugin` - the main LiveKit plugin for Expo

## Project structure

```
nk-meet/
├── app/                       # Expo Router routes and routing tests
│   ├── _layout.tsx            # Root layout and active-room lifecycle
│   ├── +native-intent.ts      # Incoming deep-link normalization
│   ├── index.tsx              # Redirect to the default company landing
│   └── [company]/             # Company landing and company-scoped room routes
├── screens/
│   └── JoinScreen.tsx         # Participant name and join form
├── components/
│   ├── icons/                 # Accessible media and navigation icons
│   ├── participant/           # Participant video tiles
│   └── room/                  # Conference UI, grid, and media controls
├── services/                  # Tokens, room slugs, identity, and recents
├── constants/                 # Theme and environment configuration
└── types/                     # Shared TypeScript types
```

## TypeScript

The project is fully typed with TypeScript:

- **Strict typing** - all components and functions have explicit types
- **Interfaces** - defined in `types/index.ts` for all core data structures
- **Type safety** - prevents runtime errors
- **IntelliSense** - improved IDE support

### Core types:

- `ConnectionState` - session state: access token and last error

## App capabilities

### Login screen

- Participant name input
- Access token requested from the LiveKit Cloud token server
- Environment configuration and connection errors shown inline

### Video call screen

- Video display for all participants
- Microphone control (mute/unmute)
- Camera control (on/off)
- Participant count display
- Disconnect from room button

## Development

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
npx expo logs

# Clear the cache
npx expo start -c

# Check TypeScript types
npx tsc --noEmit

# Check types in watch mode
npx tsc --noEmit --watch
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
   npx expo run:android
   ```

2. **On iOS (macOS only)**:

   ```bash
   npx expo run:ios
   ```

3. **For iOS on Windows/Linux**:
   ```bash
   eas build --platform ios --profile development
   ```

### Other issues

- **Native module problems**: run `npx expo prebuild --clean`
- **Cache problems**: use `npx expo start -c --dev-client`
- **Metro bundler errors**: restart the development server

## Support

If you run into problems:

1. Verify you are using a Development Build, not Expo Go
2. Make sure all dependencies are installed correctly
3. Check that `.env.local` exists and both variables are filled in
4. Check that the token server is enabled in the LiveKit Cloud project settings
5. Consult the LiveKit documentation

## License

MIT License
