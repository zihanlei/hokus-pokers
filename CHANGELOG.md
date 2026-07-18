# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-18

### Added
- Full multiplayer Texas Hold'em game with Socket.IO (Node.js + Express)
- Host game creation with custom blinds, max players, starting chips, and timer settings
- Join by room code or browse public rooms with refresh
- Spectator mode with request‑to‑join (host approval required)
- Real‑time turn timer (20s default) with auto‑fold on timeout
- Side pot calculation and display (main pot + side pots with eligible players)
- Responsive table layout (desktop and mobile compatible)
- Synthesised sound effects via Web Audio API (cards, chips, timer, win/lose)
- Floating emoji reactions (YouTube‑live style) with picker
- Player and spectator chat separation (players cannot see spectator chat)
- Host controls: kick, edit chips, change password, toggle rebuys, change max players, end game
- In‑memory room persistence (no database required for Phase 1)

[1.0.0]: https://github.com/zihanlei/hokus-pokers/releases/tag/v1.0.0