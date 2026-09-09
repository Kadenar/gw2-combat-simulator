# Mesmer EVTC evidence

Shatter extraction follows explicit rules from pinned EI commit `d7f186c8579a5cab4ed362f0703e49e4a81b9a2a`. Ordinary
buff/effect/damage finders live in [ei-rules.ts](../../ei-rules.ts) and [ei-inference.ts](../../ei-inference.ts); custom
Chronomancer shatters live in [ei-minions.ts](../../ei-minions.ts).

Chronomancer uses the pinned effect GUIDs, stable clone species IDs and final-master ownership. The custom checker
examines nearby same-position boon effects and clone deaths in EI's 20 ms forward window, consuming matched deaths in
reverse-time order. Split Second's represented identity uses the pinned credited-damage check. It does not restore
lifecycle-only casts using arbitrary clustering or guess a shatter when every player signal is missing.

Other shatters are emitted only by listed ordinary finders and their declared build/effect gates. Initial Time Anchored
state cannot create Continuum Split through an ordinary buff-gain finder. Unsupported custom predicates remain omitted;
there is no generic shatter damage fallback or reconstructed opening Mimic.

The importer detects casts, not initial clone resources. Simulator clone creation/consumption and manual preparation
remain unchanged. All professions exclude starts at or after encounter end; Mirage has no post-encounter grace period.
