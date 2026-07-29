# Guardian specific mechanics

This directory owns Guardian behavior that cannot be represented by the shared
declarative effect schema alone. The surrounding modules have distinct roles:

- `../skill-mechanics.js` declares direct, unconditional cast packets and
  skill-level timing, recharge, ammo, page cost, and availability metadata.
- `../handler-mechanics.js` stores immutable formulas and profiles for
  triggered effects and state machines.
- This directory validates profession state, mutates scheduler or resolver
  state, emits derived events, and exposes callbacks used by `../contract.js`,
  `handlers.js`, and `../../resolver/event-handlers.js`.

## Module map

| File | Responsibility | Main state/events |
| --- | --- | --- |
| `handlers.js` | The only catalog-facing skill-handler registry. | Wraps feature callbacks in explicit `augment` or `replace` strategies for virtues, tomes, Radiant Forge, radiant weapons, Glaring Burst, and weapon swap. |
| `radiant-forge.js` | Luminary Radiant Forge validation, entry/exit, automatic expiry, radiant-weapon selection, Glaring Burst, and forge-specific cooldown and weapon-swap behavior. | Owns `radiantForge`, its entry/expiry timestamps, `radiantWeapon`, and `radiantWeaponsUsed`; consumes armed radiant-virtue bonuses and emits forge transition, `weapon_set`, and `sigil_swap` events. |
| `spear.js` | Janthir Wilds spear Illuminated behavior. | Owns the armed Illuminated expiry, Symbol of Luminance window, and Daybreaking Slash chain display state; adjusts existing Helio Rush/Gleaming Disc packets, adds Solar Storm shards, and emits proc events. |
| `tomes.js` | Firebrand tome gating, stowing, shared page payment/regeneration, and Ashes of the Just. | Owns `activeTome`, page balance/timing, and Ashes charges/internal interval; emits tome state events and reacts to resolver damage events. |
| `traits.js` | Guardian mechanics whose timing or output depends on traits. | Handles light fields and aura detonations, Luminary weapon/virtue interactions, stance buffs, symbol traits, lesser symbols, Righteous Instincts, and Effulgent Stance. It contains both scheduler-side producers and chronological resolver reactions. |
| `virtues.js` | Specialization-specific F1-F3 selection, virtue activation, Renewed Focus, and Justice burning. | Opens Firebrand tomes, emits virtue state events, owns resolver `virtueReadyAt` and Justice hit counters, and applies active or passive Justice burns. |
| `weapon-state.js` | Normal weapon-bar bookkeeping. | Owns autoattack-chain progression and flip windows, blocks the normal weapon bar while a tome or forge is active, toggles the equipped weapon set, and emits `weapon_set`. |

## Lifecycle wiring

`../contract.js` connects scheduler-side callbacks to the shared engine in a
fixed order:

- Availability can wait for Firebrand page regeneration.
- Cast validation checks general Guardian availability, then virtues, tomes,
  Radiant Forge, and normal weapon state.
- Time advancement regenerates tome pages and expires Radiant Forge and
  Illuminated state.
- After each cast, weapon state, spear state, and trait state update in that
  order.
- Cast completion clears Radiant Forge's provisional entry cooldown so the
  final cooldown can be calculated when the forge ends.
- Newly scheduled damage events are observed for symbol trait effects.

`../../resolver/event-handlers.js` wires the chronological half of the model:

- Virtue, tome, forge, and stance timeline events update resolver state.
- Damage reactions run Ashes, Guardian trait reactions, and Justice in that
  order.
- Buff reactions maintain Resolution and Righteous Instincts.
- Resolver-generated delayed work, such as Righteous Instincts ticks, is
  reinserted into the ordered event queue.

## Skill-handler strategies

Catalog skills refer to the IDs registered in `handlers.js`. An augmenting
handler runs alongside the skill's declarative `effects`; a replacing handler
owns the complete cast output and therefore requires an empty declarative
effect list.

Guardian uses augmenting handlers for virtues, tome pages, and radiant weapons
because those callbacks add state changes or conditional packets to ordinary
effects. Renewed Focus, tome stow, Radiant Forge transitions, Glaring Burst,
and weapon swap are replacements because their output is entirely
state-driven.

## State handoff

Scheduler state is mutable and lives at `context.state.profession`. It owns
castability, resources, cooldown changes, weapon chains, mode transitions,
spear windows, and scheduler-side trait state. State changes that affect
chronological resolution are emitted as namespaced timeline events.

Resolver state lives at `context.profession` and starts from time zero rather
than from the scheduler's final snapshot. It replays virtue, tome, forge, and
stance events while applying damage and buff reactions in timestamp order.
`state.js` projects resolver-owned counters and internal cooldowns back into the
reported final state without overwriting scheduler-owned resources.

When adding mechanics:

- Put direct cast packets in `skill-mechanics.js`.
- Put triggered formulas and immutable profiles in `handler-mechanics.js`.
- Keep runtime branching in the owning feature module here.
- Register catalog-facing behavior in `handlers.js` with an explicit
  augment/replace strategy.
- Emit a namespaced timeline event when resolver-time damage depends on a
  scheduler-side state transition.
- Queue resolver-generated follow-ups with `enqueueOrdered`.
- Preserve actor ownership (`player`, `summon`, or `effect`) so traits, sigils,
  relics, and result attribution trigger correctly.
