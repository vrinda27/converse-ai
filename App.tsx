/**
 * Converse AI — setup test for Firebase AI Logic + App Check.
 * Shows whether App Check is working, then streams one reply from Gemini.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { AIError } from '@react-native-firebase/ai';
import { checkAppCheck, getFirebase, MODEL_NAME } from './src/firebase';

const APP_NAME = 'Converse AI';

type CheckState =
  | { kind: 'checking' }
  | { kind: 'ok' }
  | { kind: 'failed'; message: string; hint: string };

const DEFAULT_PROMPT =
  'In one short sentence, say hello and tell me one fun fact about space.';

// Tapping a chip fills the prompt box.
const SUGGESTIONS = [
  { label: '🚀 Space fact', prompt: DEFAULT_PROMPT },
  {
    label: '🧠 Explain simply',
    prompt: 'Explain quantum computing to a 10-year-old in three sentences.',
  },
  { label: '☕ Write a haiku', prompt: 'Write a haiku about morning coffee.' },
  {
    label: '💡 App idea',
    prompt: 'Give me one creative mobile app idea in two sentences.',
  },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Turns the common setup errors into the step that fixes them. */
function hintFor(error: unknown): string {
  const message = errorMessage(error);
  const status =
    error instanceof AIError ? error.customErrorData?.status : undefined;

  if (/No Firebase App|initializeApp/i.test(message)) {
    return 'Firebase config is missing. Add android/app/google-services.json and ios/GeminiChat/GoogleService-Info.plist, then rebuild the app.';
  }
  if (
    /app ?check|attestation|debug token|appCheck\//i.test(message) ||
    status === 401
  ) {
    return 'App Check rejected this app. Paste your debug token in src/debugToken.ts, register the same token in the Firebase console (Security > App Check > Manage debug tokens), then uninstall and reinstall the app.';
  }
  if (status === 404 || /not found|is not supported/i.test(message)) {
    return `The model "${MODEL_NAME}" wasn't found. Check the current model names in the Firebase AI Logic docs and update MODEL_NAME in src/firebase.ts.`;
  }
  if (
    status === 403 ||
    /has not been used|is disabled|PERMISSION_DENIED/i.test(message)
  ) {
    return "The Gemini API isn't enabled for this project. In the Firebase console open AI Services > AI Logic, click Get started and choose the Gemini Developer API.";
  }
  if (status === 429) {
    return 'Too many requests for the free quota. Wait a minute and try again.';
  }
  if (/network|fetch|timed out|timeout/i.test(message)) {
    return 'Network problem. Check the device or emulator has internet access.';
  }
  return 'See the full error above. The README lists the setup steps to check.';
}

/** Three dots that pulse while Gemini is thinking. */
function TypingDots(): React.JSX.Element {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.stagger(
        160,
        dots.map(dot =>
          Animated.sequence([
            Animated.timing(dot, {
              toValue: 1,
              duration: 320,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0.3,
              duration: 320,
              useNativeDriver: true,
            }),
          ]),
        ),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [dots]);

  return (
    <View style={styles.dots}>
      {dots.map((opacity, index) => (
        <Animated.View key={index} style={[styles.dot, { opacity }]} />
      ))}
    </View>
  );
}

function StatusPill({
  state,
  onRetry,
}: {
  state: CheckState;
  onRetry: () => void;
}): React.JSX.Element {
  if (state.kind === 'checking') {
    return (
      <View style={styles.pill}>
        <ActivityIndicator size="small" color="#ffffff" />
        <Text style={styles.pillText}>Verifying device…</Text>
      </View>
    );
  }
  if (state.kind === 'ok') {
    return (
      <View style={styles.pill}>
        <View style={[styles.pillDot, styles.pillDotOk]} />
        <Text style={styles.pillText}>App Check verified</Text>
      </View>
    );
  }
  return (
    <Pressable style={styles.pill} onPress={onRetry}>
      <View style={[styles.pillDot, styles.pillDotBad]} />
      <Text style={styles.pillText}>App Check failed · Retry</Text>
    </Pressable>
  );
}

function Screen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [appCheck, setAppCheck] = useState<CheckState>({ kind: 'checking' });
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<{
    message: string;
    hint: string;
  } | null>(null);

  const runAppCheck = useCallback(async () => {
    setAppCheck({ kind: 'checking' });
    try {
      await checkAppCheck();
      setAppCheck({ kind: 'ok' });
    } catch (error) {
      setAppCheck({
        kind: 'failed',
        message: errorMessage(error),
        hint: hintFor(error),
      });
    }
  }, []);

  useEffect(() => {
    runAppCheck();
  }, [runAppCheck]);

  const sendPrompt = useCallback(async () => {
    const text = prompt.trim();
    if (!text || sending) {
      return;
    }
    setSending(true);
    setReply('');
    setSendError(null);
    try {
      const { model } = getFirebase();
      const result = await model.generateContentStream(text);
      for await (const chunk of result.stream) {
        const piece = chunk.text();
        setReply(current => current + piece);
      }
    } catch (error) {
      console.warn('Gemini request failed', error);
      setSendError({ message: errorMessage(error), hint: hintFor(error) });
    } finally {
      setSending(false);
    }
  }, [prompt, sending]);

  const canSend = !sending && prompt.trim() !== '';
  const showReply = sending || reply !== '' || sendError !== null;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { paddingTop: insets.top + 28 }]}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>✦</Text>
            </View>
            <View>
              <Text style={styles.title}>{APP_NAME}</Text>
              <Text style={styles.subtitle}>Powered by Gemini</Text>
            </View>
          </View>
          <Text style={styles.tagline}>
            Ask anything. Get answers that stream in as they're written.
          </Text>
          <View style={styles.pillRow}>
            <StatusPill state={appCheck} onRetry={runAppCheck} />
            <View style={styles.pill}>
              <Text style={styles.pillText}>{MODEL_NAME}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {appCheck.kind === 'failed' && (
            <View style={[styles.card, styles.errorCard]}>
              <Text style={styles.bad}>Not working</Text>
              <Text style={styles.hint}>{appCheck.hint}</Text>
              <Text style={styles.errorDetail} selectable>
                {appCheck.message}
              </Text>
              <Pressable style={styles.secondaryButton} onPress={runAppCheck}>
                <Text style={styles.secondaryButtonText}>Check again</Text>
              </Pressable>
            </View>
          )}

          <View style={[styles.card, styles.composer]}>
            <Text style={styles.cardLabel}>Your prompt</Text>
            <TextInput
              style={styles.input}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              placeholder="Ask anything…"
              placeholderTextColor={colors.muted}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              keyboardShouldPersistTaps="handled"
            >
              {SUGGESTIONS.map(suggestion => {
                const active = suggestion.prompt === prompt;
                return (
                  <Pressable
                    key={suggestion.label}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setPrompt(suggestion.prompt)}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {suggestion.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              testID="send-button"
              style={({ pressed }) => [
                styles.button,
                !canSend && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={sendPrompt}
              disabled={!canSend}
            >
              {sending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Send to Gemini ✦</Text>
              )}
            </Pressable>
          </View>

          {showReply && (
            <View style={styles.card}>
              <View style={styles.replyHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>✦</Text>
                </View>
                <Text style={styles.replyName}>Gemini</Text>
                {sending && <Text style={styles.streaming}>Streaming</Text>}
              </View>
              {sending && reply === '' && <TypingDots />}
              {reply !== '' && (
                <Text style={styles.reply} selectable>
                  {reply}
                </Text>
              )}
              {sendError && (
                <>
                  <Text style={styles.bad}>Request failed</Text>
                  <Text style={styles.hint}>{sendError.hint}</Text>
                  <Text style={styles.errorDetail} selectable>
                    {sendError.message}
                  </Text>
                </>
              )}
            </View>
          )}

          <Text style={styles.footer}>
            Built with React Native · Firebase AI Logic · App Check
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <Screen />
    </SafeAreaProvider>
  );
}

const colors = {
  background: '#f5f3ff',
  card: '#ffffff',
  text: '#1e1b2e',
  muted: '#6b6880',
  border: '#ebe7f7',
  accent: '#6d28d9',
  accentSoft: '#f1ebff',
  ok: '#34d399',
  bad: '#e11d48',
};

const gradient = 'linear-gradient(135deg, #4338ca 0%, #7c3aed 55%, #db2777 100%)';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundImage: gradient,
    paddingHorizontal: 24,
    paddingBottom: 64,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    gap: 16,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 26, color: '#ffffff' },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  tagline: { fontSize: 16, lineHeight: 23, color: 'rgba(255,255,255,0.92)' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  pillText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillDotOk: {
    backgroundColor: colors.ok,
    boxShadow: '0 0 6px 1px rgba(52,211,153,0.9)',
  },
  pillDotBad: { backgroundColor: '#fda4af' },
  body: { paddingHorizontal: 18, marginTop: -40, gap: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    boxShadow: '0 8px 24px rgba(76, 29, 149, 0.10)',
  },
  composer: { boxShadow: '0 12px 32px rgba(76, 29, 149, 0.18)' },
  errorCard: { borderWidth: 1, borderColor: '#fecdd3' },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  input: {
    minHeight: 96,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    padding: 14,
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
    textAlignVertical: 'top',
  },
  chips: { gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  chipTextActive: { color: colors.accent },
  button: {
    height: 54,
    borderRadius: 18,
    backgroundImage: gradient,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 20px rgba(124, 58, 237, 0.35)',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { transform: [{ scale: 0.98 }] },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundImage: gradient,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 16 },
  replyName: { fontSize: 15, fontWeight: '700', color: colors.text },
  streaming: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  reply: { fontSize: 17, lineHeight: 26, color: colors.text },
  dots: { flexDirection: 'row', gap: 6, paddingVertical: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
  bad: { fontSize: 15, fontWeight: '700', color: colors.bad },
  hint: { fontSize: 14, lineHeight: 20, color: colors.text },
  errorDetail: { fontSize: 12, lineHeight: 17, color: colors.muted },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
});

export default App;
