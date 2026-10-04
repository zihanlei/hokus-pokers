# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [1.0.1] - 2026-10-04

### Fixed
**Poker logic & cheating:**
- Spectators could see all non‑folded players' hole cards during active play; the rogue revealCards rule in getPublicState has been removed so spectators now only see cards at showdown (as documented in the README).
- Side‑pot calculation lost chips when a folded player's all‑in level wasn't represented in the levels array. Levels are now computed from allContributors (folded + active) instead of just active, so intermediate all‑in tiers are no longer skipped.
- Orphan side pots (where every eligible player has folded) silently discarded their chips; they now roll to the previous pot's winners (lastWinners fallback), with a proportional refund to contributors as a last‑resort fallback.
- Split pots dropped remainder chips (e.g. a 100‑chip pot split 3 ways paid out 99); the remainder is now distributed one chip at a time to the winners in order.
- All‑in for less than the current bet silently failed (the raise branch returned early). It's now treated as a partial call — the player puts in whatever they have, goes all‑in, and does not reopen betting.
- Sub‑minimum raises were only enforced by the client's min attribute on the input element; the server now validates raiseAmount >= minRaise (except for legitimate all‑ins, which can be for less).
- A short all‑in (less than the minimum raise) incorrectly reset hasActed = false for everyone, reopening betting. Per poker rules, only a full‑size raise reopens betting; the hasActed reset is now gated behind raiseAmount >= minRaise.
- lastRaise was being stored as the total bet amount instead of the raise diff; now stores the diff for future use.
- Initial dealer selection could land on an empty seat after disconnects; startGame now validates the persisted dealerIndex and falls back to the lowest active seat.
**Action handling & UX:**
- processAction silently no‑op'd on invalid actions (wrong turn, can't check, sub‑minimum raise, insufficient chips), clearing the turn timer without restarting it and leaving the player stuck with no error message. All invalid‑action paths now emit 'error-msg' to the offending player and restart the turn timer.
- The check branch rejected invalid checks without telling the player why; now explains "You cannot check — there is a bet to call."
- A dedicated 'allin' server action normalises the All‑In button so short‑stack players no longer hit the silent‑failure path. The client's sendAllIn() now emits action: 'allin' instead of action: 'raise' with an amount.
- change-max-players could be reduced below the current player count, hiding players in the UI; the server now rejects with an explanatory error.
- Timer tick sound had an off‑by‑one (Math.floor(t) !== Math.floor(t + 0.1)); replaced with a _lastTick closure that fires exactly once per whole second.
**Security:**
- Server‑side nickname length validation (12 char max) added to create-room, join-room, and spectate-room, with String() coercion to reject non‑string payloads.
- Chat messages are now validated (must be a string, trimmed, capped at 500 chars) to prevent spam/crash payloads.
- Emoji reactions are whitelisted server‑side (['😂','🔥','👏','😮','💀']) to prevent arbitrary content injection via the emoji-received broadcast.
**Changed:**
- ROOM_TIMEOUT (5 min) was defined but never used. Spectator‑only rooms now auto‑destroy after 5 minutes of idleness, and the destruction timer is cancelled when a new player or spectator joins (join-room, spectate-room, processJoinQueue).
- Bot test harness updated to fall back to check/call when a raise would exceed the bot's stack, preventing tight retry loops on invalid raises.


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


[1.0.1]: https://github.com/zihanlei/hokus-pokers/releases/tag/v1.0.1

[1.0.0]: https://github.com/zihanlei/hokus-pokers/releases/tag/v1.0.0