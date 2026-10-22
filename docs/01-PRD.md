# 01 — Product requirements

## Product summary

LandmarkNav is a mobile walking companion for non-technical users. It combines destination search, pedestrian routes, GPS, optional camera evidence, and speech to provide one actionable instruction at a time.

## MoSCoW scope

| Priority | Requirements |
|---|---|
| Must | Plain-language onboarding and safety notice; destination search and confirmation; walking route; start/pause/end; GPS-only guidance; repeat instruction; accessible text and speech; arrival confirmation beyond proximity; privacy controls; safe uncertainty fallback |
| Should | English and Hindi; heading-aware guidance; reroute on deviation; offline cached-route fallback; user feedback; operator health visibility |
| Could | Landmark matching; camera pose/AR arrow; configurable voice and haptics; optional accounts |
| Won't (initial release) | Driving, guaranteed safety, raw video streaming, autonomous sign-command execution, visual navigation without validated evaluation |

## User stories and acceptance criteria

### PR-01 — Onboarding and consent (Must)
Given a first-time user, when permissions are requested, then each permission has a plain-language purpose, can be declined, and the user sees the safety notice before navigation.

### PR-02 — Search and confirm destination (Must)
Given a user on Home, when they type or dictate a destination, then matching choices are presented accessibly; navigation does not start until the user confirms a destination.

### PR-03 — Start walking navigation (Must)
Given a confirmed destination and location permission, when the user starts, then the app obtains a walking route and presents a single next instruction with distance, progress, Repeat, Pause, and End controls.

### PR-04 — GPS-only fallback (Must)
Given missing, stale, or conflicting visual evidence, when an instruction is selected, then visual claims are withheld and the app provides route-based GPS guidance or asks for safe relocalization.

### PR-05 — Spoken instruction and repeat (Must)
Given an active route, when an instruction changes or Repeat is selected, then the current plain-language instruction is spoken using the selected voice/language without requiring the user to read while moving.

### PR-06 — Safe crossing behavior (Must)
Given the route approaches a crossing, when the crossing state is detected from route context, then the app suppresses visual interaction prompts and provides concise audio guidance; it never tells the user to watch the screen while crossing.

### PR-07 — Deviation and reroute (Should)
Given the user's measured position is confidently off-route, when the deviation persists beyond hysteresis/dwell rules, then the app announces uncertainty and requests a replacement walking route; transient GPS drift does not flicker instructions.

### PR-08 — Arrival confirmation (Must)
Given the user is near the destination, when GPS proximity alone is the only evidence, then the app does not claim arrival; it requests confirmation or additional entrance/route evidence.

### PR-09 — Pause/end and deletion (Must)
Given an active session, when the user pauses or ends it, then active guidance stops; ending removes session-associated transient data according to the documented retention policy.

### PR-10 — Feedback (Should)
Given an instruction was confusing or wrong, when the user submits feedback, then the report is associated with a pseudonymous session and excludes raw imagery and unnecessary precise location.

### PR-11 — Accessibility and settings (Must)
Given a user changes text size, contrast, motion, speech speed, or language, when they return to navigation, then controls remain operable with assistive technology and the preference is applied.

### PR-12 — Visual landmark instruction (Could; gated)
Given a candidate landmark, when GPS, heading, route geometry, and validated visual evidence meet calibrated thresholds and stability dwell time, then one instruction may use that landmark; otherwise use PR-04.

## Key use-case specifications

| Use case | Preconditions | Main flow | Alternate flows | Postconditions |
|---|---|---|---|---|
| Search destination | App open; connectivity may be available | Enter or dictate query → show accessible results → select result | Permission denied: continue typed; service unavailable: show explicit error/retry | A candidate destination is selected; no route yet |
| Confirm destination | Search result selected | Show destination identity/location → user confirms | User edits search or cancels | Confirmed destination is bound to request |
| Start navigation | Destination confirmed; location permission granted | Request walking route → summarize route → user starts | No route: explain and allow retry; location unavailable: request permission or stop | Active session has route and initial GPS state |
| Receive spoken instruction | Session active; route step available | Select safe instruction → render text and speech → monitor progress | Low confidence: GPS fallback/relocalization; crossing: audio-only | User receives one current instruction |
| Repeat instruction | Session active | User taps Repeat or uses accessible action | TTS unavailable: retain readable instruction and report issue | Same instruction is repeated; route state unchanged |
| Recognize landmark | Visual feature opt-in; camera permission; supported provider | Sample frame/features → retrieve candidates → validate/fuse → stabilize | Low quality, mismatch, outage, or low confidence: abstain and use GPS | Validated estimate or explicit abstention |
| Relocalize | Estimate inconsistent or uncertain | Ask user to stop in a safe place and point toward a sign/landmark → collect new permitted evidence | Camera denied/offline: GPS-only; repeated failure: offer route restart | Estimate refreshed or user remains in safe fallback |
| Handle wrong turn/reroute | Active route and sufficiently reliable position | Detect persistent deviation → request route → announce reroute | Position uncertain/provider unavailable: do not reroute from one noisy fix | Updated route or clear degraded state |
| Pause/end navigation | Session active or paused | User selects Pause or End → stop TTS/sampling as appropriate | App interruption: preserve safe resumable state only as documented | Session paused or closed; retention policy applied |
| Confirm arrival | Near route destination | Check route completion and confirmation signal → ask user to confirm if needed | Proximity only or entrance ambiguous: do not claim arrival | Arrival only when evidence supports it |
| Change language | Settings available | Choose language and voice → apply to UI/TTS | Voice unavailable: explain and use accessible text | Preference is applied and persisted locally |
| Grant/revoke permissions | OS permission flow available | Explain request → OS prompt → reflect status | Denial/revocation: preserve non-camera options and stop dependent processing | Consent/permission state is explicit |
| Report bad instruction | Session has instruction | Select issue category → submit minimal report | Offline: queue consented non-sensitive report or explain failure | Feedback accepted or failure surfaced |

## Release gates

Visual instruction acceptance is governed by the false-confident-match evaluation gate in `docs/07-ml-pipeline.md`; it is not enabled merely because a provider returns a score. Safety, privacy, and accessibility requirements are release blockers.
