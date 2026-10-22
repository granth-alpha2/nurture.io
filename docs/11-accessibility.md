# 11 — Accessibility

## Commitment

Target WCAG 2.2 AA for applicable web content and native platform accessibility guidance for mobile. Validate with people using TalkBack and VoiceOver; automated checks alone are insufficient.

## Design requirements

- Minimum 48dp touch targets, generous spacing, and one primary navigation action at a time.
- Support system font scaling, high contrast, reduced motion, and non-color status cues.
- Label controls and announce instruction changes, route state, permission errors, and arrival through screen readers without noisy repeated announcements.
- Always provide visible text equivalent for speech; Repeat, Pause, and End controls remain reachable.
- Do not rely on camera recognition or audio alone; support typed destination and visual instruction text.
- Avoid time-limited prompts and interactions requiring precise gestures.
- Avoid instructing screen use while crossing; simplify to audio-only near crossings.
- Plain language: short sentences, familiar maneuver words, no unexplained compass/map jargon.
- English and Hindi localization must use native-language review and TTS capability checks; do not machine-translate safety-critical wording without review.

## Checklist

- [ ] TalkBack and VoiceOver labels, focus order, announcements, and modal behavior
- [ ] Dynamic text and display scaling without clipped navigation controls
- [ ] Contrast and non-color status indication
- [ ] Touch target sizing and one-handed use
- [ ] Reduced-motion behavior and haptic alternatives
- [ ] Permission denial, camera-off, offline, and low-confidence flows accessible
- [ ] Speech speed/language settings and text fallback
- [ ] Cognitive walkthrough with non-technical and older participants

## Evaluation

Perform manual audits on supported Android and iOS devices, representative screen sizes and text scaling. Record issues, severity, assistive technology, and retest evidence. Accessibility blockers prevent release.
