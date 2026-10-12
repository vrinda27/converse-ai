import { getApp } from '@react-native-firebase/app';
import {
  getToken,
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
  type AppCheck,
} from '@react-native-firebase/app-check';
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  type GenerativeModel,
} from '@react-native-firebase/ai';
import { APP_CHECK_DEBUG_TOKEN } from './debugToken';

// The Gemini model the app talks to. Week 2 (Friday): move this into Remote Config
// so you can change it without shipping a new build.
export const MODEL_NAME = 'gemini-3.8-flash';

type FirebaseSetup = { appCheck: AppCheck; model: GenerativeModel };
let setup: FirebaseSetup | null = null;

/**
 * Starts App Check and creates the Gemini model, once.
 * Throws if the Firebase config files (google-services.json / GoogleService-Info.plist) are missing.
 */
export function getFirebase(): FirebaseSetup {
  if (setup) {
    return setup;
  }

  const app = getApp();

  // Debug builds use the App Check debug provider, so the emulator/simulator works.
  // Release builds use the real attestation providers (Play Integrity / App Attest).
  const debugToken = APP_CHECK_DEBUG_TOKEN.trim() || undefined;
  const provider = new ReactNativeFirebaseAppCheckProvider();
  provider.configure({
    android: { provider: __DEV__ ? 'debug' : 'playIntegrity', debugToken },
    apple: {
      provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
      debugToken,
    },
  });

  // App Check must start before the first Gemini call.
  const appCheck = initializeAppCheck(app, {
    provider,
    isTokenAutoRefreshEnabled: true,
  });

  // Gemini Developer API backend, with every request carrying an App Check token.
  const ai = getAI(app, { backend: new GoogleAIBackend(), appCheck });
  const model = getGenerativeModel(ai, { model: MODEL_NAME });

  setup = { appCheck, model };
  return setup;
}

/** Asks App Check for a token. Rejects if the debug token isn't registered in the console. */
export async function checkAppCheck(): Promise<void> {
  const { appCheck } = getFirebase();
  const { token } = await getToken(appCheck, true);
  if (!token) {
    throw new Error('App Check returned an empty token.');
  }
}
