# Calibration record

## Status

Not yet performed. There is no model, labelled evaluation dataset, calibration method, measured threshold, or approved release target. Do not treat example score fields as calibrated probabilities.

## Required record before visual release

- Dataset provenance, consent, licence, collection conditions, and location/session-separated split
- Model/provider, weights, preprocessing, embedding and OCR versions
- Calibration method and held-out validation design
- Reliability/calibration curves and expected calibration error (ECE)
- Precision/recall, coverage/abstention, false-confident-match rate, confidence intervals
- Results stratified by lighting, weather, occlusion, crowding, device, and location
- Threshold-selection rationale, safety owner approval, limitations, and rollback plan

Until this record is populated and approved, visual instructions must remain disabled by default.
