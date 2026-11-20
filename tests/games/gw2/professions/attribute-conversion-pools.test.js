import assert from 'node:assert/strict';
import test from 'node:test';

import { attributeContext } from '#gw2/platform/attributes/evaluation.js';
import { REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';

const selfConversions = [
  'Concentration',
  'Condition Damage',
  'Expertise',
  'Ferocity',
  'Healing Power',
  'Power',
  'Precision',
  'Toughness',
  'Vitality'
]
  .map((attribute) => `${attribute} to ${attribute}`)
  .join(', ');

// Flat grants name the conversions they feed. Conversion entries name their source pool.
const EXPECTED = {
  elementalist: {
    "Aeromancer's Training": { none: 'Ferocity' },
    'Arcane Lightning': { all: 'Ferocity' },
    'Burning Rage': { none: 'Condition Damage' },
    'Elemental Empowerment': {
      none: 'Concentration, Condition Damage, Expertise, Ferocity, Healing Power, Power, Precision, Toughness',
      common: 'Vitality to Vitality'
    },
    'Elemental Enchantment': { none: 'Concentration' },
    'Elemental Polyphony': { none: 'Condition Damage, Ferocity, Healing Power, Power' },
    'Elemental Refreshment': { all: 'Vitality' },
    'Empowering Flame': { none: 'Power' },
    'Enhanced Potency': { none: 'Condition Damage, Ferocity' },
    'Ferocious Winds': { common: 'Precision to Ferocity' },
    'Fresh Air': { none: 'Ferocity' },
    'Gathered Focus': { none: 'Concentration' },
    'Power Overwhelming': { none: 'Power' },
    'Raging Storm': { none: 'Ferocity' },
    'Signet of Fire': { none: 'Precision' },
    'Soothing Power': { none: 'Vitality' },
    'Strength of Stone': { common: 'Toughness to Condition Damage' }
  },
  engineer: {
    Amalgam: { eligible: selfConversions, none: 'Condition Damage, Power' },
    'Applied Force': { none: 'Power' },
    'Blast Shield': { eligible: 'Power to Vitality' },
    'Chemical Rounds': { all: 'Condition Damage' },
    'Compounding Chemicals': { none: 'Concentration' },
    'Energy Amplifier': { none: 'Healing Power, Power' },
    'Explosive Temper': { none: 'Ferocity' },
    'Hybrid Vigor': { none: 'Vitality' },
    'Kinetic Accelerators': { eligible: 'Power to Concentration' },
    'No Scope': { none: 'Ferocity' },
    'Thermal Vision': { all: 'Expertise' }
  },
  guardian: {
    'Bane Signet': { none: 'Power' },
    'Conceited Curate': { all: 'Vitality' },
    "Defender's Dogma": { all: 'Vitality' },
    'Force of Will': { all: 'Vitality' },
    'Honorable Staff': { none: 'Concentration' },
    'Kindled Zeal': { eligible: 'Power to Condition Damage' },
    "Light's Gift": { all: 'Vitality' },
    'Power for Power': { all: 'Power' },
    'Power of the Virtuous': { eligible: 'Vitality to Condition Damage' },
    'Radiant Power': { none: 'Ferocity' },
    'Right-Hand Strength': { none: 'Precision', all: 'Power' },
    'Searing Pact': { all: 'Condition Damage' },
    'Signet of Wrath': { none: 'Condition Damage' },
    'Stalwart Defender': { none: 'Toughness' },
    'Zealous Blade': { none: 'Power', all: 'Power' }
  },
  mesmer: {
    'Chaotic Persistence': { all: 'Concentration, Expertise' },
    "Fencer's Finesse": { none: 'Ferocity' },
    Fortissimo: { eligible: selfConversions },
    'Quiet Intensity': { common: 'Vitality to Ferocity' },
    'Sharpening Sorrow': { none: 'Expertise' },
    'Signet of Domination': { none: 'Condition Damage' },
    'Signet of Midnight': { none: 'Expertise' }
  },
  necromancer: {
    'Alchemic Vigor': { all: 'Vitality' },
    'Awaken the Pain': { none: 'Power' },
    'Boon of Creation': { none: 'Concentration' },
    'Dark Gunslinger': { eligible: 'Vitality to Expertise' },
    'Deadly Strength': { none: 'Condition Damage, Power' },
    'Fell Beacon': { eligible: 'Condition Damage to Expertise' },
    'Furious Demise': { 'profession-only': 'Precision' },
    'Implacable Foe': { eligible: 'Vitality to Ferocity' },
    'Last Rites': { all: 'Healing Power' },
    'Lingering Curse': { none: 'Condition Damage' },
    "Reaper's Onslaught": { none: 'Ferocity' },
    'Sand Sage': { all: 'Concentration, Expertise' },
    'Signet of Spite': { none: 'Power' },
    'Spiteful Fortitude': { common: 'Power to Vitality' },
    'Target the Weak': { eligible: 'Precision to Condition Damage' },
    'Twisted Medicine': { eligible: 'Vitality to Concentration' },
    'Vital Persistence': { 'profession-only': 'Vitality' }
  },
  ranger: {
    Ambidexterity: { none: 'Condition Damage' },
    Arachnophobia: { none: 'Expertise' },
    'Honed Axes': { none: 'Ferocity' },
    'Lingering Magic': { none: 'Concentration' },
    'Natural Fortitude': { none: 'Vitality' },
    'Pack Alpha': { none: 'Condition Damage, Power, Precision, Toughness, Vitality' },
    "Pet's Prowess": { none: 'Ferocity' },
    'Signet of the Wild': { none: 'Ferocity' },
    Soulbeast: { none: 'Ferocity, Power' },
    "Strider's Strength": { all: 'Power' },
    'Vicious Quarry': { none: 'Ferocity' },
    Wellspring: { common: 'Power to Healing Power' }
  },
  revenant: {
    'Bolstered Bonds': {
      none: 'Concentration, Condition Damage, Expertise, Ferocity, Healing Power, Power, Precision, Toughness, Vitality'
    },
    'Elevated Compassion': { common: 'Power to Concentration' },
    'Life Attunement': { all: 'Healing Power', eligible: 'Healing Power to Concentration' },
    'Reinforced Potency': { all: 'Concentration' },
    'Seething Malice': { none: 'Condition Damage' },
    'Versed in Stone': { common: 'Toughness to Power' }
  },
  thief: {
    "Assassin's Signet": { none: 'Power' },
    'Be Quick or Be Killed': { none: 'Power, Precision' },
    Core: { none: 'Power' },
    'Dagger Training': { all: 'Power' },
    'Deadly Ambition': { all: 'Condition Damage' },
    "Marauder's Resilience": { eligible: 'Power to Vitality' },
    'No Quarter': { none: 'Ferocity' },
    'Practiced Tolerance': { eligible: 'Precision to Ferocity' },
    Premeditation: { none: 'Concentration' },
    Preparedness: { all: 'Expertise' },
    'Revealed Training': { none: 'Power' },
    'Second Opinion': { all: 'Condition Damage', eligible: 'Condition Damage to Healing Power' },
    'Signet of Agility': { none: 'Precision' },
    'Silent Scope': { all: 'Precision' },
    'Staff Master': { all: 'Power' },
    'Strength of Shadows': { eligible: 'Vitality to Expertise' },
    "Swindler's Equilibrium": { all: 'Power' }
  },
  warrior: {
    "Attacker's Insight": { none: 'Ferocity, Power, Precision' },
    'Axe Mastery': { all: 'Ferocity' },
    Berserker: { none: 'Condition Damage, Power' },
    Blademaster: { all: 'Condition Damage, Expertise' },
    'Blood Reaction': { eligible: 'Power to Condition Damage, Precision to Ferocity' },
    'Burst Precision': { all: 'Ferocity' },
    'Deep Strikes': { none: 'Condition Damage' },
    'Forceful Greatsword': { all: 'Power' },
    Furious: { none: 'Condition Damage' },
    'Great Fortitude': { eligible: 'Power to Ferocity, Power to Vitality' },
    'Guns and Glory': { none: 'Ferocity' },
    'Inspiring Implements': { none: 'Concentration' },
    'Pinnacle of Strength': { none: 'Power' },
    'Roaring Reveille': { none: 'Concentration' },
    'Signet Mastery': { all: 'Ferocity' },
    'Signet of Fury': { none: 'Precision' },
    'Signet of Might': { none: 'Power' },
    'Vigorous Shouts': { eligible: 'Power to Healing Power' },
    'Wounding Precision': { eligible: 'Precision to Expertise' }
  }
};

// Each owner declares which flat grants feed conversions and which pool a conversion reads.
function recordEffects(owners, owner, contributions, catalog) {
  for (const contribution of contributions) {
    for (const effect of contribution?.attributeEffects ?? []) {
      const name = effect.passiveSkillId ? catalog.skillsById.get(effect.passiveSkillId).name : owner;
      const pools = (owners[name] ??= {});
      const pool = effect.kind === 'flat' ? effect.feedsConversions : effect.input;
      const attribute = effect.kind === 'flat' ? effect.to : `${effect.from} to ${effect.to}`;
      (pools[pool] ??= new Set()).add(attribute);
    }
  }
}

function conversionPools(modules, catalog) {
  const owners = {};
  const selectedSkillIds = catalog.skills.map(({ id }) => id);
  const selectedTraitIds = catalog.traits.map(({ id }) => id);
  for (const module of modules) {
    const config = {
      specialization: module.id,
      selectedSkillIds,
      selectedTraitIds,
      selectedPet: 'Pig',
      selectedLegends: [LEGEND.ENTITY],
      boons: { quickness: true, fury: true, regeneration: true, protection: true }
    };
    const timeline = { buffStacksAt: () => 1, skillOnCooldownAt: () => false };
    const facts = attributeContext(
      { config, time: 0, timeline, events: [] },
      { catalog, modifierRulesById: new Map() }
    );
    for (const trait of module.traitDefinitions ?? []) {
      const name = trait.name ?? module.data.traits.find(({ id }) => id === trait.id).name;
      recordEffects(owners, name, [trait.attributes?.(facts), trait.grantedAttributes?.(facts)], catalog);
    }

    // Merging and entering Berserk expose grants that the inactive build cannot return.
    if (module.attributes) {
      recordEffects(owners, module.id, module.attributes(facts), catalog);

      if (module.id === 'Soulbeast')
        recordEffects(
          owners,
          module.id,
          module.attributes({ ...facts, loadout: { ...facts.loadout, merged: true } }),
          catalog
        );

      if (module.id === 'Berserker')
        recordEffects(
          owners,
          module.id,
          module.attributes({
            ...facts,
            runtime: { profession: { specialization: { kind: module.id, state: { berserkUntil: 10 } } } }
          }),
          catalog
        );
    }
  }

  return Object.fromEntries(
    Object.entries(owners).map(([name, pools]) => [
      name,
      Object.fromEntries(Object.entries(pools).map(([pool, attributes]) => [pool, [...attributes].sort().join(', ')]))
    ])
  );
}

for (const [profession, expected] of Object.entries(EXPECTED)) {
  test(`${profession} attribute grants and conversions use their declared pools`, async () => {
    const data = await import(`#gw2/professions/${profession}/catalog.js`);
    assert.deepEqual(conversionPools(data[`${profession}NativeModules`], data[`${profession}Catalog`]), expected);
  });
}
