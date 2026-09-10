import { balanceProfileValue } from '#gw2/platform/combat/state/balance-profiles.js';
import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

export type AttributePreviewValues = Record<string, number | string>;
export interface AttributeEffectControl {
  key: string;
  label: string;
  group: string;
  description: string;
  kind:
    | 'boon'
    | 'buff'
    | 'coreTimer'
    | 'specTimer'
    | 'coreStacks'
    | 'specStacks'
    | 'specFlag'
    | 'condition'
    | 'queryTrait'
    | 'passive'
    | 'special';
  field?: string;
  max?: number;
  options?: readonly string[];
  initial?: number | string;
}

/** Declare activation conditions for every profession; combat rules remain the source of attribute formulas. */
export function attributeEffectControls(app: ProfessionAppState): AttributeEffectControl[] {
  const traits = new Map(app.attributeData!.activeTraits.map((trait) => [trait.name, trait]));
  const has = (...names: string[]): boolean => names.some((name) => traits.has(name));
  const skills = selectedSkillNameSet(app.build.selectedSkills);
  const specialization = app.adapter.eliteSpecialization(app.build);
  const weapons = app.attributeWeaponSet === 2 ? app.build.alternateWeapons : app.build.weapons;
  const catalog = app.activeCatalog || app.profession.catalog;
  const controls: AttributeEffectControl[] = [
    {
      key: 'might',
      label: 'Might',
      group: 'Boons',
      kind: 'boon',
      max: 25,
      description: 'stacks; Power / Condition Damage'
    },
    {
      key: 'fury',
      label: 'Fury',
      group: 'Boons',
      kind: 'boon',
      description: '+25% Critical Chance; selected Fury traits'
    }
  ];
  const add = (control: AttributeEffectControl): void => {
    controls.push(control);
  };

  const trait = (name: string, control: Omit<AttributeEffectControl, 'label' | 'group'>): void => {
    if (has(name)) add({ label: name, group: 'Trait conditionals', ...control });
  };

  for (const [key, names] of [
    ['regeneration', ['Energy Amplifier', 'Chaotic Persistence']],
    ['quickness', ['Imbued Haste', 'Be Quick or Be Killed']],
    ['alacrity', ['Flow of Time']],
    ['resolution', ['Righteous Instincts']]
  ] as const) {
    if (has(...names))
      add({
        key,
        label: key[0].toUpperCase() + key.slice(1),
        group: 'Boons',
        kind: 'boon',
        description: names.filter((name) => has(name)).join(', ')
      });
  }

  for (const [name, key, field, maximum, description] of [
    ["Fencer's Finesse", 'fencer', 'fencer', 10, 'Ferocity'],
    ['Explosive Temper', 'explosiveTemper', 'explosive-temper', 10, 'Ferocity'],
    ['Fresh Air', 'freshAir', 'fresh air', 1, 'Ferocity while active'],
    ['Arcane Lightning', 'arcaneLightning', 'arcane lightning', 1, 'Ferocity while active'],
    ['Grand Entrance', 'grandEntrance', 'grand-entrance', 1, 'Critical Chance'],
    ['Danger Time', 'dangerTime', 'danger-time', 1, 'Critical Damage'],
    ['Signet Mastery', 'signetMastery', 'signet-mastery', 5, 'Ferocity'],
    ['Furious', 'furious', 'furious-surge', 25, 'Condition Damage'],
    ['Burst Precision', 'burstPrecision', 'burst-precision', 1, 'Critical Chance / Ferocity']
  ] as const) {
    const max =
      maximum > 1
        ? balanceProfileValue(catalog.balanceProfilesById.get(traits.get(name)?.id!), 'maximumStacks', maximum)
        : undefined;
    trait(name, { key, kind: 'buff', field, max, description });
  }

  trait('Elemental Empowerment', {
    key: 'elementalEmpowerment',
    kind: 'specStacks',
    field: 'elementalEmpowermentExpiries',
    max: balanceProfileValue(
      catalog.balanceProfilesById.get(traits.get('Elemental Empowerment')?.id!),
      'maximumStacks',
      10
    ),
    description: 'stacks; includes Empowered Empowerment'
  });
  trait('Deadly Strength', {
    key: 'carapace',
    kind: 'coreStacks',
    field: 'carapaceExpiries',
    max: 30,
    description: "Death's Carapace stacks"
  });
  trait('Sand Sage', {
    key: 'shade',
    kind: 'specStacks',
    field: 'shades',
    description: 'Shade active; Expertise / Concentration'
  });
  trait('Fortissimo', {
    key: 'instruments',
    kind: 'special',
    max: 4,
    description: 'active instruments; all attributes'
  });
  trait('Brutal Momentum', { key: 'fullEndurance', kind: 'special', description: 'Full endurance' });
  trait('High Caliber', {
    key: 'highCaliber',
    kind: 'queryTrait',
    field: 'High Caliber',
    description: 'Within range; Critical Chance'
  });
  trait("Assassin's Presence", {
    key: 'assassinsPresence',
    kind: 'queryTrait',
    field: "Assassin's Presence",
    description: 'Periodic Fury window active'
  });
  if (has('Revealed Training', 'Hidden Killer'))
    add({
      key: 'revealed',
      label: 'Revealed',
      group: 'Trait conditionals',
      kind: 'coreTimer',
      field: 'revealedUntil',
      description: 'Revealed Training / Hidden Killer'
    });
  trait('Hidden Killer', {
    key: 'stealth',
    kind: 'coreTimer',
    field: 'stealthUntil',
    description: 'Stealthed; Critical Chance'
  });

  for (const [spec, key, label, kind, field, description] of [
    ['Berserker', 'berserk', 'Berserk', 'specFlag', 'berserkActive', 'Power / Condition Damage and Berserk traits'],
    ['Soulbeast', 'beastmode', 'Beastmode', 'specFlag', 'beastmodeActive', 'Pet archetype and merged trait attributes'],
    ['Amalgam', 'evolved', 'Evolved', 'specTimer', 'evolvedUntil', 'All attributes; includes Double Helix'],
    ['Amalgam', 'titanic', 'Titanic Strain', 'specTimer', 'titanicUntil', 'Additional attributes from Might'],
    ['Conduit', 'cosmicWisdom', 'Cosmic Wisdom', 'specTimer', 'cosmicWisdomUntil', 'Bolstered Bonds attributes']
  ] as const) {
    if (specialization === spec) add({ key, label, kind, field, group: 'Other buffs', description });
  }

  if (app.adapter.id === 'necromancer' && specialization !== 'Scourge') {
    add({
      key: 'shroud',
      label: 'Shroud',
      group: 'Trait conditionals',
      kind: 'special',
      description:
        ['Death Perception', "Reaper's Onslaught"].filter((name) => has(name)).join(', ') ||
        'Shroud-dependent attributes'
    });
  }

  if (app.adapter.id === 'elementalist') {
    const options = ['None', 'Fire', 'Water', 'Air', 'Earth'];
    add({
      key: 'attunement',
      label: 'Attunement',
      group: 'Attunement',
      kind: 'special',
      options,
      description: 'Attunement-dependent traits'
    });
    if (specialization === 'Weaver')
      add({
        key: 'secondaryAttunement',
        label: 'Secondary attunement',
        group: 'Attunement',
        kind: 'special',
        options,
        description: 'Elemental Polyphony'
      });
    if (specialization === 'Evoker')
      add({
        key: 'evokerElement',
        label: 'Familiar element',
        group: 'Attunement',
        kind: 'special',
        options,
        description: 'Enhanced Potency'
      });
    if (weapons.includes('Hammer'))
      add({
        key: 'crescentWind',
        label: 'Crescent Wind',
        group: 'Other buffs',
        kind: 'buff',
        field: 'hammer air orb',
        description: '+15% Critical Chance'
      });
    const conjures = [
      ['Conjure Fiery Greatsword', 'Fiery Greatsword'],
      ['Conjure Lightning Hammer', 'Lightning Hammer'],
      ['Conjure Frost Bow', 'Frost Bow']
    ]
      .filter(([skill]) => skills.has(skill))
      .map(([, weapon]) => weapon);
    if (conjures.length)
      add({
        key: 'conjure',
        label: 'Conjured weapon',
        group: 'Other buffs',
        kind: 'special',
        options: ['None', ...conjures],
        description: 'Attributes while wielded'
      });
  }

  if (has('Heavy Metal', 'Superiority Complex', 'Ferocious Strikes'))
    add({
      key: 'targetHealth',
      label: 'Target health (%)',
      group: 'Trait conditionals',
      kind: 'special',
      max: 100,
      initial: 100,
      description: 'Health-dependent critical bonuses'
    });
  if (has('Empire Divided', 'Keen Observer', 'Twin Fangs'))
    add({
      key: 'playerHealth',
      label: 'Player health (%)',
      group: 'Trait conditionals',
      kind: 'special',
      max: 100,
      initial: has('Keen Observer') ? 50 : 100,
      description: ['Empire Divided', 'Keen Observer', 'Twin Fangs'].filter((name) => has(name)).join(', ')
    });
  if (has("Hunter's Tactics", 'Twin Fangs'))
    add({
      key: 'flanking',
      label: 'Flanking',
      group: 'Trait conditionals',
      kind: 'special',
      description: 'Positional Critical Chance'
    });
  if (has('Unsuspecting Foe', 'Superiority Complex'))
    add({
      key: 'controlled',
      label: 'Target disabled',
      group: 'Trait conditionals',
      kind: 'special',
      description: 'Control-dependent critical bonuses'
    });
  trait('Pure Strike', { key: 'boonless', kind: 'special', description: 'Target has no boons' });
  for (const [name, required] of [
    ['Torment', 'Wicked Corruption'],
    ['Burning', 'Radiant Power'],
    ['Bleeding', 'Deep Strikes'],
    ['Weakness', 'Superior Elements'],
    ['Vulnerability', 'Decimate Defenses']
  ]) {
    if (has(required))
      add({
        key: `condition:${name}`,
        label: `Target ${name}`,
        group: 'Target conditions',
        kind: 'condition',
        field: name,
        max: name === 'Vulnerability' ? 25 : undefined,
        description: required
      });
  }

  // Only name conditions needed by other traits; the remaining types share one count.
  const namedConditions = controls.filter((control) => control.kind === 'condition').length;
  trait('Target the Weak', {
    key: 'targetTheWeak',
    kind: 'special',
    max: CANONICAL_TARGET_CONDITIONS.length - namedConditions,
    description: namedConditions ? 'Other condition types; Critical Chance' : 'Condition types; Critical Chance'
  });

  for (const name of [
    'Bane Signet',
    'Signet of Wrath',
    'Signet of Fire',
    'Signet of the Wild',
    'Signet of Spite',
    'Signet of Domination',
    'Signet of Midnight',
    'Signet of Might',
    'Signet of Fury',
    "Assassin's Signet"
  ]) {
    if (skills.has(name))
      add({
        key: `passive:${name}`,
        label: name,
        group: 'Other buffs',
        kind: 'passive',
        field: name,
        initial: 1,
        description: 'Passive attributes active'
      });
  }

  return controls;
}

/** Clamp preview inputs and discard effects that are unavailable on this build or weapon set. */
export function normalizeAttributePreview(
  controls: readonly AttributeEffectControl[],
  input: Readonly<Record<string, unknown>>
): AttributePreviewValues {
  return Object.fromEntries(
    controls.map((control) => {
      const raw = input[control.key] ?? control.initial ?? control.options?.[0] ?? 0;
      const value = control.options
        ? control.options.includes(String(raw))
          ? String(raw)
          : control.options[0]
        : Math.max(0, Math.min(control.max ?? 1, Number.isFinite(Number(raw)) ? Math.trunc(Number(raw)) : 0));
      return [control.key, value];
    })
  );
}
