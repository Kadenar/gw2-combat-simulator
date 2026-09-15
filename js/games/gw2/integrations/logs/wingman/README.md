# gw2wingman import

Imports public gw2wingman `/log/<id>` links. Fetches gw2wingman's `getJson` endpoint, reshapes the
result into the same document `../dps-report/parser.ts` validates, then hands off to the unchanged
dps.report reconstruction pipeline (`../dps-report/rotation/reconstruct.ts`). Every selection, phase
filtering, catalog-matching and warning rule is therefore identical to a dps.report import; only the
fetch and reshape step differs.

gw2wingman's `getJson` does not return the raw Elite Insights JSON dps.report's `getJson` exposes. It
returns EI's HTML-embed log format instead: `player.details.rotation` is one array per phase, each
cast a `[atSeconds, skillId, durationMs, statusId, quickness]` tuple relative to that phase's start,
and `skillMap` entries use EI's older short field names (`aa`, `isSwap`, `notAccurate`, `traitProc`,
`gearProc`, `unconditionalProc`) instead of dps.report's `autoAttack`/`isNotAccurate`/`isTraitProc`/
`isGearProc`/`isUnconditionalProc`.

`normalize.ts` reverses both differences: it takes the phase with the largest span (the full-fight
phase always covers every cast, so it is the html format's only per-player superset) and regroups its
flat tuple list by skill id into the `{ id, skills: [{ castTime, duration, timeGained, quickness }] }`
shape `parser.ts` expects, converting phase-relative seconds to absolute milliseconds. `statusId`
(EI's `AnimationStatus`: Unknown, Reduced, Interrupted, Full, Instant) becomes a `timeGained` sign
(`+1`/`-1`/`0`) so `reconstruct.ts`'s `castStatus()` classifies reduced/interrupted/completed casts
exactly as it would from a raw dps.report response; `duration <= 0` still drives instant detection
independent of that sign, unchanged from the dps.report path.

`url.ts` recognizes only `https://gw2wingman.nevermindcreations.de/log/<id>` links, not bare ids —
gw2wingman and dps.report ids can look identical, so requiring the host avoids ambiguity with
`../dps-report/url.ts`'s bare-id support.
