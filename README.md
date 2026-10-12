# GeminiChat

A bare React Native CLI app (React Native 0.87.1) set up for **Firebase AI Logic** (Gemini) with **App Check**.
It's the Week 1 Sunday task from the career plan, and the starting point for Week 2's chat screen.

The app has one test screen. It checks that App Check works, then streams a reply from Gemini.

## Already done in this project

| What | Where |
| --- | --- |
| Firebase packages `@react-native-firebase/app`, `ai`, `app-check` (all 26.4.0) | `package.json` |
| Google services Gradle plugin | `android/build.gradle`, `android/app/build.gradle` |
| Dynamic frameworks (React Native Firebase gets the iOS SDK through Swift Package Manager, which needs them) | `ios/Podfile` |
| App Check registered before `FirebaseApp.configure()` | `ios/GeminiChat/AppDelegate.swift` |
| Bridging header so Swift can see App Check's Objective-C module | `ios/GeminiChat/GeminiChat-Bridging-Header.h` |
| `GoogleService-Info.plist` already linked in Xcode, so you only drop the file in | `ios/GeminiChat.xcodeproj` |
| Bundle ID / package name `com.geminichat` on both platforms | Xcode project, `android/app/build.gradle` |
| App Check debug provider in debug builds, Play Integrity / App Attest in release builds | `src/firebase.ts` |
| Gemini model and backend (Gemini Developer API) | `src/firebase.ts` (`MODEL_NAME`) |
| Test screen with a streamed reply and plain-English error hints | `App.tsx` |

## What you need to do (about 15 minutes)

### 1. Install

```bash
cd ~/Documents/GeminiChat
npm install
bundle install            # first time only
cd ios && bundle exec pod install && cd ..
```

The first `pod install` is slow because it downloads the Firebase iOS SDK. iOS needs Xcode 26.2 or later.

### 2. Firebase console

1. Open the [Firebase console](https://console.firebase.google.com/) and create a project. Google Analytics is optional.
2. Go to **AI Services > AI Logic**, click **Get started** and choose **Gemini Developer API**. This also turns on App Check enforcement for AI Logic.
3. Add an **Android app** with package name `com.geminichat`. Download `google-services.json` and put it at `android/app/google-services.json`.
4. Add an **iOS app** with bundle ID `com.geminichat`. Download `GoogleService-Info.plist` and put it at `ios/GeminiChat/GoogleService-Info.plist`. It's already linked in Xcode, so no dragging needed.

### 3. App Check debug token

1. In the console go to **Security > App Check > Apps**.
2. On the Android app, open the **⋮** menu > **Manage debug tokens** > **Add debug token** > **Generate token**. Copy it.
3. On the iOS app, open **Manage debug tokens** and add **the same token** (paste it in).
4. Paste the token into `src/debugToken.ts`.

`src/debugToken.ts` is in `.gitignore`, so the token won't end up on GitHub. You don't need Play Integrity or App Attest yet; only before you release.

### 4. Run

```bash
npm run android
npm run ios
```

It's working when the screen shows **App Check: Working — token received**, and **Send to Gemini** streams a reply.

## If something fails

The screen shows a hint under each error. The common ones:

| You see | Fix |
| --- | --- |
| Android: "File google-services.json is missing". iOS: "Build input file cannot be found: GoogleService-Info.plist" | The config file is missing or in the wrong place (steps 2.3 and 2.4). |
| App Check: Not working | The token in `src/debugToken.ts` isn't registered for that app in the console. Uninstall the app and run it again after fixing. |
| 403, "has not been used" or "is disabled" | AI Logic isn't set up for the project (step 2.2). |
| 404 / model not found | Update `MODEL_NAME` in `src/firebase.ts` to a current model from the [models page](https://firebase.google.com/docs/ai-logic/models). |
| 429 | Free quota hit. Wait a minute. |
| `pod install` says SPM + static linkage isn't supported | Keep `use_frameworks! :linkage => :dynamic` in `ios/Podfile`. |

## Next (Week 2)

- **Chat:** use `model.startChat()` and `chat.sendMessageStream()` instead of a single prompt.
- **Stop button:** pass an `AbortController` signal as the request options, e.g. `generateContentStream(text, { signal })`.
- **Remote Config:** move `MODEL_NAME` (and your system prompt) into Remote Config.

## Docs

- [React Native Firebase: getting started](https://rnfirebase.io/)
- [React Native Firebase: AI Logic](https://rnfirebase.io/ai/usage)
- [React Native Firebase: App Check](https://rnfirebase.io/app-check/usage)
- [Firebase AI Logic: Get started](https://firebase.google.com/docs/ai-logic/get-started)

## Scripts

`npm run typecheck` · `npm run lint` · `npm test`
