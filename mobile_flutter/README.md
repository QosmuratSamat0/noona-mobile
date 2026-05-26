# Noona Flutter

Flutter mobile client for Noona AI. It connects to the existing Go backend and supports login, dashboard metrics, chat sessions, websocket audio results, stats, profile, and voice upload.

## Architecture

```text
lib/
  main.dart
  core/
    config/       Runtime config, API_URL
    network/      HTTP client and API error handling
    storage/      Local token persistence
    theme/        App colors and ThemeData
  domain/
    entities/     Pure app models
    repositories/ Repository contracts
  data/
    repositories/ Backend implementation of domain contracts
  presentation/
    app/          App composition and session bootstrap
    screens/      Login, dashboard, chat, stats, profile
    widgets/      Reusable UI components
```

Dependency direction:

```text
presentation -> domain
data -> domain
core -> shared infrastructure
```

UI screens depend on `NoonaRepository`, not on `http` directly. Backend-specific JSON parsing lives in `data/` and entities live in `domain/`.

## Prerequisites

Install Flutter SDK first:

```powershell
flutter --version
flutter doctor
```

This machine currently did not have `flutter` or `dart` on PATH when the project was scaffolded, so the source is ready but platform folders must be generated after installing Flutter.

## Backend

Start infrastructure from the repository root:

```powershell
cd C:\Users\admin\Noona-AI
docker compose up -d
```

Start the Go backend:

```powershell
cd C:\Users\admin\Noona-AI\backend
go run ./cmd/api
```

Backend must listen on:

```env
ADDRESS=0.0.0.0:8080
```

Check from the PC:

```text
http://localhost:8080/docs/index.html
```

Check from a physical phone on the same Wi-Fi:

```text
http://192.168.8.40:8080/docs/index.html
```

If the phone cannot open it, allow port `8080` in Windows Firewall.

## First Flutter Setup

Generate Android/iOS/web platform folders:

```powershell
cd C:\Users\admin\Noona-AI\mobile_flutter
flutter create .
flutter pub get
```

After `flutter create .`, add microphone permission to `android/app/src/main/AndroidManifest.xml` above the `<application>` tag:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

For the current flow, the app records audio and uploads the temporary recording file, so `RECORD_AUDIO` is the required Android permission. Add `READ_MEDIA_AUDIO` on Android 13+ only if the app later lets users pick existing audio files from device media storage:

```xml
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
```

For iOS, add this to `ios/Runner/Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Noona records your speech to generate English coaching feedback.</string>
```

## Run

Physical Android phone on the same Wi-Fi as the PC:

```powershell
cd C:\Users\admin\Noona-AI\mobile_flutter
flutter run --dart-define=API_URL=http://192.168.8.40:8080/api/v1
```

Android emulator:

```powershell
flutter run --dart-define=API_URL=http://10.0.2.2:8080/api/v1
```

iOS simulator:

```powershell
flutter run --dart-define=API_URL=http://localhost:8080/api/v1
```

## Useful Commands

```powershell
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=API_URL=http://192.168.8.40:8080/api/v1
```

## API Contract

The app uses:

```text
POST /auth/login
GET  /users/me
POST /auth/logout
GET  /activity/me
GET  /linguistic/mistakes
GET  /sessions/
POST /sessions/
GET  /sessions/{sessionId}/messages
POST /sessions/{sessionId}/messages
POST /audio/upload
WS   /ws/chat?token=...
```

## Runtime Behavior

Implemented:

- WebSocket reconnect with exponential backoff up to 30 seconds.
- Token refresh on protected REST calls. On `401`, the app calls `POST /auth/refresh`, saves the new tokens, and retries the original request.
- If refresh fails, the local session is cleared and the app returns to login.
- Audio upload also retries once after refresh.

Not implemented yet:

- Flutter flavors. For the current stage `--dart-define=API_URL=...` is enough. For production, add `dev/stage/prod` flavors and map each flavor to its own API URL, app label, bundle id, and signing config.

## Notes

The old Expo client is still in `mobile/`. This Flutter client is in `mobile_flutter/` so the previous code is not destroyed before Flutter is installed and verified.
