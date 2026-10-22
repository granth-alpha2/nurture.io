# 00 — Vision and scope

## Problem

People who are unfamiliar with an area, have low map literacy, or have accessibility needs can find conventional map interfaces difficult to interpret while walking. LandmarkNav aims to translate a walking route into one simple, timely spoken and on-screen instruction grounded in evidence about the user's location and surroundings.

## Product vision

Help users understand the world directly in front of them without requiring them to learn a map. The app should say less, only when its evidence supports it, and should degrade safely when it cannot localize.

## Personas

| Persona | Needs | Risks and design response |
|---|---|---|
| Non-technical first-time visitor | Plain language, low setup effort, clear next action | Avoid map jargon; show one instruction and a large Repeat control |
| Tourist | Find a destination in an unfamiliar place, potentially with limited connectivity | Cache route data where permitted; disclose degraded GPS-only mode |
| Older adult | Legible text, understandable speech, forgiving controls | Large touch targets, adjustable type and speech, no time-critical interaction |
| Admin/operator | Understand service health and investigate incidents | Aggregate telemetry; no routine access to raw camera frames or precise user traces |

Personas overlap; age is not a proxy for ability. Accessibility settings remain user-controlled.

## Goals

- Camera-first, accessible walking UX with text and speech.
- GPS walking guidance as a useful baseline before visual recognition is enabled.
- Evidence-aware landmark matching that can decline to make a match.
- Safe fallback to GPS guidance and relocalization prompts.
- A provider-agnostic and privacy-preserving technical foundation.

## Non-goals for initial releases

- Turn-by-turn driving, cycling, indoor positioning, emergency response, or guaranteed safe routing.
- Autonomous interpretation of arbitrary signs or text as commands.
- Persistent storage of raw camera video or Google-derived imagery.
- Public user accounts, social features, or advertising.
- Enabling visual instructions before field evaluation meets a documented safety target.

## Success measures

Targets below are proposed decision gates, not measured results. Establish baseline and acceptance thresholds before field trials.

| Measure | Definition | Initial gate |
|---|---|---|
| Task completion | Participants reaching the intended entrance without facilitator intervention / started tasks | Establish baseline; target set with field-test participants |
| Wrong-turn rate | Wrong turns per completed route, independently annotated | Establish baseline; reduce across iterations |
| Verified-evidence coverage | Instructions backed by validated localization and route evidence / all instructions | 100% for any visual instruction |
| False-confident-match rate | Confident but incorrect visual matches / all confident visual matches | Must be below an agreed threshold before default enablement |
| Safety comprehension | Participants who can explain that guidance is advisory and crossing requires attention | Gate to be defined in usability protocol |
| Latency and availability | API SLO and p95 localization response | Provisional SLOs in runbook; validate in Phase 1/2 |

## Product boundaries and safety

When visual confidence or signal consistency is insufficient, do not describe a landmark as confirmed. Use GPS-only route guidance, announce uncertainty in plain language, and ask the user to point at a street sign when safe. Near crossings, use audio-only simplified guidance. Never infer arrival from proximity alone; destination entrance confirmation requires route context and an explicit confirmation strategy.

## Release strategy

Phase 1 is GPS-only and local. Visual recognition remains feature-flagged until the Phase 3 dataset, calibration, and false-confident-match gate is met. Read [the delivery tracker](PROGRESS.md) and [open questions](OPEN_QUESTIONS.md) for unresolved decisions.
