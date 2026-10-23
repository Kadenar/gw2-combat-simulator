# Mesmer

Native shared-engine profession. Entry point `mesmer.html`. `profession.ts` composes the Core-first tuple from
`catalog.ts`; a runtime contains Core plus at most one of Chronomancer, Mirage, Virtuoso, or Troubadour. Core owns the
shared shatter, phantasm, clone, weapon, and trait behavior; each specialization owns a vertical slice under
`specializations/<name>/`.

## Data

- Generated identity metadata lives in `data/`; consult its header for snapshot provenance.
- Refresh: `npm run update:profession-data -- --profession Mesmer`, which regenerates the metadata-only
  `data/mesmer-api-metadata.ts`.
- Simulation-affecting coefficients, activation times, cooldowns, strike counts, condition durations, and state machines
  live in owner-local Core and specialization `skills/` and `mechanics/` modules. Runtime simulation is network-free.

## Architecture notes

Ordinary effects use shared declarative scheduling; shatters, bladesongs, instruments, phantasms, ambushes, flips,
resources, and Continuum actions select registered `mesmer.*` handler strategies by stable skill/trait ID. Display names
are labels only — routing, resource causes, flips, trait decisions, and timing all key off IDs, and legacy name
rotations are resolved at the build-migration boundary.

Core trait definitions live in `core/traits/<line>/index.ts`; each elite registers its definitions in `traits/index.ts`.
Definitions own profiles, modifiers, build contributions, triggers, and recharge policies. Shared mechanics own illusion
entities, resources, snapshots, and packet emission. `family-resources.ts` binds clone scheduling and resource rewards
without creating an import cycle through `family-mechanics.ts`.

Phantasm attacks deliver strikes, conditions, controls, and bonus strikes from the same prepared execution record,
including repeated attacks; simultaneous conversions are batched. Troubadour snapshots instrument eligibility at cast
start and consumes that snapshot at commitment.

Preserve the explicit reaction order: Master Fencer, Sharper Images, then Fencer's Finesse on critical hits; Maim before
Illusionary Membrane after shatters; Deadly Blades before Jagged Mind for Virtuoso. Master of Fragmentation transforms
specialization effects before emission. Applied buffs retain their granted lifetime independently of current selection.
Chronomancer owns Continuum restoration in mechanics and delayed explosions in `traits/time-bomb.ts`; Troubadour owns
instrument policies in its trait definitions and snapshots in mechanics.

Cry of Pain augments native F2 confusion by one stack and one-third duration; Troubadour uses two stacks and 50%
duration for the player's Flute performance. Afterimages retain the base application. Illusionary Membrane grants Chaos
Aura from F2, including Flute, and reacts to every self Chaos Aura gain, including Chaos Armor and ethereal combos. Each
aura extends the condition-damage buff by five seconds, capped at fifteen seconds remaining.

Build and live queries share `mesmerProfession.attributeContributions`. The evaluator starts from equipment seeds and
combines module declarations with selected trait attributes, using active balance profiles and live stacks/boons.
Detached previews select contributions from their own inputs. Intrinsic Harmonize and Symphonic Resonance remain
independent of trait selection.

## Implemented systems

- **Core** — weapon sets with a ten-second in-combat swap recharge (none out of combat), clone/phantasm/shatter
  mechanics, ID-keyed phantasm timing, and profession-specific resolver reactions such as Ineptitude.
- **Chronomancer** — Continuum Split (restores cooldown state but not clones) and its shatter/alacrity behavior.
- **Mirage** — a continuous endurance pool, Mirage Cloak dodges, and ambush attacks.
- **Virtuoso** — bladesongs that require and spend all stocked blades, Jagged Mind bleeding, and Bloodsong blade gains.
- **Troubadour** — instruments resource, Crescendo, Dagger, and its dodge/ ambush interactions.

## Modeling boundaries

Single-target, outgoing-damage focused. Player health stays at 100%; target health remains modeled. Phantasm and clone
travel time uses fixed delays. Critical-condition applications consume the shared seeded critical-hit facts in both
simulation modes. Bloodsong grants blades at each five-stack bleeding-application threshold. Ally healing, barriers,
control damage, stealth, and defensive effects stay outside the damage total; boon/distortion applications are still
emitted. Mirage and Troubadour use the shared 100-point endurance pool, 50-point dodges, and continuous regeneration at
5/sec or 7.5/sec with Vigor. Troubadour's Flute adds 1.25 endurance/sec while playing, including when Vigor is active;
Honorable Rogue restores 50 endurance without losing partial regeneration. Competitive (PvP/WvW) splits are out of
model.
