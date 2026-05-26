# Mini-Loora Mobile

Expo mobile client for Noona AI.

## Structure

```text
src/
  application/  App composition, session bootstrap
  entities/     Domain models shared by features and screens
  features/     Backend-facing use cases: auth, audio, stats
  navigation/   Tab navigation and screen composition
  screens/      Login, dashboard, chat, stats, profile screens
  shared/       API client, config, theme, reusable UI
```

Keep backend calls inside `features/*/api.ts`, plain types inside `entities`, and screen-only state inside `screens`.

```bash
cd mobile
npm install
npm run start
```

If Expo cannot reach `api.expo.dev`, use offline mode:

```bash
npm run start:offline
npm run android:offline
```

Android:

```bash
cd mobile
npm run android
```

If Android SDK / `adb` is not installed, use Expo Go instead:

```bash
cd mobile
npm run start
```

Then scan the QR code with the Expo Go app on your phone. If you are using a physical phone, set `EXPO_PUBLIC_API_URL` to your computer LAN IP, not `localhost`.

To use `npm run android` with an emulator, install Android Studio and make sure these environment variables are set:

```powershell
$env:ANDROID_HOME="C:\Users\admin\AppData\Local\Android\Sdk"
$env:Path="$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
```

Permanent Windows PATH entries should include:

```text
C:\Users\admin\AppData\Local\Android\Sdk\platform-tools
C:\Users\admin\AppData\Local\Android\Sdk\emulator
```

Do not run `npx expo start` from `backend`: it downloads the latest Expo CLI, which may require a newer Node.js than this project. Use the local scripts above, or from `mobile` run:

```bash
npx --no-install expo start --android
```

Set `EXPO_PUBLIC_API_URL` if testing on a physical device. Use your computer LAN IP, for example:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.25:8080/api/v1 npm run start
```
