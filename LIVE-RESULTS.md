# Validation notes — 2026-11-03

The strategy variants exercised in the actual Google game reached 61 and 63 apples on small-board Walls with many apples at fast speed. No complete Google Snake win has been verified. These observations are individual runs, not a measured win rate.

The final score-maximization change has targeted regression coverage. A completely occupied 4×4 imbalanced fixture permits at most nine additional apples by the checkerboard path bound; the policy collects all nine. A recorded unwinnable live position now produces a scoring move instead of resetting. A final apple with no escape is retained by both the endgame search and the beam fallback. The final revision is ready for user testing; those regression results are not additional live-game wins.

The synchronized turn adapter remains unchanged. Its contract tests check original-step order, exactly one original step, restoration, and exception handling. Strategy tests cover the actual delayed-growth and tail collision rules.

An earlier eight-seed approximate simulation comparison averaged 58.875 apples without a growth margin versus 61.75 with it. That comparison predates the final endgame and scoring revisions and does not establish their win rate. The bundled five-seed smoke simulation also uses approximate wall placement; it checks legality rather than reproducing all Google randomness.
