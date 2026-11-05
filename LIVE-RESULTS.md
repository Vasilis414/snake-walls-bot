# Validation notes — 2026-11-03

The strategy variants exercised in the actual Google game reached 61 and 63 apples on small-board Walls with many apples at fast speed. No complete Google Snake win has been verified. These observations are individual runs, not a measured win rate.

The final score-maximization change has targeted regression coverage. A completely occupied 4×4 imbalanced fixture permits at most nine additional apples by the checkerboard path bound; the policy collects all nine. A recorded unwinnable live position now produces a scoring move instead of resetting. A final apple with no escape is retained by both the endgame search and the beam fallback. The final revision is ready for user testing; those regression results are not additional live-game wins.

The synchronized turn adapter remains unchanged. Its contract tests check original-step order, exactly one original step, restoration, and exception handling. Strategy tests cover the actual delayed-growth and tail collision rules.

An earlier eight-seed approximate simulation comparison averaged 58.875 apples without a growth margin versus 61.75 with it. That comparison predates the final endgame and scoring revisions and does not establish their win rate. The bundled five-seed smoke simulation also uses approximate wall placement; it checks legality rather than reproducing all Google randomness.

## 2.2.0 experiment

The user subsequently reported repeated 69-apple runs with the 2.1.1 baseline. The baseline is preserved as the GitHub v2.1.1 release. Version 2.2.0 changes search budget allocation, saturated-cache recovery, and incremental frontier work. The synchronized engine adapter is byte-for-byte unchanged. Targeted tests and live trial results must be distinguished from evidence of a higher win rate.

First 2.2.0 live trial: small 10×9 board, Walls, many apples, fast speed (89.10 ms engine interval). It collected 66 apples over 177 steps, then had no legal move after switching to score maximization. Diagnostics recorded 14 endgame policy decisions, a maximum cache size of 2,043 states, no capacity rebuild in that attempt, and a maximum planner time of 14.1 ms. No engine/body mismatch was reported. This single result does not demonstrate improvement over the user's repeated 69-apple baseline runs.

## 2.2.1 Google compatibility — 5 November 2026

Google's current build renamed the controller's snake, fruit, walls, growth, interval, score and lifecycle fields. The adapter now supports both inspected layouts; the fresh-board check uses normalized state. The strategy and original tick wrapper remain unchanged. All targeted checks and five seeded legality smoke simulations pass. New tests cover current/legacy controller discovery, state mapping, normal turns, restoration, inactive/poisoned fruit, and pause-versus-win flags.

Live diagnostics from the current Google build recorded completed attempts at 55 apples (292 steps) and 61 apples (250 steps), including an automatic retry. A third attempt was safely interrupted at 58 apples after an intervening direction change between ticks caused the normal turn method to queue a different turn. The guard was retained. These runs verify compatibility, not an improved win rate.
