# LandmarkNav

LandmarkNav is a mobile-first navigation concept for people who prefer direct, plain-language guidance over map reading. Its core safety rule is that an uncertain landmark match must never produce a confident instruction.

## Status

**Phase 0: architecture and documentation.** Application code and live landmark recognition have not started. Read [the progress tracker](docs/PROGRESS.md) and [the open questions](docs/OPEN_QUESTIONS.md) before implementation.

## Product brief

See [`prompt.md`](prompt.md) for the full product requirements. The design targets Android first, with an iOS-ready React Native client, a TypeScript/Fastify API, and a provider-agnostic Python vision service.

## Documentation

- [Vision and scope](docs/00-vision-and-scope.md)
- [Product requirements](docs/01-PRD.md)
- [System requirements](docs/02-SRS.md)
- [Architecture](docs/03-architecture.md)
- [API contract](docs/04-api/README.md)
- [Security and privacy](docs/06-security-and-privacy.md)
- [Progress and gates](docs/PROGRESS.md)

## Planned local commands

The `bootstrap`, `up`, and `verify` commands become operational in Phase 1. `make diagrams` renders source diagrams after the pinned tooling is installed with `npm ci`. See [contributing](CONTRIBUTING.md).

## Safety notice

Navigation guidance is advisory and does not guarantee safety. Users must follow local laws, traffic controls, and their own judgment. The app must not encourage screen use while crossing.
