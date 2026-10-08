# Revenant

Native shared-engine profession. Entry point `revenant.html`. `profession.ts` is the stable export and composes the
Core-first tuple from `catalog.ts`. A runtime contains Core plus at most one of Herald, Renegade, Vindicator, or
Conduit. Core owns the always-active energy, legend, weapon, upkeep, trait, state, rules, and UI behavior; each
specialization owns a complete vertical slice under `specializations/<name>/`. Only the selected elite module is present
in a given runtime.

## Data

- API identity snapshot: 2026-07-28 (official GW2 API).
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
- **Vindicator** — Alliance-side state and explicit dodge selection.
- **Conduit** — affinity, legend-specific Release Potential, and Cosmic Wisdom state.

## Modeling boundaries

Single-target, outgoing-damage focused. Incoming attacks, active defense, ally healing/barrier/cleanse, pathing,
secondary targets, and competitive (PvP/WvW) splits are out of model.

## Trait ownership

Core and all four elites register 67 trait definitions: Core 32, Herald 6, Renegade 11, Vindicator 8, and Conduit 10.
Each implemented trait owns its balance profiles, modifiers, triggers, build contributions, and imperative helpers under
its module's `traits/` directory. Core definitions live in `traits/<line>/index.ts` for Corruption, Devastation,
Invocation, Retribution, and Salvation; the Core index preserves their registration order. Each elite defines and
registers its traits in `traits/index.ts`. Generated selection metadata remains in `data/`; module profiles retain
shared mechanics and skill variants.

Core runtime callers import helpers from their owning trait-line folders. Assassin's Presence, Vicious Reprisal, and
small Salvation helpers stay beside their definitions; substantial Battle Scars and invocation behavior have support
files within their lines. Core `traits/dispatch.ts` retains trait-only sequencing; mixed skill and trait on-hit behavior
lives in `mechanics/reactions.ts`. Energy and Endurance policies live in `mechanics/resources.ts`. Renegade's Heroic
Command, warband, and Soulcleave behavior lives with skills. Conduit separates form transitions, Affinity policy/gains,
and form attack/release skills. Its cap reward and Herald's Draconic Echo duration remain trait policies called at the
existing mechanic boundary. Herald's Draconic Echo duration helper is co-located in `traits/index.ts`;
`mechanics/facets.ts` owns facet scheduling and eligibility, and `modifiers.ts` assembles passive attributes. Conduit's
`traits/cap-rewards.ts` remains separate to avoid a cycle through Affinity gains. Elite substantial helpers can still
use `traits/behavior.ts`. The Alliance Spirit Boon profile identifier lives directly in `family-state.ts` so its
initialization is independent of Vindicator behavior. Renegade and Vindicator compose their attribute callbacks directly
in `module.ts`.

The build finalizer composes `revenantProfession.traitBuildAttributes`; static contributions and live adjustments retain
their existing provenance. Spirit Boon's legend-specific profiles now belong to its single Core definition; their stable
profile IDs remain patch targets.

Explicit owner calls preserve execution order where trait reactions interleave mechanics:

- Core cast rewards precede Herald consumes, Renegade commands, and Conduit form/ammo transitions. The dispatcher
  prevents double publication. Legend invocations remain Fury, Spirit Boon, Song of the Mists, then Invoke Torment.
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
