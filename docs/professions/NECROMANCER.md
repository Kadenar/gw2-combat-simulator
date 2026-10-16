# Necromancer

Native shared-engine profession. Entry point `necromancer.html`. `profession.ts` composes the Core-first tuple from
`catalog.ts`; a runtime contains Core plus at most one of Reaper, Scourge, Harbinger, or Ritualist. Only the selected
elite's skills, traits, state, and activation behavior are present in that runtime, except elite weapon skills shared
through Core for Weaponmaster Training.

## Data

- Generated identity metadata lives in `data/`; consult its header for snapshot provenance. API-omitted Death Shroud,
  Lich Form, Ritualist innervate, and simulator action identities live in `data/necromancer-supplemental-skills.ts`.
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

Core trait definitions live in `core/traits/<line>/index.ts`; each elite registers its definitions under `traits/`.
Definitions own profiles, modifiers, triggers, recharge rules, and attribute contributions. Helpers stay beside their
owners: Death Magic's `carapace.ts`, Soul Reaping's `procs.ts` and `resource-queries.ts`, and Curses' `availability.ts`.
Resource queries remain independent of active handlers to avoid importing their callers.

`core/mechanics/availability.ts` checks trait replacement, minion ownership, weapon flips, Lich, and shroud access in
that order. Lingering Curse owns its scepter replacement gate in `core/traits/curses/availability.ts`. Successful Lich
and shroud-entry checks short-circuit the remaining form restrictions; life-force denials preserve the resource
controller's retry deadline.

`necromancerProfession.attributeContributions` combines module and selected trait declarations for build and live
queries. Core skill passives come from `core/skills/attribute-passives.ts`; `core/initial-state.ts` uses prepared
attributes and the active balance context to construct resources.

Explicit calls into trait helpers retain the boundaries that matter for state and ordering:

- Core shroud preparation samples Carapace before entry grants and condition removal, then arms Plague Sending.
  Post-entry effects run after specialization callbacks and resource refresh; automatic exits also refresh Soul Barbs.
- Resolved strikes preserve siphon, target-health, Dhuumfire, critical-proc, and recipient-pool ordering. Minion
  multipliers and successful life-force grants call their trait owners before shared resource accounting.
- Attribute queries start from equipment seeds and apply native contributions through the shared conversion rules.
  Carapace grants and queries use Flesh of the Master's active stack cap; Deadly Strength owns the conversion from those
  stacks. Soul Battery, Spiteful Fortitude, and Vital Persistence own the maximum-health-derived resource contributions.
- Scourge's `mechanics/shades.ts` owns shade replacement, expiry, manifestation, and the common shade strike.
  `skills/shroud-actions.ts` owns cleanse, control, shroud effects, and delayed barriers. Barrier traits settle before
  their boon samples the live party audience; Core still owns life-force spending. Hooks preserve shroud invocation
  before shade commitment.
- Harbinger's `mechanics/blight.ts` owns Blight accrual, expiry, spending, publication, and shroud lifecycle callbacks.
  `skills/elixir-actions.ts` and `skills/shroud-actions.ts` own launch and impact work, retaining the selected
  empowerment and post-spend Blight snapshots. Cascading Corruption observes consumed stacks before publication; Doom
  Approaches owns Dark Barrage's replacement profile and effect transformation. `effect-state.ts` observes the same
  retained state used by combat.
- Ritualist keeps spirit generations, autonomous schedules, and weapon-spell pools in mechanics. Trait helpers own
  summon rewards, Soul Twisting consumption, Lingering Spirits lifetime policy, allied charges, and spirit multipliers.

Applied siphons, scheduled passive pulses, and committed delayed work keep their existing lifetime rules. Trait helpers
resolve active balance context at execution; removing one patchable effect does not recreate it from base values or
remove independent rewards.

## Modeling boundaries

Single-target, outgoing-damage focused. Player health stays at 100%; target health remains modeled. Ally
healing/revival/barrier, dynamic enemy-boon tracking, projectile interaction, pathing, incoming attacks, enemy
positioning, secondary targets, and competitive (PvP/WvW) splits are out of model; skills whose only effects are in
those categories are excluded rather than shown as zero-damage.

Offensive boon-removal consequences use configured target-boon assumptions (for example, Dark Pact's life-force gain);
the simulator does not maintain a changing enemy boon inventory.

Life-force capacity is 69% of maximum health (scales with Vitality; +20% with Soul Battery). Death Shroud drains 3%/sec
and Reaper's Shroud 4%/sec. Damage-resolved target-health feedback is passed back to the scheduler (e.g. Gravedigger
recharges when its hit lands below 50% target health).
