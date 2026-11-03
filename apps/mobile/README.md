# Mobile app workspace

Android-first Expo development client for the GPS-only Phase 1 flow. It includes destination entry, optional on-device camera preview, location-based demo guidance, speech output, pause/resume/end controls, deviation handling, explicit arrival confirmation, and accessibility settings.

Places and routes are synthetic, and the UI prominently labels the experience `SIMULATED`. It is not a real-world navigation app. The camera preview remains on-device; no frame is uploaded. Visual recognition and visual localization are disabled. GPS fixes that are too inaccurate or too far from the synthetic route cause the app to abstain and request relocalization.

Start with `npm run start --workspace=@landmarknav/mobile`. Native APIs require an Expo development build; Android builds need Android Studio and the Android SDK. Configure `EXPO_PUBLIC_API_URL` for a physical device. The default uses `10.0.2.2:3000` on the Android emulator and `localhost:3000` on iOS simulators.

Verify with `npm run verify --workspace=@landmarknav/mobile`.
