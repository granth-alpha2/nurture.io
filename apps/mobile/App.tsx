import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import {
  SpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from './src/services/speech';
import { api, type NavigationSession, type PlaceCandidate } from './src/services/api';
import {
  bearingArrow,
  distanceMeters,
  formatDistance,
  gpsOnlyOfflineInstruction,
  isNearDestination,
  bearingDegrees,
  relativeBearingDegrees,
  shouldReroute,
  type Coordinate,
  type LocalizationEstimate,
  type WalkingRoute,
} from './src/domain/navigation';

type Language = 'en' | 'hi';
type Screen = 'onboarding' | 'home' | 'navigation' | 'arrival' | 'settings';

const copy = {
  en: {
    title: 'LandmarkNav',
    safety: 'Guidance is advisory. This demo uses synthetic straight-line routes, not real roads. Do not use it to navigate in the real world. Stay aware of traffic and never look at the screen while crossing.',
    continue: 'Continue',
    cameraPreview: 'Camera preview',
    cameraExplain: 'Optional. The preview stays on your device and is not processed or uploaded.',
    enableCamera: 'Enable camera preview',
    skipCamera: 'Continue without camera',
    searchTitle: 'Where would you like to go?',
    searchPlaceholder: 'Type a demo destination',
    search: 'Search',
    speakDestination: 'Say destination',
    selectDestination: 'Choose a result, then start',
    start: 'Start demo navigation',
    settings: 'Settings',
    gpsAccuracy: 'GPS accuracy',
    repeat: 'Repeat instruction',
    pause: 'Pause',
    resume: 'Resume',
    end: 'End navigation',
    confirmArrival: 'I have arrived',
    arrivalHint: 'Arrival is not automatic. Confirm only when you are safely at the destination.',
    near: 'You are near the selected demo point. Check your surroundings.',
    searching: 'Searching…',
    location: 'Getting your location…',
    offline: 'Network unavailable. Using the current in-memory route and GPS-only direction. No route is saved to this device.',
    uncertain: 'GPS is uncertain or off the demo line. Stop somewhere safe and check your location.',
    paused: 'Navigation paused.',
    endConfirm: 'End this demo session and delete its session data?',
    cancel: 'Cancel',
    confirm: 'End session',
    textSize: 'Text size',
    speechSpeed: 'Speech speed',
    highContrast: 'High contrast',
    cameraPrivacy: 'Camera preview enabled',
    language: 'Language',
    back: 'Back',
    enName: 'English',
    hiName: 'हिन्दी',
    noCamera: 'Camera preview is unavailable. GPS-only demo mode is still available.',
    noSpeech: 'Speech recognition is unavailable on this device. You can type the destination.',
    voiceError: 'Voice input failed. Type the destination or try again.',
    loading: 'Loading route…',
    retry: 'Retry',
  },
  hi: {
    title: 'LandmarkNav',
    safety: 'दिशा-सुझाव केवल सहायता के लिए हैं। यह डेमो काल्पनिक सीधी रेखा वाले रास्ते दिखाता है, असली सड़कें नहीं। वास्तविक नेविगेशन के लिए इसका उपयोग न करें। सड़क पर ध्यान दें और सड़क पार करते समय स्क्रीन न देखें।',
    continue: 'जारी रखें',
    cameraPreview: 'कैमरा पूर्वावलोकन',
    cameraExplain: 'वैकल्पिक। पूर्वावलोकन आपके फ़ोन पर रहता है; इसे संसाधित या अपलोड नहीं किया जाता।',
    enableCamera: 'कैमरा पूर्वावलोकन चालू करें',
    skipCamera: 'कैमरे के बिना जारी रखें',
    searchTitle: 'आप कहाँ जाना चाहते हैं?',
    searchPlaceholder: 'डेमो स्थान लिखें',
    search: 'खोजें',
    speakDestination: 'स्थान बोलें',
    selectDestination: 'परिणाम चुनें, फिर शुरू करें',
    start: 'डेमो नेविगेशन शुरू करें',
    settings: 'सेटिंग्स',
    gpsAccuracy: 'GPS की सटीकता',
    repeat: 'निर्देश दोहराएँ',
    pause: 'रोकें',
    resume: 'फिर शुरू करें',
    end: 'नेविगेशन समाप्त करें',
    confirmArrival: 'मैं पहुँच गया/गई',
    arrivalHint: 'पहुँचने की पुष्टि अपने आप नहीं होती। सुरक्षित स्थान पर होने पर ही पुष्टि करें।',
    near: 'आप चुने गए डेमो स्थान के पास हैं। आसपास ध्यान से देखें।',
    searching: 'खोज रहे हैं…',
    location: 'आपका स्थान प्राप्त हो रहा है…',
    offline: 'नेटवर्क उपलब्ध नहीं। अभी की मार्ग जानकारी और GPS दिशा का उपयोग हो रहा है। मार्ग फ़ोन में सहेजा नहीं जाता।',
    uncertain: 'GPS अनिश्चित है या डेमो रेखा से दूर है। सुरक्षित स्थान पर रुककर अपना स्थान जाँचें।',
    paused: 'नेविगेशन रुका हुआ है।',
    endConfirm: 'डेमो सत्र समाप्त करके उसका डेटा हटाएँ?',
    cancel: 'रद्द करें',
    confirm: 'सत्र समाप्त करें',
    textSize: 'अक्षर का आकार',
    speechSpeed: 'बोलने की गति',
    highContrast: 'उच्च कंट्रास्ट',
    cameraPrivacy: 'कैमरा पूर्वावलोकन चालू',
    language: 'भाषा',
    back: 'वापस',
    enName: 'English',
    hiName: 'हिन्दी',
    noCamera: 'कैमरा पूर्वावलोकन उपलब्ध नहीं। GPS डेमो जारी रखा जा सकता है।',
    noSpeech: 'इस फ़ोन पर आवाज़ पहचान उपलब्ध नहीं। स्थान लिख सकते हैं।',
    voiceError: 'आवाज़ पहचान नहीं हो सकी। स्थान लिखें या फिर कोशिश करें।',
    loading: 'मार्ग लोड हो रहा है…',
    retry: 'फिर कोशिश करें',
  },
} as const;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('onboarding');
  const [language, setLanguage] = useState<Language>('en');
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [selected, setSelected] = useState<PlaceCandidate | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [route, setRoute] = useState<WalkingRoute | null>(null);
  const [session, setSession] = useState<NavigationSession | null>(null);
  const [instruction, setInstruction] = useState('');
  const [remainingMeters, setRemainingMeters] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [textScale, setTextScale] = useState(1);
  const [speechRate, setSpeechRate] = useState(0.9);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const rerouteCount = useRef(0);
  const processingFix = useRef(false);
  const currentLocationRef = useRef<Coordinate | null>(null);
  const t = copy[language];
  const palette = highContrast
    ? { background: '#000000', foreground: '#ffffff', accent: '#ffff00', card: '#111111', warning: '#ffcc00' }
    : { background: '#f4f7fb', foreground: '#10243a', accent: '#075bc8', card: '#ffffff', warning: '#7b3500' };

  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript?.trim();
    if (transcript) {
      setVoiceTranscript(transcript);
      setQuery(transcript);
      setStatusMessage(language === 'hi'
        ? 'आवाज़ पहचानी गई। स्थान जाँचें, फिर खोजें।'
        : 'Voice recognized. Review the destination, then search.');
    }
  });
  useSpeechRecognitionEvent('error', () => {
    setIsListening(false);
    setError(t.voiceError);
  });

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  useEffect(() => {
    if (screen !== 'navigation' || !session || session.state !== 'active' || !route || !selected) {
      return;
    }

    let mounted = true;
    let subscription: Location.LocationSubscription | null = null;
    processingFix.current = false;

    const onLocation = async (position: Location.LocationObject) => {
      if (!mounted || processingFix.current) return;
      processingFix.current = true;
      const point = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      currentLocationRef.current = point;
      setCurrentLocation(point);
      setAccuracy(position.coords.accuracy);
      setHeading(position.coords.heading);

      try {
        const estimate = await api.localize(
          session.sessionId,
          point,
          position.coords.accuracy ?? 1000,
          position.coords.heading ?? undefined,
        );
        if (!mounted) return;
        const distance = distanceMeters(point, selected.location);
        setRemainingMeters(distance);
        if (estimate.requires_relocalization) {
          setInstruction(t.uncertain);
          setStatusMessage(t.uncertain);
          const routeEvidence = estimate.evidence.find((item) => item.type === 'route');
          if (
            position.coords.accuracy !== null
            && position.coords.accuracy <= 25
            && routeEvidence?.validated === false
          ) {
            rerouteCount.current += 1;
            if (shouldReroute(rerouteCount.current)) {
              rerouteCount.current = 0;
              try {
                const replacement = await api.createRoute(point, selected.location);
                await api.updateSession(session.sessionId, 'active', replacement.routeId);
                if (!mounted) return;
                setRoute(replacement);
                setInstruction(replacement.steps[0]?.instruction ?? t.uncertain);
                setStatusMessage('SIMULATED demo route recalculated after repeated GPS deviation.');
              } catch (rerouteError) {
                if (mounted) setError(`Reroute failed: ${errorMessage(rerouteError)}`);
              }
            }
          } else {
            rerouteCount.current = 0;
          }
        } else {
          rerouteCount.current = 0;
          setInstruction(estimate.next_instruction ?? t.uncertain);
          setStatusMessage('');
        }
      } catch (localizationError) {
        if (!mounted) return;
        setInstruction(gpsOnlyOfflineInstruction(point, selected.location));
        setRemainingMeters(distanceMeters(point, selected.location));
        setStatusMessage(t.offline);
        setError(`GPS-only offline mode: ${errorMessage(localizationError)}`);
      } finally {
        processingFix.current = false;
      }
    };

    const startWatching = async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) {
          if (mounted) {
            setError('Location permission was revoked. End navigation or restore permission in system settings.');
          }
          return;
        }
        const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (mounted) await onLocation(initial);
        const watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          (position) => void onLocation(position),
        );
        if (mounted) subscription = watcher;
        else watcher.remove();
      } catch (locationError) {
        if (mounted) setError(`Location update failed: ${errorMessage(locationError)}`);
      }
    };

    void startWatching();
    return () => {
      mounted = false;
      subscription?.remove();
      processingFix.current = false;
    };
  }, [screen, session, route, selected, t]);

  const say = useCallback((text: string) => {
    setIsSpeaking(true);
    Speech.speak(text, {
      language: language === 'hi' ? 'hi-IN' : 'en-IN',
      rate: speechRate,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => {
        setIsSpeaking(false);
        setError('Speech output is unavailable. The instruction remains visible on screen.');
      },
    });
  }, [language, speechRate]);

  const readLocation = useCallback(async (): Promise<Coordinate> => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Location permission is needed for GPS-only navigation.');
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const point = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    currentLocationRef.current = point;
    setCurrentLocation(point);
    setAccuracy(position.coords.accuracy);
    return point;
  }, []);

  const enableCamera = async () => {
    try {
      const permission = cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();
      if (permission.granted) {
        setCameraEnabled(true);
        setError('');
      } else {
        setCameraEnabled(false);
        setError(t.noCamera);
      }
    } catch (permissionError) {
      setError(`Camera permission failed: ${errorMessage(permissionError)}`);
    }
  };

  const searchDestinations = async () => {
    if (!query.trim()) {
      setError(language === 'hi' ? 'पहले डेमो स्थान लिखें या बोलें।' : 'Enter or say a demo destination first.');
      return;
    }
    setIsBusy(true);
    setError('');
    setStatusMessage(t.location);
    setSelected(null);
    try {
      const location = await readLocation();
      setStatusMessage(t.searching);
      const results = await api.searchPlaces(query.trim(), location);
      setCandidates(results);
      setStatusMessage('SIMULATED results only. These are not real places.');
    } catch (searchError) {
      setError(errorMessage(searchError));
      setStatusMessage('');
    } finally {
      setIsBusy(false);
    }
  };

  const startNavigation = async () => {
    if (!selected || !currentLocationRef.current) {
      setError('Choose a destination and allow location access before starting.');
      return;
    }
    setIsBusy(true);
    setError('');
    try {
      const nextRoute = await api.createRoute(currentLocationRef.current, selected.location);
      const nextSession = await api.createSession(nextRoute.routeId);
      setRoute(nextRoute);
      setSession(nextSession);
      setInstruction(nextRoute.steps[0]?.instruction ?? '');
      setRemainingMeters(distanceMeters(currentLocationRef.current, selected.location));
      setStatusMessage(nextRoute.warning);
      rerouteCount.current = 0;
      setScreen('navigation');
      say(nextRoute.steps[0]?.instruction ?? nextRoute.warning);
    } catch (navigationError) {
      setError(`Could not start demo navigation: ${errorMessage(navigationError)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const pauseOrResume = async () => {
    if (!session) return;
    const nextState = session.state === 'active' ? 'paused' : 'active';
    try {
      const updated = await api.updateSession(session.sessionId, nextState);
      setSession(updated);
      setStatusMessage(nextState === 'paused' ? t.paused : '');
      if (nextState === 'paused') Speech.stop();
    } catch (sessionError) {
      setError(`Session update failed: ${errorMessage(sessionError)}`);
    }
  };

  const endNavigation = () => {
    Alert.alert(t.end, t.endConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.confirm,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            if (!session) return;
            try {
              await api.endSession(session.sessionId);
              Speech.stop();
              setSession(null);
              setRoute(null);
              setSelected(null);
              setScreen('home');
              setStatusMessage('');
              setError('');
            } catch (endError) {
              setError(`Could not end session: ${errorMessage(endError)}`);
            }
          })();
        },
      },
    ]);
  };

  const confirmArrival = async () => {
    if (remainingMeters === null || !isNearDestination(remainingMeters) || !session) {
      setError('Arrival cannot be confirmed by proximity alone. Move safely to the destination and check it first.');
      return;
    }
    try {
      await api.endSession(session.sessionId);
      Speech.stop();
      setSession(null);
      setScreen('arrival');
      setError('');
    } catch (arrivalError) {
      setError(`Arrival confirmation failed: ${errorMessage(arrivalError)}`);
    }
  };

  const startVoiceInput = async () => {
    try {
      if (!SpeechRecognitionModule.isRecognitionAvailable()) {
        setError(t.noSpeech);
        return;
      }
      const permission = await SpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission was not granted. Type the destination instead.');
        return;
      }
      setError('');
      setVoiceTranscript('');
      SpeechRecognitionModule.start({
        lang: language === 'hi' ? 'hi-IN' : 'en-IN',
        interimResults: false,
        continuous: false,
        recordingOptions: { persist: false },
      });
    } catch (voiceError) {
      setError(`Voice input unavailable: ${errorMessage(voiceError)}`);
    }
  };

  const buttonStyle = [
    styles.button,
    {
      backgroundColor: palette.accent,
      minHeight: Math.max(56, 48 * textScale),
    },
  ];
  const textStyle = {
    color: palette.foreground,
    fontSize: 17 * textScale,
  };
  const secondaryTextStyle = {
    color: palette.foreground,
    fontSize: 15 * textScale,
  };

  const renderButton = (
    label: string,
    action: () => void,
    accessibilityLabel = label,
    disabled = false,
    secondary = false,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={action}
      style={[
        buttonStyle,
        secondary && styles.secondaryButton,
        secondary && { borderColor: palette.accent },
        disabled && styles.disabledButton,
      ]}
    >
      <Text style={[styles.buttonText, secondaryTextStyle, !secondary && styles.primaryButtonText]}>
        {label}
      </Text>
    </Pressable>
  );

  const renderCamera = (height: number) => (
    <View
      style={[
        styles.cameraFrame,
        { height, backgroundColor: palette.card, borderColor: palette.accent },
      ]}
      accessibilityLabel={t.cameraPreview}
    >
      {cameraEnabled && cameraPermission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onMountError={(event) => {
            setCameraEnabled(false);
            setError(`Camera preview failed: ${event.message}`);
          }}
        />
      ) : (
        <Text style={[styles.cameraPlaceholder, textStyle]}>{t.cameraPreview}</Text>
      )}
      <View style={styles.cameraLabel}>
        <Text style={styles.cameraLabelText}>SIMULATED: preview only; no landmark recognition</Text>
      </View>
    </View>
  );

  const renderError = () => error
    ? <Text accessibilityRole="alert" style={[styles.error, { fontSize: 15 * textScale }]}>{error}</Text>
    : null;

  const renderStatus = () => statusMessage
    ? <Text accessibilityLiveRegion="polite" style={[styles.status, secondaryTextStyle]}>{statusMessage}</Text>
    : null;

  const openSettings = () => setScreen('settings');

  if (screen === 'onboarding') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, textStyle]}>{t.title}</Text>
          {renderCamera(220)}
          <Text style={[styles.paragraph, textStyle]}>{t.cameraExplain}</Text>
          <Text style={[styles.warning, { backgroundColor: palette.warning, fontSize: 16 * textScale }]}>{t.safety}</Text>
          {renderError()}
          {renderButton(t.enableCamera, () => void enableCamera(), t.enableCamera, false, true)}
          {renderButton(t.continue, () => setScreen('home'), t.continue, false, true)}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'settings') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, textStyle]}>{t.settings}</Text>
          <Text style={[styles.sectionTitle, textStyle]}>{t.language}</Text>
          {renderButton(t.enName, () => setLanguage('en'), t.enName, false, language !== 'en')}
          {renderButton(t.hiName, () => setLanguage('hi'), t.hiName, false, language !== 'hi')}
          <Text style={[styles.sectionTitle, textStyle]}>{t.textSize}</Text>
          <View style={styles.row}>
            {renderButton('A−', () => setTextScale((value) => Math.max(0.9, value - 0.1)), 'Decrease text size', textScale <= 0.9)}
            {renderButton('A+', () => setTextScale((value) => Math.min(1.5, value + 0.1)), 'Increase text size', textScale >= 1.5)}
          </View>
          <Text style={[styles.sectionTitle, textStyle]}>{t.speechSpeed}: {speechRate.toFixed(1)}×</Text>
          <View style={styles.row}>
            {renderButton('−', () => setSpeechRate((value) => Math.max(0.6, value - 0.1)), 'Slower speech', speechRate <= 0.6)}
            {renderButton('+', () => setSpeechRate((value) => Math.min(1.3, value + 0.1)), 'Faster speech', speechRate >= 1.3)}
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.paragraph, textStyle]}>{t.highContrast}</Text>
            <Switch
              accessibilityLabel={t.highContrast}
              value={highContrast}
              onValueChange={setHighContrast}
              trackColor={{ true: palette.accent }}
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.paragraph, textStyle]}>{t.cameraPrivacy}</Text>
            <Switch
              accessibilityLabel={t.cameraPrivacy}
              value={cameraEnabled}
              onValueChange={(enabled) => {
                if (enabled) void enableCamera();
                else setCameraEnabled(false);
              }}
              trackColor={{ true: palette.accent }}
            />
          </View>
          {renderError()}
          {renderButton(t.back, () => setScreen('home'), t.back, false, true)}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'arrival') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
        <View style={styles.content}>
          <Text style={[styles.title, textStyle]}>{language === 'hi' ? 'सत्र समाप्त' : 'Session ended'}</Text>
          <Text style={[styles.paragraph, textStyle]}>{t.arrivalHint}</Text>
          {renderButton(t.continue, () => {
            setCandidates([]);
            setQuery('');
            setScreen('home');
          })}
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'navigation' && route && session && selected) {
    const near = remainingMeters !== null && isNearDestination(remainingMeters);
    const arrow = currentLocation && heading !== null
      ? bearingArrow(relativeBearingDegrees(bearingDegrees(currentLocation, selected.location), heading))
      : '↑';
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          {renderCamera(160)}
          <Text style={[styles.simulatedBanner, { fontSize: 15 * textScale }]}>
            SIMULATED DEMO ONLY — synthetic straight-line route. Not safe for real navigation.
          </Text>
          <Text style={[styles.sectionTitle, textStyle]}>{selected.displayName}</Text>
          <View style={styles.instructionCard}>
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.arrow, { color: palette.accent }]}
              accessibilityLabel="Direction arrow"
            >
              {arrow}
            </Text>
            <Text accessibilityLiveRegion="polite" style={[styles.instruction, textStyle]}>
              {session.state === 'paused' ? t.paused : instruction}
            </Text>
            <Text style={[styles.distance, textStyle]}>
              {remainingMeters === null ? '—' : formatDistance(remainingMeters)}
            </Text>
            {accuracy !== null && (
              <Text style={[styles.paragraph, secondaryTextStyle]}>
                {t.gpsAccuracy}: ±{Math.round(accuracy)} m
              </Text>
            )}
          </View>
          <Text style={[styles.warning, { backgroundColor: palette.warning, fontSize: 16 * textScale }]}>
            {route.warning}
          </Text>
          {near && <Text style={[styles.status, secondaryTextStyle]}>{t.near}</Text>}
          {renderStatus()}
          {renderError()}
          {renderButton(t.repeat, () => say(instruction || route.warning), t.repeat, isSpeaking || session.state === 'paused')}
          {renderButton(
            session.state === 'active' ? t.pause : t.resume,
            () => void pauseOrResume(),
            session.state === 'active' ? t.pause : t.resume,
            false,
            true,
          )}
          {renderButton(t.confirmArrival, () => void confirmArrival(), t.confirmArrival, !near)}
          {renderButton(t.end, endNavigation, t.end, false, true)}
          {renderButton(t.settings, openSettings, t.settings, false, true)}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {renderCamera(220)}
        <Text style={[styles.simulatedBanner, { fontSize: 15 * textScale }]}>
          SIMULATED DEMO ONLY — do not use this synthetic route for real-world navigation.
        </Text>
        <Text style={[styles.sectionTitle, textStyle]}>{t.searchTitle}</Text>
        <Text style={[styles.paragraph, textStyle]}>{t.cameraExplain}</Text>
        <TextInput
          accessibilityLabel={t.searchPlaceholder}
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setSelected(null);
            setVoiceTranscript('');
          }}
          placeholder={t.searchPlaceholder}
          placeholderTextColor={highContrast ? '#bbbbbb' : '#526477'}
          returnKeyType="search"
          onSubmitEditing={() => void searchDestinations()}
          style={[
            styles.input,
            textStyle,
            { backgroundColor: palette.card, borderColor: palette.accent },
          ]}
        />
        {renderButton(isBusy ? t.searching : t.search, () => void searchDestinations(), t.search, isBusy)}
        {renderButton(
          isListening ? 'Listening…' : t.speakDestination,
          () => void startVoiceInput(),
          t.speakDestination,
          isBusy || isListening,
          true,
        )}
        {voiceTranscript !== '' && (
          <Text style={[styles.paragraph, secondaryTextStyle]}>
            {language === 'hi' ? 'पहचाना गया: ' : 'Recognized: '}{voiceTranscript}
          </Text>
        )}
        {candidates.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, textStyle]}>{t.selectDestination}</Text>
            {candidates.map((candidate) => {
              const isSelected = selected?.providerPlaceId === candidate.providerPlaceId;
              return (
                <Pressable
                  key={candidate.providerPlaceId}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${candidate.displayName}. ${candidate.formattedAddress}`}
                  onPress={() => setSelected(candidate)}
                  style={[
                    styles.result,
                    {
                      backgroundColor: palette.card,
                      borderColor: isSelected ? palette.accent : '#667788',
                      borderWidth: isSelected ? 3 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.resultTitle, textStyle]}>{candidate.displayName}</Text>
                  <Text style={[styles.paragraph, secondaryTextStyle]}>{candidate.formattedAddress}</Text>
                </Pressable>
              );
            })}
            {renderButton(t.start, () => void startNavigation(), t.start, isBusy || !selected)}
          </>
        )}
        {renderStatus()}
        {renderError()}
        {renderButton(t.settings, openSettings, t.settings, false, true)}
      </ScrollView>
      {isBusy && (
        <View style={styles.loadingOverlay} accessibilityRole="progressbar" accessibilityLabel={t.loading}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  paragraph: { fontSize: 16, lineHeight: 24 },
  warning: { color: '#ffffff', padding: 14, borderRadius: 10, fontWeight: '700', lineHeight: 23 },
  simulatedBanner: {
    backgroundColor: '#8a1c1c',
    color: '#ffffff',
    padding: 14,
    borderRadius: 10,
    textAlign: 'center',
    fontWeight: '800',
    lineHeight: 22,
  },
  cameraFrame: {
    overflow: 'hidden',
    borderWidth: 2,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraPlaceholder: { fontWeight: '700' },
  cameraLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
    padding: 9,
  },
  cameraLabelText: { color: '#ffffff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  input: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 14, minHeight: 56 },
  button: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  buttonText: { fontWeight: '700', textAlign: 'center' },
  primaryButtonText: { color: '#ffffff' },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 2 },
  disabledButton: { opacity: 0.45 },
  result: { borderRadius: 12, padding: 14, gap: 5 },
  resultTitle: { fontSize: 18, fontWeight: '700' },
  error: { color: '#a01818', fontWeight: '700', lineHeight: 22 },
  status: { backgroundColor: '#e8eef7', padding: 12, borderRadius: 10, lineHeight: 22 },
  instructionCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    gap: 10,
  },
  arrow: { fontSize: 72, fontWeight: '800' },
  instruction: { fontSize: 22, fontWeight: '700', lineHeight: 30, textAlign: 'center' },
  distance: { fontSize: 28, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
