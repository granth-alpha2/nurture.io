import { useEffect } from 'react';

export interface SpeechRecognitionModuleType {
  isRecognitionAvailable: () => boolean;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
  abort: () => void;
}

let nativeModule: SpeechRecognitionModuleType | null = null;
let nativeHook: ((eventName: string, listener: (event: any) => void) => void) | null = null;

try {
  // In Expo Go or Web, requireNativeModule('ExpoSpeechRecognition') throws at runtime.
  // Catching this prevents the entire application from failing to mount in Expo Go.
  const speechPkg = require('expo-speech-recognition');
  if (speechPkg && speechPkg.ExpoSpeechRecognitionModule) {
    nativeModule = speechPkg.ExpoSpeechRecognitionModule;
    nativeHook = speechPkg.useSpeechRecognitionEvent;
  }
} catch {
  // Graceful fallback for Expo Go and unbundled native environments
  nativeModule = null;
  nativeHook = null;
}

export const isNativeSpeechRecognitionSupported = Boolean(nativeModule);

export const SpeechRecognitionModule: SpeechRecognitionModuleType = {
  isRecognitionAvailable: () => {
    try {
      return Boolean(nativeModule?.isRecognitionAvailable?.());
    } catch {
      return false;
    }
  },
  requestPermissionsAsync: async () => {
    try {
      if (nativeModule?.requestPermissionsAsync) {
        return await nativeModule.requestPermissionsAsync();
      }
    } catch {
      // Ignore
    }
    return { granted: false };
  },
  start: (options) => {
    try {
      nativeModule?.start?.(options);
    } catch {
      // Ignore
    }
  },
  stop: () => {
    try {
      nativeModule?.stop?.();
    } catch {
      // Ignore
    }
  },
  abort: () => {
    try {
      nativeModule?.abort?.();
    } catch {
      // Ignore
    }
  },
};

export function useSpeechRecognitionEvent(eventName: string, listener: (event: any) => void) {
  useEffect(() => {
    // Keep hook lifecycle consistent
  }, []);

  if (nativeHook) {
    try {
      nativeHook(eventName, listener);
    } catch {
      // Fallback if event emitter is unavailable
    }
  }
}

