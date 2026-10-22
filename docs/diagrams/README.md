# Diagrams

Mermaid sources live in `src/`; generated SVG files live in `rendered/`. Run `npm ci` followed by `make diagrams` to regenerate. Do not hand-edit SVG output.

| Diagram | Source | Render |
|---|---|---|
| Use cases | `src/use-case.mmd` | `rendered/use-case.svg` |
| C4 context | `src/c4-context.mmd` | `rendered/c4-context.svg` |
| C4 containers | `src/c4-container.mmd` | `rendered/c4-container.svg` |
| Components | `src/components.mmd` | `rendered/components.svg` |
| Mobile domain classes | `src/class-mobile.mmd` | `rendered/class-mobile.svg` |
| Backend domain classes | `src/class-backend.mmd` | `rendered/class-backend.svg` |
| Search and route sequence | `src/sequence-route.mmd` | `rendered/sequence-route.svg` |
| Localization sequence | `src/sequence-localize.mmd` | `rendered/sequence-localize.svg` |
| Wrong-turn and reroute sequence | `src/sequence-reroute.mmd` | `rendered/sequence-reroute.svg` |
| Arrival sequence | `src/sequence-arrival.mmd` | `rendered/sequence-arrival.svg` |
| Offline fallback sequence | `src/sequence-offline.mmd` | `rendered/sequence-offline.svg` |
| Session and match state | `src/state-machine.mmd` | `rendered/state-machine.svg` |
| Twelve-step vision activity | `src/activity-pipeline.mmd` | `rendered/activity-pipeline.svg` |
| Data model ERD | `src/erd.mmd` | `rendered/erd.svg` |
| Deployment environments | `src/deployment.mmd` | `rendered/deployment.svg` |
| Network and trust boundaries | `src/trust-boundaries.mmd` | `rendered/trust-boundaries.svg` |
