# Necromancer

Native shared-engine profession. Entry point `necromancer.html`. `profession.ts` composes the Core-first tuple from
`catalog.ts`; a runtime contains Core plus at most one of Reaper, Scourge, Harbinger, or Ritualist. Only the selected
elite's skills, traits, state, and activation behavior are present in that runtime, except elite weapon skills shared
through Core for Weaponmaster Training.

## Data

- API identity snapshot: 2026-07-25 (official GW2 API): 136 skills, 108 traits, and 9 specialization lines. Fifteen
  API-omitted Death Shroud, Lich Form, Ritualist innervate, and simulator action identities live in
  `data/necromancer-supplemental-skills.ts`.
- Refresh: `npm run update:profession-data -- --profession Necromancer` (API metadata only). Simulator timing and
  behavior live in owner-local `skills/` and `mechanics/` modules, and the application catalog is assembled from those
  module contributions.

## Implemented systems

- **Core** — Death Shroud (five-skill bar, minimum entry resource, continuous life-force drain, manual/forced exit,
  entry-skill recharge starting on exit); all terrestrial weapon families with swap validation, ammo, recharge, flips,
  and autoattack chains; persistent minions, command flips, minion attacks/consumption; signets, life siphons,
  corruption self-conditions, and duration-preserving condition transfers; Lich Form; Spear Soul Shards; Weaponmaster
  Training presentation.
- **Reaper** — Reaper's Shroud (full bar, autoattack chain, flips, channels, control, chill), wells, shouts, and Reaper
  trait modifiers.
- **Scourge** — F1-F5, three-charge Manifest Sand Shade, fixed base-health life-force costs, Desert/Sandstorm Shroud,
  and barrier-reactive traits. Scourge is the non-transform exception.
- **Harbinger** — Harbinger Shroud (zero-resource entry, Blight generation to a 25-stack cap, empowered-consumption
  thresholds), elixirs, and Dark Barrage.
- **Ritualist** — Ritualist's Shroud, spirits (Anguish/Wanderlust/Preservation), spirit attacks, Essence Blast,
  innervates, and its supporting traits.
- Static and resolver-time strike/critical/condition/duration/recharge/resource/ shroud/chill/fear/minion/spirit/Blight
  modifiers, with additive vs. multiplicative grouping. Critical procs use the shared seeded critical-hit facts in both
  simulation modes.

Core, Reaper, Harbinger, and Ritualist shroud skills stay visible while the matching shroud is inactive but are disabled
until entry; weapon/slot skills are disabled while a transformed bar is active.

## Trait ownership

All implemented traits have registered `defineTrait` owners: 47 Core, 10 Reaper, 9 Scourge, 11 Harbinger, and 7
Ritualist (84 total). Core groups definitions in `traits/<line>/index.ts`; each elite groups its definitions under its
own `traits/` directory. Core `traits/index.ts` collects line definitions; each elite `traits/index.ts` owns its
definitions and registration array. Core supporting files live inside their line: Spite behavior, Blood Magic
life-steal, Curses `procs.ts`/`modifiers.ts`/`skill-variants.ts`, and Death Magic carapace. Soul Reaping groups attack
procs and the shared Dhuumfire tooltip projection in `procs.ts`, attribute/siphon bonuses in `modifiers.ts`, resource
rewards in `life-force.ts`, and entry/exit rewards in `shroud.ts`. Scourge supplies its cast attribution to the shared
Core Soul Barbs grant instead of requiring a specialization-specific helper in Core. Its `resource-queries.ts` remains
independent of active handlers so resource accounting cannot import its callers. Reactions and shroud-entry dispatch
stay at the shared Core `traits/` level; elite support stays beside its definitions. Native modules expand their
profiles, modifier rules, triggers, recharge rules, hooks, and build contributions once. Build calculators compose
`necromancerProfession.traitBuildAttributes`; the profession build wrapper retains the skill-owned Signet of Spite
passive. `core/initial-state.ts` supplies canonical default trait tuning to state construction without making runtime
state depend on definitions. Generated trait metadata and existing balance-profile identities remain unchanged.

Explicit calls into trait helpers retain the boundaries that matter for state and ordering:

- Core shroud preparation samples Carapace before entry grants and condition removal, then arms Plague Sending.
  Post-entry effects run after specialization callbacks and resource refresh; automatic exits also refresh Soul Barbs.
- Resolved strikes preserve siphon, target-health, Dhuumfire, critical-proc, and recipient-pool ordering. Minion
  multipliers and successful life-force grants call their trait owners before shared resource accounting.
- Attribute dispatchers preserve flat bonuses before conversions and reconcile already-calculated build attributes. Soul
  Battery, Spiteful Fortitude, and Vital Persistence also own the maximum-health-derived resource contributions.
- Scourge keeps shade replacement, expiry, barrier scheduling, and resource spending in mechanics. Trait helpers observe
  the actual barrier or shade event; shroud-like casts call the shared Core trait owners.
- Harbinger keeps Blight accrual, expiry, spending, and snapshots in mechanics. Cascading Corruption observes consumed
  stacks before publication; Doom Approaches owns Dark Barrage's replacement profile and effect transformation.
- Ritualist keeps spirit generations, autonomous schedules, and weapon-spell pools in mechanics. Trait helpers own
  summon rewards, Soul Twisting consumption, Lingering Spirits lifetime policy, allied charges, and spirit multipliers.

Applied siphons, scheduled passive pulses, and committed delayed work keep their existing lifetime rules. Trait helpers
resolve active balance context at execution; removing one patchable effect does not recreate it from base values or
remove independent rewards.

## Modeling boundaries

Single-target, outgoing-damage focused. Ally healing/revival/barrier, dynamic enemy-boon tracking, projectile
interaction, pathing, incoming attacks, enemy positioning, secondary targets, and competitive (PvP/WvW) splits are out
of model; skills whose only effects are in those categories are excluded rather than shown as zero-damage.

Offensive boon-removal consequences use configured target-boon assumptions (for example, Dark Pact's life-force gain);
the simulator does not maintain a changing enemy boon inventory.

Life-force capacity is 69% of maximum health (scales with Vitality; +20% with Soul Battery). Death Shroud drains 3%/sec
and Reaper's Shroud 4%/sec. Damage-resolved target-health feedback is passed back to the scheduler (e.g. Gravedigger
recharges when its hit lands below 50% target health).
