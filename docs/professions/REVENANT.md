# Revenant

Native shared-engine profession. Entry point `revenant.html`. `profession.ts` is the stable export and composes the
Core-first tuple from `catalog.ts`. A runtime contains Core plus at most one of Herald, Renegade, Vindicator, or
Conduit. Core owns the always-active energy, legend, weapon, upkeep, trait, state, rules, and UI behavior; each
specialization owns a complete vertical slice under `specializations/<name>/`. Only the selected elite module is present
in a given runtime.

## Data

- Generated identity metadata lives in `data/`; consult its header for snapshot provenance.
- Refresh: `npm run update:profession-data -- --profession Revenant`.
- Runtime simulation is network-free. Energy, upkeep, skill mechanics, modifiers, and other non-API behavior are checked
  into owner-local `skills/`, `traits/`, and `mechanics/` modules.

## Implemented systems

- **Core** — ten terrestrial weapon families with cooldowns, ammo, chains, and damage/condition/control/boon packets; a
  fixed-bar loadout with exactly two legend IDs and a validated starting legend; legend-bar replacement with a
  ten-second in-combat legend-swap cooldown (none out of combat), 50-energy reset, Charged Mists, and swap-sigil
  triggers; continuous five-energy/sec regeneration, explicit skill costs, concurrent upkeep, and timestamped starvation
  cancellation.
- **Herald** — facet upkeep and consume flips.
- **Renegade** — warband actor ownership and Soulcleave strike reactions.
- **Vindicator** — legend skills, trait-selected dodge variants, and Energy Meld; shared legend state remains in Core.
- **Conduit** — affinity, legend-specific Release Potential, and Cosmic Wisdom state.

## Modeling boundaries

Single-target, outgoing-damage focused. Player health stays at 100%; target health remains modeled. Incoming attacks,
active defense, ally healing/barrier/cleanse, pathing, secondary targets, and competitive (PvP/WvW) splits are out of
model.

## Trait ownership

Core trait definitions live in `core/traits/<line>/index.ts`; each elite registers its definitions in `traits/index.ts`.
Definitions own profiles, modifiers, triggers, build contributions, and trait policies. Supporting helpers remain beside
them. `core/mechanics/boundaries.ts` declares ordered trigger points; Core hooks interleave trait and intrinsic on-hit
work, and `core/mechanics/resources.ts` owns Energy and Endurance policies.

Herald mechanics own facets; Facet of Nature's skill owns its boon extension and the Assassin passive siphon. Core
completion rewards run before facet completion and the settled-upkeep observer. Draconic Echo's duration policy belongs
to its trait definition. Renegade's warband, Heroic Command, and Soulcleave behavior live with skills. Conduit mechanics
own form transitions and Affinity; traits own cap rewards and form policies. `data/legends.ts` supplies elite Song of
the Mists IDs without loading their runtime behavior. `energy-cost.ts` composes Core costs with the selected elite's
cost policy.

Build and live queries share `revenantProfession.attributeContributions`, combining module-owned skill/mechanic
attributes and selected trait declarations from equipment seeds. The evaluator uses active patch tuning and live facts.
Spirit Boon's legend profiles remain stable patch targets; Brutal Momentum owns both its baseline critical chance and
additional full-endurance modifier.

Ordered mechanic trigger points preserve execution order where definition-local trait handlers interleave mechanics:

- Core cast rewards precede Herald consumes, Renegade commands, and Conduit form/ammo transitions. Compiled listeners
  publish each reward at its declared boundary. Legend invocations remain Fury, Spirit Boon, Song of the Mists, then
  Invoke Torment.
- Charged Mists samples pre-reset Energy; Enduring Recovery adds to Vigor before the endurance cap. Landed strikes catch
  up Thrill of Combat, consume Battle Scars, apply Vicious Reprisal and Expose Defenses, then consume skill-owned
  Enchanted Daggers charges.
- Draconic Echo retains a facet after consume recharge begins and preserves the original pulse phase. Elevated
  Compassion follows completed upkeep changes; starvation and facet scheduling remain mechanics.
- Renegade samples Lasting Legacy when selecting Fervor and command payloads. All for One grants Energy after Band
  Together is consumed; critical and Fury reactions retain their existing actor attribution and cooldowns.
- Vindicator consumes Reaver's Curse before landing packets, snapshots the existing Forerunner window, then renews it.
  Trait-owned dodge selectors and Energy Meld actions retain the skill scheduler.
- Conduit resolves Mistfire before opening Cosmic Wisdom, then grants Numinous Gift. Swap affinity reset, Lingering
  Determination, Enhanced Embodiment extension, form reselection, and Found Purpose remain ordered. Shared Wisdom
  actions retain their positions around Entity skill transitions; trait recharge helpers run after form-specific base
  recharge selection.

Focused coverage includes resources, task expiry, applied-effect lifetimes, selection, actor ownership, profile
removal/patching, and cross-line build contributions. Player health stays fixed at full health in combat.
