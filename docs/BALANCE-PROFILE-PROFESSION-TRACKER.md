# Balance Profile Profession Tracker

Status: audit complete; implementation not started.

Scope: bring every non-Revenant profession to the balance-preview model used by
[Revenant](../js/professions/revenant/catalog-data.ts). Each profession below is
a standalone work item.

## Shared completion contract

A profession is complete when:

- every module registers its balance profiles through `catalog-data.ts`;
- trait and profession-mechanic values are authorable profiles;
- castable skills use skill declarations, with `skill-variant` profiles only for
  non-castable or state-specific packets;
- modifier constants and meaningful formula parameters are preview-authorable;
- current and preview data remain isolated; and
- tests cover profile metadata, preview overrides, and representative runtime
  behavior, following
  [the Revenant tests](../tests/professions/revenant/revenant.test.js).

If a required value is rejected by the current patch schema, extend
[skill-patch.ts](../js/platform/gw2/skill-patch.ts) narrowly and test it before
continuing that profession.

## Elementalist

Size: Large. Modules: Core, Tempest, Weaver, Catalyst, Evoker. Profiles today: 0.

### Tracked issues

- [ ] `ELE-01` Add profile plumbing to
      [catalog-data.ts](../js/professions/elementalist/catalog-data.ts) and all
      five modules.
- [ ] `ELE-02` Move attunement, endurance, trait-proc, and summon values out of
      [core rules](../js/professions/elementalist/core/rules.ts) and
      [elemental profiles](../js/professions/elementalist/core/elemental-profile.ts).
- [ ] `ELE-03` Profile Tempest overload/shout, Weaver stance, Catalyst sphere,
      and Evoker familiar/enchantment values.
- [ ] `ELE-04` Make seven opaque modifier formulas authorable; replace or expose
      imperative attribute changes in Core, Weaver, Catalyst, and Evoker.
- [ ] `ELE-05` Move castable and summon attack packets into skill declarations
      or explicit skill variants.

### Remediation steps

- [ ] Add stable IDs and `trait`, `mechanic`, or `skill-variant` ownership for
      every migrated value.
- [ ] Wire module profiles into the profession catalog.
- [ ] Add tests for attunement/resource values, one trait proc, one summon
      packet, and one dynamic modifier.
- [ ] Verify the shared completion contract.

## Mesmer

Size: Extra large. Modules: Core, Chronomancer, Mirage, Virtuoso, Troubadour.
Profiles today: 0.

### Tracked issues

- [ ] `MES-01` Add profile plumbing to
      [catalog-data.ts](../js/professions/mesmer/catalog-data.ts) and all five
      modules.
- [ ] `MES-02` Extract clone, phantasm, shatter, blade, ambush, instrument, and
      Syncopate values from specialization mechanics and
      [core mechanics](../js/professions/mesmer/core/mechanics.ts).
- [ ] `MES-03` Extract trait packets from
      [expected-procs.ts](../js/professions/mesmer/core/expected-procs.ts),
      [profession-actions.ts](../js/professions/mesmer/core/profession-actions.ts),
      and specialization handlers.
- [ ] `MES-04` Make twelve opaque modifier formulas authorable; replace or expose
      imperative attribute changes in Core and Troubadour.
- [ ] `MES-05` Normalize handler-owned attacks into skills or skill variants.

### Remediation steps

- [ ] Migrate one actor family at a time: player, clones, phantasms, then
      specialization resources.
- [ ] Wire module profiles into the profession catalog.
- [ ] Add tests for clone/blade/note resources, a phantasm repeat, a trait proc,
      and a dynamic modifier.
- [ ] Verify the shared completion contract.

## Necromancer

Size: Large. Modules: Core, Reaper, Scourge, Harbinger, Ritualist. Profiles
today: 0. Recommended first implementation.

### Tracked issues

- [ ] `NEC-01` Add profile plumbing to
      [catalog-data.ts](../js/professions/necromancer/catalog-data.ts) and all
      five modules.
- [ ] `NEC-02` Split trait/mechanic values from castable, signet, minion, and
      summon values concentrated in
      [core mechanics](../js/professions/necromancer/core/mechanics.ts).
- [ ] `NEC-03` Profile Reaper chill, Scourge shades, Harbinger blight/elixirs,
      and Ritualist spirits/weapon spells.
- [ ] `NEC-04` Make nine opaque modifier formulas authorable; replace or expose
      imperative attribute changes in every module.
- [ ] `NEC-05` Normalize minion commands, shades, elixirs, spirits, and weapon
      spells into skills or skill variants.

### Remediation steps

- [ ] Migrate the centralized Core mechanics first, then each specialization.
- [ ] Wire module profiles into the profession catalog.
- [ ] Add tests for a minion, shade, blight skill, spirit, trait, and dynamic
      modifier.
- [ ] Verify the shared completion contract.

## Ranger

Size: Large. Modules: Core, Druid, Soulbeast, Untamed, Galeshot. Profiles today: 0.

### Tracked issues

- [ ] `RNG-01` Add profile plumbing to
      [catalog-data.ts](../js/professions/ranger/catalog-data.ts) and all five
      modules.
- [ ] `RNG-02` Extract dodge, swap, Opening Strike, boon, poison, and control
      values from [core traits](../js/professions/ranger/core/traits.ts).
- [ ] `RNG-03` Convert autonomous attacks and commands in
      [pets.ts](../js/professions/ranger/core/pets.ts) into supplemental skills
      or skill variants.
- [ ] `RNG-04` Profile Druid avatar/force, Soulbeast stance/proc, Untamed
      unleash/ambush, and Galeshot arrow values.
- [ ] `RNG-05` Make seven opaque modifier formulas authorable; replace or expose
      Core's imperative attribute and condition-duration changes.

### Remediation steps

- [ ] Keep player and pet ownership explicit in every declaration.
- [ ] Wire module profiles into the profession catalog.
- [ ] Add tests for player/pet packets, astral force, arrow regeneration, a
      trait proc, and a dynamic modifier.
- [ ] Verify the shared completion contract.

## Thief

Size: Large. Modules: Core, Daredevil, Deadeye, Specter, Antiquary. Profiles
today: 0.

### Tracked issues

- [ ] `THF-01` Add profile plumbing to
      [catalog-data.ts](../js/professions/thief/catalog-data.ts) and all five
      modules.
- [ ] `THF-02` Extract steal, venom, siphon, dodge, and stealth values from
      [core traits](../js/professions/thief/core/traits.ts) and related handlers.
- [ ] `THF-03` Move Spider Venom, Thousand Needles, Caltrops, and other castable
      data out of [conditions.ts](../js/professions/thief/core/conditions.ts) and
      into skill declarations.
- [ ] `THF-04` Profile Daredevil dodge, Deadeye malice, Specter shadow-force,
      and Antiquary artifact/scuffle values.
- [ ] `THF-05` Make seven opaque modifier formulas authorable; replace or expose
      imperative attribute changes in Core, Deadeye, and Specter.

### Remediation steps

- [ ] Separate resource mechanics from the attacks they trigger.
- [ ] Wire module profiles into the profession catalog.
- [ ] Add tests for initiative, dodge, malice, shadow force, artifact outcomes,
      and a dynamic modifier.
- [ ] Verify the shared completion contract.

## Engineer

Size: Extra large. Modules: Core, Scrapper, Holosmith, Mechanist, Amalgam.
Profiles today: 0.

### Tracked issues

- [ ] `ENG-01` Add profile plumbing to
      [catalog-data.ts](../js/professions/engineer/catalog-data.ts) and all five
      modules.
- [ ] `ENG-02` Extract endurance and trait-proc values from
      [core traits](../js/professions/engineer/core/traits.ts) and mechanics.
- [ ] `ENG-03` Convert autonomous attacks in
      [turrets.ts](../js/professions/engineer/core/turrets.ts) into supplemental
      skill declarations.
- [ ] `ENG-04` Profile Scrapper traits, Holosmith heat/forge, Mechanist mech and
      command, and Amalgam strain/morph values.
- [ ] `ENG-05` Make eight opaque modifier formulas authorable; replace or expose
      imperative attribute changes in Core, Scrapper, Mechanist, and Amalgam.

### Remediation steps

- [ ] Preserve player, turret, and mech ownership in all migrated declarations.
- [ ] Wire module profiles into the profession catalog.
- [ ] Add tests for turret/mech packets, heat thresholds, Amalgam cooldown
      reduction, a trait proc, and a dynamic modifier.
- [ ] Verify the shared completion contract.

## Guardian

Size: Large. Modules: Core, Dragonhunter, Firebrand, Willbender, Luminary.
Profiles today: 0.

### Tracked issues

- [ ] `GRD-01` Add profile plumbing to
      [catalog-data.ts](../js/professions/guardian/catalog-data.ts) and all five
      modules.
- [ ] `GRD-02` Extract virtue, spear illumination, Justice burn, and trait values
      from [core mechanics](../js/professions/guardian/core/mechanics.ts),
      [core traits](../js/professions/guardian/core/traits.ts), and virtues.
- [ ] `GRD-03` Profile Dragonhunter tether, Firebrand page/Ashes/tome,
      Willbender flame/Lethal Tempo, and Luminary forge values.
- [ ] `GRD-04` Add declarative Firebrand modifier rules; replace its imperative
      Imbued Haste attribute changes.
- [ ] `GRD-05` Make four opaque modifier formulas authorable and replace or
      expose remaining Core imperative attribute changes.

### Remediation steps

- [ ] Treat page caps and regeneration in
      [Firebrand state](../js/professions/guardian/specializations/firebrand/state.ts)
      as mechanics, and Imbued Haste in
      [Firebrand rules](../js/professions/guardian/specializations/firebrand/rules.ts)
      as a modifier.
- [ ] Wire module profiles into the profession catalog.
- [ ] Add tests for Justice, page regeneration, Ashes, Willbender flames,
      Radiant Forge variants, and a dynamic modifier.
- [ ] Verify the shared completion contract.

## Warrior

Size: Large. Modules: Core, Berserker, Spellbreaker, Bladesworn, Paragon.
Profiles today: 0.

### Tracked issues

- [ ] `WAR-01` Add profile plumbing to
      [catalog-data.ts](../js/professions/warrior/catalog-data.ts) and all five
      modules.
- [ ] `WAR-02` Extract burst, dodge, Soldier's Focus, critical-proc, and trait
      values from [core traits](../js/professions/warrior/core/traits.ts).
- [ ] `WAR-03` Move burst-tier and ammo-dependent packets from
      [handlers.ts](../js/professions/warrior/core/handlers.ts) into skills or
      skill variants.
- [ ] `WAR-04` Profile Berserker rage/trait, Spellbreaker Insight/tether,
      Bladesworn flow/Dragon Trigger, and Paragon motivation/chant values.
- [ ] `WAR-05` Make ten opaque modifier formulas authorable; replace or expose
      Core's imperative attribute changes.

### Remediation steps

- [ ] Keep resource costs and state thresholds separate from emitted attacks.
- [ ] Wire module profiles into the profession catalog.
- [ ] Add tests for burst tiers, Berserk, tether, Dragon Trigger, Paragon chants,
      and a dynamic modifier.
- [ ] Verify the shared completion contract.

## Suggested implementation order

1. Necromancer
2. Guardian
3. Warrior
4. Thief
5. Elementalist
6. Ranger
7. Engineer
8. Mesmer

The order starts with centralized mechanics and leaves the multi-actor,
handler-heavy professions until the conventions have been exercised.
