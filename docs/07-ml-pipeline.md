# 07 — Landmark matching and ML pipeline

## Status and safety boundary

Visual landmark recognition is planned and not implemented. Any stub or offline mock must be labelled `SIMULATED`. Scores are ranking/confidence signals, not probabilities; no visual instruction may be enabled until calibration and field-evaluation gates pass.

## Pipeline

The conceptual stages named in the brief are expanded below into twelve independently testable steps:

1. Candidate retrieval using a bounded spatial search.
2. Candidate filtering by heading cone and route corridor.
3. Reference-image lookup with source and license checks.
4. Input quality gate for blur, lighting, and usable visual signal.
5. Query-frame embedding.
6. OCR/sign-text extraction as optional evidence.
7. Visual/text candidate matching.
8. Spatial-consistency check against GPS accuracy and route progress.
9. GPS, heading, route, and visual fusion.
10. Confidence calibration for the deployed model/domain.
11. Hysteresis and stabilization using minimum dwell time.
12. Constrained instruction generation from validated route data.

These steps map to the brief's conceptual pipeline: candidate retrieval and corridor filtering; reference lookup; embedding and OCR; matching; spatial checks; fusion; calibration; stabilization; and instruction generation. Stages receive typed/versioned inputs and return typed outputs. Invalid output is rejected; never display unvalidated model-generated prose. OCR text is untrusted evidence, not an instruction to the model or system.

1–2. Candidate retrieval: start with an upper-bound radius only, then narrow by route corridor, heading, cell, and text/visual evidence.
3. Reference lookup: retrieve only permitted, provenance-tracked references; fail closed on unknown license.
4–6. Quality gate, embedding, and OCR: compute query-frame features once; quality-gate optional text and never interpret it as control text. Persistent reference embeddings require source/model license approval.
7. Matching: compare candidate evidence and produce ranked candidates with provenance.
8. Spatial consistency: compare candidate geometry to GPS accuracy, heading, route progress, and prior stable state.
9. Fusion: combine signals; explicit disagreement sets relocalization required.
10. Calibration: calibrate by model version and deployment domain using held-out labelled data.
11. Stabilization: require a minimum dwell and hysteresis before switching a candidate or instruction.
12. Instruction generation: template-based constrained text from validated route/maneuver data; no unconstrained free-form claims.

## Provider abstraction

Define a `VisionProvider` boundary so provider changes are configuration plus contract conformance, not domain rewrites. Adapters may include a hosted multimodal model, local embedding model, or OCR service, but capabilities, licensing, pricing, retention, and coverage must be verified before selection. Provider output is not trusted.

## Contract and abstention

The versioned `LocalizationEstimate` includes `landmark_name`, `match_confidence`, `location_confirmed`, `distance_to_landmark_meters`, `next_instruction`, `next_maneuver`, `distance_to_next_maneuver_meters`, `requires_relocalization`, `evidence[]`, and `model_version`. Evidence describes source/type, timestamp, and validation status without embedding a raw frame. All fields are validated. A low-quality frame, empty candidate set, provider outage, disagreement, or invalid schema yields an abstention and GPS-only fallback.

## Efficiency and licensing

Deduplicate near-identical frames on device; sample adaptively; apply blur/lighting gates. Send compact features or one selected downscaled frame only with consent. Cache candidates by spatial cell/heading and memoize stable results only if the source license allows it. Route-corridor prefetch and asynchronous reference ingestion must be disabled for unverified sources.

## Evaluation and calibration

Build a labelled, consented dataset spanning daytime/night, weather, crowds, occlusion, similar facades, camera quality, urban canyons, and route positions. Store a manifest and metadata, not raw personal images in the repository. Split data by location and capture session to avoid leakage. Report precision/recall at operating thresholds, false-confident-match rate (primary safety metric), coverage/abstention, calibration curves and ECE, plus per-condition performance.

Calibration method, data provenance, model and preprocessing versions, threshold selection, confidence intervals, and known limitations must be documented in `docs/ml/CALIBRATION.md` before visual release. There is no approved numerical safety threshold yet; agree it with safety and field-test stakeholders before evaluating for release.

## Release gate and monitoring

Visual guidance remains feature-flagged until evaluation meets the documented target across relevant conditions, field tests pass, and a kill switch is verified. Monitor match-confidence distributions, evidence coverage, abstention, user corrections, and false-match reports. Do not use aggregate calibration to imply a particular match is certain.
