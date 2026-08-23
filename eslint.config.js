// @ts-check
/**
 * ESLint — flat config.
 *
 * The project had no lint setup at all, which meant two whole classes of bug
 * were invisible:
 *
 *   1. **Rules of hooks.** TypeScript cannot see that a hook sits below an
 *      early `return`, so a screen can compile perfectly and still crash at
 *      runtime when the early return fires. This codebase has hit that
 *      exact bug before.
 *   2. **Unused code.** Dead imports and locals only surfaced by running
 *      `tsc --noUnusedLocals` by hand, which nothing enforced.
 *
 * `eslint-config-expo` supplies the React Native, JSX and import handling.
 * Everything below it is this project's own opinion.
 */

const { defineConfig } = require('eslint/config');
const expoConfig       = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,

  {
    ignores: [
      'dist/*',
      'node_modules/*',
      '.expo/*',
      'android/*',
      'ios/*',
      'scripts/reset-project.js',
    ],
  },

  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      /* ── The rules that catch real bugs ──────────────────────────────── */

      // Non-negotiable: a misplaced hook is a runtime crash TypeScript can't see.
      'react-hooks/rules-of-hooks': 'error',

      // Warn, not error. Several effects here intentionally key on a narrower
      // dependency than the linter wants (e.g. `[customer?.id]` to re-seed a
      // form only when the record changes, not on every field edit) and carry
      // an explicit eslint-disable. Erroring would train people to blanket-
      // disable the rule, which is worse than reading the warnings.
      'react-hooks/exhaustive-deps': 'warn',

      // Writing to a ref during render is a genuine concurrent-rendering bug —
      // a discarded render can leave a value behind. Kept as an error.
      'react-hooks/refs': 'error',

      /* ── Rules turned down, with reasons ──────────────────────────────
         These are React Compiler rules. They're good rules in a plain React
         app; both misfire against libraries this project depends on. Recorded
         here rather than sprinkled as inline disables, so the decision is in
         one place and can be revisited.                                    */

      // OFF: every violation in this codebase is a Reanimated shared value —
      // `scale.value = withSpring(...)`, `dragY.value = e.translationY`. That
      // assignment *is* Reanimated's API; there is no non-mutating form of it.
      // The rule sees a captured object being mutated and can't tell the
      // difference. Leaving it on would mean an inline disable on every
      // animated component we ever write, which is how teams learn to ignore
      // the linter entirely.
      'react-hooks/immutability': 'off',

      // ERROR. Originally downgraded to a warning; that was the lazy call. All
      // five violations turned out to be the same avoidable shape — seeding
      // state from data that had just arrived — and were rewritten using
      // React's "adjusting state when a prop changes" pattern, which updates
      // during render instead. That's also better behaviour: an effect paints
      // the empty form for a frame before filling it in.
      //
      // One exception remains, carrying an inline disable and a reason:
      // use-basket's fetch-on-mount, which is what effects are actually for.
      'react-hooks/set-state-in-effect': 'error',

      // WARN: advisory about what the compiler can memoize, not a correctness
      // problem.
      'react-hooks/preserve-manual-memoization': 'warn',

      /* ── Dead code ───────────────────────────────────────────────────── */

      // `_`-prefixed names stay allowed: destructuring a value you must skip
      // over is legitimate, and renaming it to `_foo` documents the intent.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        args:                    'after-used',
        argsIgnorePattern:       '^_',
        varsIgnorePattern:       '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings:      true,
      }],

      /* ── Correctness ─────────────────────────────────────────────────── */

      // A floating promise in a handler swallows its own rejection. Every async
      // call site here either awaits or is explicitly marked `void`.
      'no-console':  ['warn', { allow: ['warn', 'error'] }],
      eqeqeq:        ['error', 'always', { null: 'ignore' }],
      'no-var':      'error',
      'prefer-const': 'error',
    },
  },
]);
