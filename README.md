# Snake Bot 2.2.0 — endgame search experiment

This update keeps the working engine-synchronized turning mechanism. The changes are in route selection, escape planning, and strategy-related route caching.

## Baseline and experiment

The working baseline is preserved on GitHub as tag/release `v2.1.1` and on `main`. This experiment is developed on `experiment/endgame-search`. The user reports repeated 69-apple baseline runs; their final states have not been analyzed.

Version 2.2.0 keeps the 14 ms planning budget and the exact same turn/tick adapter. Deterministic finishing receives the first 25% of the budget; probabilistic endgame search can run until 70%, leaving the rest for the beam fallback. Search frontiers persist for unchanged states, cached descendants are discovered incrementally after re-rooting, and backup queues deduplicate pending work and share time with expansion. A saturated cache rebuilds from the actual current board. Partial expansions never commit missing chance outcomes. The panel and diagnostics expose expansions, cache size, frontier size, and cache rebuilds.

These changes repair search allocation and recovery; they have not established a higher live win rate.

## What the strategy does

- Searches complete future snake bodies, including the moving tail and Google's delayed-growth rules.
- Gives each legal first turn the same search depth before comparing it with alternatives. A shallow, lucky-looking move cannot beat a more thoroughly checked move merely because computation ran out midway.
- Searches up to a full body-length plus 16 moves, subject to the existing 14 ms computation budget. Open boards can reach a shorter depth; tight boards often allow the full horizon.
- While pursuing a win, scores survival, reachable space, exits, and tail access before pursuing food. Branches that end in a dead end are pruned.
- If checkerboard color counts prove the board cannot be cleared, switches to maximizing additional apples. It continues playing instead of restarting. Dense-board search maximizes expected additional apples across fruit/wall outcomes; a distance tie-break avoids fruitless tail cycles. The fallback prioritizes collectible apples and includes a final meal even when it has no escape. These are bounded searches, so a global maximum is not guaranteed on every board.
- Penalizes body layouts that seal off empty pockets where future fruit may spawn.
- Reserves space for one or two hypothetical extra growth steps during planning, allowing for unknown fruit respawns. This is a conservative planning margin; it does not change the real snake or game rules.
- Keeps a checked route while fruit and walls are unchanged. It validates the next move on every step and replans when the world changes, especially after eating.
- Switches to a separate endgame search when only a few empty cells remain. It enumerates fruit and wall respawn choices under the inspected fixed-count rules, instead of assuming a favorable random placement. Where respawns are forced, it can search all the way to clearing the remaining apples.
- Checks the real body against the exact engine model after each actual step. The input/tick adapter is unchanged by this strategy update.

The strategy is a bounded heuristic search. It cannot know future random fruit or wall positions, and it does not guarantee a win on every board.

## Run or update

If using the installation that was updated during this chat, the source files are already updated. For a downloaded copy:

1. Extract `snake-bot.zip`.
2. Open `chrome://extensions`, enable Developer mode, and **Load unpacked** → choose the folder containing `manifest.json`. When updating an existing copy, replace its files and click **Reload** on that extension card.
3. Refresh the Snake page after updating to remove the old panel and handlers.
4. Open [Google Snake](https://www.google.com/fbx?fbx=snake_arcade). Select **Walls** and **multiple apples**, then click the game's **Play**.
5. Click the extension icon → **Start bot**, before pressing any arrow keys. Keep the Snake tab visible during play.
6. Enable **Auto-run · retry until a win** to repeat completed attempts. An unwinnable board is played for score first; retries happen only after the attempt ends or no legal move remains. The panel shows attempts, best score, average score, and wins. A win stops auto-run. Manual stop, pause, or a hidden tab also stops it.
7. **Stop & menu** ends the attempt. **Save diagnostics** downloads the states, checked routes, planning depth, planning times, and stop reason.

Board size, fruit count, and speed are read from the engine. Small-board Walls with three and many apples has been exercised live at turtle and fast speeds. Other game modes beyond classic/Walls are rejected.

## Turning and game integrity

The bot submits turns immediately before Google's original movement step. The original step runs exactly once. Stopping removes the wrapper. The bot reads the actual board and calls the normal turn method; it does not modify bodies, apples, walls, score, speed, random numbers, collision rules, or victory conditions.

The extension retains `activeTab` and `scripting` permissions, activates only when its icon is clicked on a supported Google URL, and uses bundled scripts in the page's MAIN execution world. It makes no network requests, adds no debugger permissions, and stores no telemetry.

The adapter matches the Google Snake version inspected on 2026-11-03. A future Google update can require an adapter change. Unknown engine structures stop rather than fall back to a guessed clock.

## Verification

Run `node test.cjs`; no installation is required. `node test.cjs --unit` runs the targeted regression/contract checks without the longer simulation suite. Tests cover collision rules, delayed growth, pending-growth tail overlap, closed fruit pockets, route/witness legality, a detour around a recorded live trap, dense moving-body continuations, forced endgame respawns, a forced wall at the vacated tail, both outcomes of a two-position fruit respawn, an unwinnable board played to its nine-apple mathematical maximum, final meals without an escape, tick-wrapper order/restoration, error handling, and pause-versus-win detection. Additional tests exercise deadline exhaustion between search phases, persistent frontier advancement, low-capacity cache recovery, and policy reuse after an actual state transition. Five seeded simulations check selected moves as fruit and walls change.

`LIVE-RESULTS.md` separates actual game results from the approximate simulation comparison. No simulated score should be read as a Google Snake win rate.

## Files

`planner.js`: strategy and exact movement model. `bot.js`: panel and route caching. `engine.js`: existing synchronized turn adapter. `background.js` and `manifest.json`: Chrome packaging. `test.cjs` and the regression JSON files: verification.

API references: [Chrome scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting), [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [Google Snake](https://www.google.com/fbx?fbx=snake_arcade).
