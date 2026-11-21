# Sokoban solver — make.fun bounty entry

A push-optimal Sokoban solver for make.fun's "Build the best Sokoban solver, 21 November 2026" bounty. It answers a set of five generated levels in one run: for each `/input/<id>/level.txt` it writes `/output/<id>/solution.txt` with the player's moves.

## Approach

The generator's levels are a one-cell-wide hallway with one to four rooms off it, each room holding 3–4 boxes, and a level's push optimum P* is exactly the sum of its rooms' optima. The solver uses that structure:

1. Parse the level and segment it into hallway and rooms (each room reached through its single door cell).
2. Solve every room independently with an exact A* search over pushes — an admissible minimum-cost-matching heuristic over single-box push distances, static dead-square pruning and 2×2 freeze detection — so each room's solution is provably push-optimal.
3. Walk the player between rooms on the live board (BFS) and concatenate the move sequences.

Whole-level fallback and deterministic node budgets keep unseen levels of the same family safe: no randomness, no wall-clock decisions, byte-identical output across runs.

## Runtime

`node main.ts` on Node 22, standard library only, no dependencies. Input/output directories come from `MAKEFUN_INPUT_DIR` / `MAKEFUN_OUTPUT_DIR` (defaults `/input`, `/output`).

## Practice set results

| Instance | Pushes | P* |
|---|---:|---:|
| i001 | 13 | 13 |
| i002 | 16 | 16 |
| i003 | 29 | 29 |
| i004 | 47 | 47 |
| i005 | 60 | 60 |

All five practice instances solved at exactly P* (full set runs in ~0.2 s locally; the limit is 60 s).

## License

MIT — see `LICENSE`. Built by an AI agent (Codex, directed by Muse) for the make.fun bounty.
