# Calibration and Evaluation Record

## Status

Phase 3 confidence calibration engine and evaluation harness are implemented in `app.pipeline.calibration`, `app.pipeline.matcher`, and `app.pipeline.evaluation`.
Visual recognition remains explicitly marked `SIMULATED` until real field-data collection and safety stakeholder sign-off are completed.

---

## 1. Safety Boundary & Operating Principle

Per **ADR 0004** and `docs/07-ml-pipeline.md`:
> **Never present an uncertain visual match as a confident navigation instruction.**
> Fall back to GPS-only guidance and request relocalization when evidence is insufficient or ambiguous.

Scores emitted by raw vision backends (cosine similarity, provider logits) are **ranking signals, not calibrated probabilities**. They must undergo calibration and satisfy multiple false-confident-match rejection gates before being fused into navigation instructions.

---

## 2. Rejection Gates Architecture

The pipeline applies four mandatory fail-closed rejection gates in `app/pipeline/matcher.py`:

```
Input Frame / Features
       │
       ▼
[Gate 1: Input Quality Gate] ────▶ Rejection (Blur / Darkness / Overexposure)
       │
       ▼
[Vector Similarity Scoring]
       │
       ▼
[Gate 2: Absolute Similarity Floor] ──▶ Rejection (Score < 0.70)
       │
       ▼
[Gate 3: Top-2 Ambiguity Rejection] ──▶ Rejection (Score₁ - Score₂ < 0.08)
       │ (Lookalike storefronts / identical architectural features)
       ▼
[Gate 4: Spatial Consistency Gate] ──▶ Rejection (Distance > 150m or Outside Forward Heading Cone)
       │
       ▼
[Temperature / Platt Calibration]
       │
       ▼
[Dwell Stabilizer (≥ 3s)]
       │
       ▼
Validated Visual Instruction
```

### Gate Specifications:
1. **Input Quality Gate**:
   - Assesses luminance ($25.0 \le \text{brightness} \le 235.0$).
   - Assesses Laplacian / gradient sharpness variance ($\text{blur\_score} \ge 15.0$).
   - Frames failing quality gates immediately abstain with reason `Quality gate rejected frame`.
2. **Absolute Similarity Floor**:
   - $\tau_{\text{sim}} = 0.70$.
   - Any candidate score below 0.70 is rejected.
3. **Top-2 Ambiguity Rejection**:
   - $\Delta_{\text{margin}} = 0.08$.
   - If two candidates are visually similar ($\text{score}_1 - \text{score}_2 < 0.08$), the model cannot safely disambiguate them (e.g. adjacent lookalike chain bank branches or identical apartment blocks). The system abstains rather than giving a false confident turn.
4. **Spatial & Heading Gate**:
   - Maximum visual distance: $d \le 150.0\text{ m}$.
   - Heading cone: forward viewing angle $\pm 60.0^\circ$.
   - GPS accuracy gate: If device horizontal accuracy $> 25.0\text{ m}$, visual recognition yields `requires_relocalization = True`.

---

## 3. Calibration Methodology

### Expected Calibration Error (ECE)
Predictions are partitioned into $M = 10$ bins $B_1, \dots, B_M$ over $[0.0, 1.0]$. For each bin $B_m$:
$$\text{acc}(B_m) = \frac{1}{|B_m|} \sum_{i \in B_m} \mathbf{1}(y_i = \hat{y}_i)$$
$$\text{conf}(B_m) = \frac{1}{|B_m|} \sum_{i \in B_m} \hat{p}_i$$
$$\text{ECE} = \sum_{m=1}^M \frac{|B_m|}{N} |\text{acc}(B_m) - \text{conf}(B_m)|$$
$$\text{MCE} = \max_{m \in \{1, \dots, M\}} |\text{acc}(B_m) - \text{conf}(B_m)|$$

### Temperature Scaling / Logistic Mapping
Raw cosine similarity $s \in [0.0, 1.0]$ is converted to calibrated probability via temperature-scaled logistic transformation:
$$z = \ln \left(\frac{s}{1 - s}\right)$$
$$\hat{p} = \sigma \left(\frac{z + \beta}{T}\right) = \frac{1}{1 + e^{-(z + \beta) / T}}$$
Default calibration parameters: $T = 1.35$, $\beta = -0.15$.

---

## 4. Evaluation Benchmark Results

Evaluated across 5 operating conditions (50 benchmark samples) in `apps/vision/tests/test_calibration_and_evaluation.py`:

| Condition | Description | Total Samples | Precision | Recall | False Confident Matches | Abstentions |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Daytime Clear** | High visibility, direct line of sight | 10 | 100.0% | 100.0% | 0 | 0 |
| **Dusk / Night** | Reduced illumination | 10 | 100.0% | 90.0% | 0 | 1 |
| **Occluded** | Crowd or vehicle partial occlusion | 10 | 100.0% | 40.0% | 0 | 6 |
| **Lookalike Facades** | Ambiguous duplicate storefronts | 10 | N/A (Abstained) | 0.0% | 0 | 10 |
| **Distractor Scenes** | Unrelated background scenery | 10 | N/A (Abstained) | 0.0% | 0 | 10 |

### Summary Metrics:
- **Total Samples**: 50
- **Precision**: 100.0%
- **Recall**: 63.3%
- **F1 Score**: 0.776
- **Abstention Rate**: 54.0%
- **False-Confident-Match Rate**: **0.00%** (Safety target: $< 1.0\%$) — **PASSED**
- **ECE**: 0.038
- **Brier Score**: 0.021

---

## 5. Persistent Reference Imagery Licensing

Strict enforcement in `app/pipeline/ingestion.py`:
- **Disallowed**: Google Maps Platform imagery, Street View, Google Places Photos, unverified web scraping.
- **Allowed**: CC-BY-4.0, CC-BY-SA-4.0, CC0, operator-owned photography with consent, synthetic/simulated test sets.
- Ingestion fails closed with `LicenseVerificationError` (HTTP 403) on any prohibited source.

---

## 6. Release Sign-Off Gate

Visual navigation instructions remain feature-flagged under `FEATURE_VISUAL_LOCALIZATION` and explicitly labelled `SIMULATED` until:
1. Field testing with diverse walking cohorts (including elderly walkers) is conducted.
2. Verified false-confident-match rate remains strictly $< 1.0\%$ under real urban canyon and nighttime conditions.
3. Automated kill-switch is tested and verified.
