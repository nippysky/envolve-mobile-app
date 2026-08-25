# EnvolveCare Plus — mobile

Expo / React Native app for pharmacy customers, sales staff and drivers.
It talks to the Next.js backend in `evolve-pharma`; there is no second API.

Administrators are deliberately blocked from signing in here — administration
lives in the web console. See `src/contexts/AuthContext.tsx`.

---

## Environment

Exactly one variable is read anywhere in the app:

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of the backend, no trailing slash |

It reaches the app from **one of two places, never both**:

| Where | Used by | File |
|---|---|---|
| `.env.local` | local dev (`npx expo start`) | gitignored |
| `eas.json` → `build.<profile>.env` | every EAS build | committed |

**EAS build servers do a clean checkout and never see `.env.local`.** A profile
without an `env` block falls through to the hardcoded default in
`src/constants/api.ts` — which is how a build ends up pointing at the wrong
backend while still appearing to work. Every profile therefore sets it
explicitly.

It is a public URL, not a secret, so it belongs in `eas.json` rather than EAS
Secrets. Reserve secrets for values that must never appear in a client bundle —
and note that anything prefixed `EXPO_PUBLIC_` is inlined into the bundle by
definition, so it can never be secret.

### Changing the backend URL

`EXPO_PUBLIC_*` values are inlined at **build time**, not read at runtime.
Editing `eas.json` alone changes nothing already installed. Two ways forward:

```bash
# A. Over the air — no store round-trip, no reinstall.
#    Works because every profile declares a `channel`.
eas update --channel preview --message "Point at the new API"

# B. New build — required if anything native changed
#    (icons, splash, permissions, SDK, new native module).
eas build --profile preview --platform android
```

Option A is usually what you want for a URL change: it ships a new JS bundle,
and the URL is part of that bundle.

---

## Builds

```bash
# Preview APK — installable on any Android device, no Play Store
eas build --profile preview --platform android

# Development client — pairs with a local Metro server
eas build --profile development --platform android

# Production AAB — for the Play Store
eas build --profile production --platform android
```

Profiles are defined in `eas.json`:

| Profile | Android artifact | Channel | Use |
|---|---|---|---|
| `development` | APK (debug) | `development` | dev client, local Metro |
| `preview` | APK | `preview` | share with testers |
| `production` | AAB | `production` | Play Store |

### Native assets

Icons and the splash screen are generated from `assets/images/` at prebuild
time. `android/` and `ios/` are gitignored — EAS regenerates them from
`app.json`, so local changes there are not what gets built.

Anything touching icons, splash, permissions or native modules needs a **new
build**; an OTA update cannot change them.

---

## Checks

```bash
npx tsc --noEmit    # types
npm run lint        # eslint (expo config + rules-of-hooks as errors)
```

Both are expected to pass with zero errors before a build.
