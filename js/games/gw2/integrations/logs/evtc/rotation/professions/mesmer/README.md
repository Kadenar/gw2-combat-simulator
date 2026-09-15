# Mesmer EVTC evidence

Shatter extraction follows explicit rules from pinned EI commit `d7f186c8579a5cab4ed362f0703e49e4a81b9a2a`. Ordinary
buff/effect/damage finders live in [ei-rules.ts](../../ei-rules.ts) and [ei-inference.ts](../../ei-inference.ts); custom
Mesmer shatters and Phase Retreat live in [ei-minions.ts](../../ei-minions.ts).

Core and Mirage shatters use the pinned
[MesmerHelper](https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/ProfHelpers/Mesmer/MesmerHelper.cs)
effect finders. Same-position clone visuals are excluded within 10 ms, with modern ground positions decoded from their
packed signed coordinates. Mind Wrack uses nearby credited damage to distinguish its ammo identity and rejects
Distortion buff evidence. Phase Retreat requires its teleport effect and an owned staff clone first observed within 30
ms, without the Illusionary Leap buff removal that identifies Swap.

EI's synthetic Mirage Cloak ID (`-17`) represents cloak gains from multiple sources. Replay retains a coincident shatter
or Deception without adding a dodge, converts a cloak accompanied by player-owned Mirage Mirror damage into Pick Up
Mirage Mirror, and leaves unidentified gains to ordinary unsupported-action handling. Source actions retain the original
evidence. Initial cloak snapshots do not invent a pre-combat dodge. The condition Mirage benchmark therefore still needs
its missing Phantasmal Warlock, Phase Retreat, and Dodge / Mirage Cloak prepended before the first recorded Chaos Storm.

Mirror attribution accepts player-owned damage from less than 10 ms before to 50 ms after a cloak gain, and requires
exactly one candidate gain in that window. Dodge attribution uses the self-applied buff `69209` within the strict 10 ms
server window, again requiring a unique cloak gain. This source marker is inferred from the supplied raw log; EI's
synthetic cloak ID alone and the generic ambush buff `43694` are insufficient.

Illusionary Ambush attribution requires self-applied False Stealth (`42501`) together with the self-teleport effect
`D7A05478BA0E164396EB90C037DCCF42` in the following 20 ms. A coincident recorded Jaunt or Axes of Symmetry prevents
attribution. Conflicting source evidence remains unresolved. The pinned
[MirageHelper](https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/ProfHelpers/Mesmer/MirageHelper.cs)
omits Illusionary Ambush because teleport effects alone overlap other skills; the raw adapter requires the additional
buff evidence. The supplied `20260602-160832.zevtc` resolves 14 dodges, eight mirror pickups and four Illusionary Ambush
casts, alongside its recorded shatters. Replaying it with the Power Mirage build produces no simulation warnings or
failed casts.

Chronomancer uses the pinned effect GUIDs, stable clone species IDs and final-master ownership. The custom checker
examines nearby same-position boon effects and clone deaths in EI's 20 ms forward window, consuming matched deaths in
reverse-time order. Split Second's represented identity uses the pinned credited-damage check. It does not restore
lifecycle-only casts using arbitrary clustering or guess a shatter when every player signal is missing.

Distortion follows the pinned `MesmerHelper.EffectCastFinder(DistortionSkill)`: its shared Mind Wrack/Distortion effect
requires a Distortion buff application on the same caster within the strict 10 ms server window. EI's `HasGainedBuff`
accepts initial applications as corroboration, but a buff alone cannot create a cast. Core and Mirage are eligible;
Chronomancer requires GW2 build 135242 or later. Virtuoso and Troubadour are excluded.

Shatters are emitted only by implemented EI finders and their declared build/effect gates. Initial Time Anchored state
cannot create Continuum Split through an ordinary buff-gain finder. Unsupported custom predicates remain omitted; there
is no generic shatter damage fallback or reconstructed opening Mimic.

The importer detects casts, not initial clone resources. Simulator clone creation/consumption and manual preparation
remain unchanged. All professions exclude starts at or after encounter end; Mirage has no post-encounter grace period.
