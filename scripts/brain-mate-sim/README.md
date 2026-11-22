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

## v3 — "A Day in Your Mind" (2026-11-23)

- `final.cjs`: the v3 instrument exactly as shipped (story, this-or-that,
  prioritise, agree/don't, sliders).
- `export3.cjs`: norms (all / choice-style / strength-style), offsets, the
  double-check threshold table and display quantiles pasted into `score.ts`
  and `compare.ts`.
- `v4.cjs` + `eval4.cjs`: design comparisons, including careless-answer
  scenarios (`CARELESS=0.12`) and the double-check variants.
- `ceiling.cjs`, `reach95.cjs`, `beyond.cjs`: the accuracy ceiling. A perfect
  test still repeats the exact archetype only ~66% of the time two weeks
  later. Clearly high/low traits read right 99%; the true archetype is in
  the top-3 mix ~91–93%; a friend's view plus a second session get that to
  ~95%.

v3 at launch, run through the app's own code: clear types 83% (73% on a
retake), true archetype in top-3 mix 91%, 24% of players get double-checks,
archetypes 7–12% each, outcomes PD 34% / FF 31% / MT 26% / BC 9%.
