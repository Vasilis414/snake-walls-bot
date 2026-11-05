# Validation notes — 2026-11-03

The strategy variants exercised in the actual Google game reached 61 and 63 apples on small-board Walls with many apples at fast speed. No complete Google Snake win has been verified. These observations are individual runs, not a measured win rate.

The final score-maximization change has targeted regression coverage. A completely occupied 4×4 imbalanced fixture permits at most nine additional apples by the checkerboard path bound; the policy collects all nine. A recorded unwinnable live position now produces a scoring move instead of resetting. A final apple with no escape is retained by both the endgame search and the beam fallback. The final revision is ready for user testing; those regression results are not additional live-game wins.

The synchronized turn adapter remains unchanged. Its contract tests check original-step order, exactly one original step, restoration, and exception handling. Strategy tests cover the actual delayed-growth and tail collision rules.

An earlier eight-seed approximate simulation comparison averaged 58.875 apples without a growth margin versus 61.75 with it. That comparison predates the final endgame and scoring revisions and does not establish their win rate. The bundled five-seed smoke simulation also uses approximate wall placement; it checks legality rather than reproducing all Google randomness.

## 2.1.2 compatibility update

This update retains the 2.1.1 strategy and maps the renamed fields in the Google build inspected on 5 November. Legacy/current adapter regression checks pass. The same adapter was exercised live in the 2.2.1 experiment, which completed attempts at 55 and 61 apples. Those results are not measurements of the baseline strategy; the owner-reported repeated 69s were with 2.1.1 before Google's update.
