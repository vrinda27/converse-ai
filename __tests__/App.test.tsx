/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Firebase talks to native code, so the tests use fakes instead.
jest.mock('@react-native-firebase/ai', () => ({
  AIError: class AIError extends Error {},
}));

const mockCheckAppCheck = jest.fn();
const mockGenerateContentStream = jest.fn();

jest.mock('../src/firebase', () => ({
  MODEL_NAME: 'test-model',
  checkAppCheck: () => mockCheckAppCheck(),
  getFirebase: () => ({
    model: {
      generateContentStream: (text: string) => mockGenerateContentStream(text),
    },
  }),
}));

async function* chunks(...pieces: string[]) {
  for (const piece of pieces) {
    yield { text: () => piece };
  }
}

function allText(root: ReactTestRenderer.ReactTestRenderer): string {
  return root.root
    .findAll(node => typeof node.props.children === 'string')
    .map(node => node.props.children)
    .join('\n');
}

beforeEach(() => {
  mockCheckAppCheck.mockReset();
  mockGenerateContentStream.mockReset();
});

test('shows App Check is working and streams a reply', async () => {
  mockCheckAppCheck.mockResolvedValue(undefined);
  mockGenerateContentStream.mockResolvedValue({
    stream: chunks('Hello ', 'from Gemini.'),
  });

  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(<App />);
  });
  expect(allText(root)).toContain('App Check verified');

  const [sendButton] = root.root.findAllByProps({ testID: 'send-button' });
  await ReactTestRenderer.act(async () => {
    await sendButton.props.onPress();
  });

  expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);
  expect(allText(root)).toContain('Hello from Gemini.');
});

test('explains an App Check failure', async () => {
  mockCheckAppCheck.mockRejectedValue(new Error('App attestation failed.'));

  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(<App />);
  });

  const text = allText(root);
  expect(text).toContain('Not working');
  expect(text).toContain('Manage debug tokens');
});
