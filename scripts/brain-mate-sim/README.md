# Brain-Mate simulation

How the v2 questionnaire was checked and calibrated. Synthetic players with
known traits answer the questions with realistic noise; we measure whether
the scoring gets them right.

- `model.cjs`: the eight traits, the archetype profiles and the question
  loadings. **Keep this in sync with `lib/brainMate/{archetypes,rounds}.ts`.**
- `run.cjs` / `deep.cjs`: accuracy, retake stability, spread, trait accuracy
  (`ROUNDS=3` for the three adaptive duel cards).
- `fit.cjs`: refits the per-archetype offsets so the twelve stay evenly spread
  (writes `bias.json`).
- `cmp.cjs`: the comparison rules, and the derivation of the 12×12 default
  table (writes `matrix.json`).
- `people.cjs`: the person-to-person outcome mix.
- `export.cjs`: prints the norms, offsets, table rows and display quantiles
  that are pasted into `score.ts` and `compare.ts`.
- `verify.cjs`: runs the **app's own** compiled scoring against the same
  synthetic players, to confirm it matches the simulation:

```bash
npx tsc lib/brainMate/{archetypes,rounds,score,compare}.ts --outDir /tmp/bm-app \
  --module commonjs --target es2020 --skipLibCheck --esModuleInterop
APP_DIR=/tmp/bm-app node scripts/brain-mate-sim/verify.cjs
```

Results at launch (2026-11-23): trait scores correlate 0.82–0.85 with the true
traits; clear types recovered 77% and stable on retake 66%; every archetype at
7–11%; outcomes split Power Duo 35%, Friendly Friction 30%, Mind Twins 26%,
Beautiful Chaos 9%.

The simulation assumes people answer the way they actually behave. Once there
are a few hundred real players, refit the norms, offsets and display scales
from **real answers**, and tune the compatibility weights against the
"did this ring true?" feedback.
