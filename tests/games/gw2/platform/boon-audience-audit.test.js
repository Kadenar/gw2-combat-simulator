import assert from 'node:assert/strict';
import test from 'node:test';
import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { buildBoonGeneration } from '#gw2/platform/results/boon-generation.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { MESMER_SKILL_IDS as M, MESMER_TRAIT_IDS as MT } from '#gw2/professions/mesmer/data/ids.js';
import { RANGER_SKILL_IDS as R } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { THIEF_SKILL_IDS as T, THIEF_TRAIT_IDS as TT } from '#gw2/professions/thief/data/ids.js';
import { ENGINEER_TRAIT_IDS as ET } from '#gw2/professions/engineer/data/ids.js';
import { GUARDIAN_TRAIT_IDS as GT } from '#gw2/professions/guardian/data/ids.js';
import { REVENANT_LEGEND_IDS as L, REVENANT_TRAIT_IDS as VT } from '#gw2/professions/revenant/data/ids.js';

const families = {
  mesmer: mesmerProfession,
  ranger: rangerProfession,
  thief: thiefProfession,
  engineer: engineerProfession,
  guardian: guardianProfession,
  warrior: warriorProfession,
  revenant: revenantProfession
};
const wait = { type: 'wait', durationMs: 6500 };
const run = (family, rotation, config = {}) =>
  createProfessionSimulator(families[family])([{ type: 'combat-start' }, ...rotation, wait], {
    specialization: 'Core',
    selectedTraitIds: [],
    selectedSkillIds: rotation.flatMap((entry) => {
      const skill =
        typeof entry === 'string'
          ? families[family].catalog.skillsByName.get(entry)
          : families[family].catalog.skillsById.get(entry);
      return skill && ['Heal', 'Utility', 'Elite'].includes(skill.type) ? [skill.id] : [];
    }),
    boons: {},
    allies: { count: 4 },
    ...config
  });
const grants = (result, name, kind) =>
  result.resolvedEvents.filter(
    (event) => event.type === 'buff' && event.skillName === name && (!kind || event.kind === kind)
  );

// Minimal rotations exercise recipient selection after native emission, including custom and trait-selected paths.
const cases = [
  ['mesmer', 'Time Warp', ['quickness']],
  ['mesmer', 'Inspiring Imagery', ['might', 'fury'], { primaryWeapon: 'Rifle' }],
  ['ranger', 'Healing Spring', ['regeneration']],
  ['ranger', 'Stone Spirit', ['aegis']],
  ['ranger', 'Frost Spirit', ['resistance']],
  ['ranger', 'Sublime Conversion', ['regeneration'], { primaryWeapon: 'Staff' }],
  ['ranger', 'Cultivate', ['vigor'], { primaryWeapon: 'Mace' }, ['Germinate', 'Burgeon']],
  ['ranger', 'Oaken Cudgel', ['protection'], { primaryWeapon: 'Mace' }],
  ['ranger', 'Flourish', ['regeneration'], { primaryWeapon: 'Mace', secondaryWeapon: 'Mace' }],
  ['thief', 'Well of Bounty', ['stability', 'might', 'fury', 'vigor', 'regeneration'], { specialization: 'Specter' }],
  ['thief', 'Shadow Sap', ['might', 'protection'], { primaryWeapon: 'Scepter' }],
  [
    'thief',
    'Mind Shock',
    ['stability'],
    { specialization: 'Specter', initialShadowForce: 100 },
    ['Enter Shadow Shroud']
  ],
  ['thief', 'Haunt Shot', ['might'], { specialization: 'Specter', initialShadowForce: 100 }, ['Enter Shadow Shroud']],
  ['engineer', 'Healing Turret', ['regeneration']],
  ['engineer', 'Blunderbuss', ['might'], { primaryWeapon: 'Rifle' }],
  ['engineer', 'Energizing Slam', ['vigor'], { primaryWeapon: 'Mace' }],
  ['engineer', 'Blast Gyro', ['might'], { specialization: 'Scrapper' }],
  ['guardian', 'Symbol of Resolution', ['resolution'], { primaryWeapon: 'Greatsword' }],
  ['guardian', 'Symbol of Vengeance', ['fury'], { specialization: 'Firebrand', primaryWeapon: 'Axe' }],
  ['guardian', 'Chapter 3: Azure Sun', ['vigor'], { specialization: 'Firebrand' }, ['Tome of Resolve']],
  ['guardian', 'Chapter 4: Shining River', ['swiftness'], { specialization: 'Firebrand' }, ['Tome of Resolve']],
  [
    'guardian',
    'Chapter 1: Unflinching Charge',
    ['protection', 'swiftness'],
    { specialization: 'Firebrand' },
    ['Tome of Courage']
  ],
  ['guardian', 'Chapter 2: Daring Challenge', ['resolution'], { specialization: 'Firebrand' }, ['Tome of Courage']],
  ['guardian', 'Chapter 4: Stalwart Stand', ['resistance'], { specialization: 'Firebrand' }, ['Tome of Courage']],
  [
    'guardian',
    'Epilogue: Unbroken Lines',
    ['protection', 'stability', 'aegis'],
    { specialization: 'Firebrand' },
    ['Tome of Courage']
  ],
  ['warrior', 'Charge', ['swiftness'], { primaryWeapon: 'Axe', secondaryWeapon: 'Warhorn' }],
  ['warrior', 'Call of Valor', ['vigor'], { primaryWeapon: 'Axe', secondaryWeapon: 'Warhorn' }],
  ['warrior', 'Line Breaker', ['protection', 'aegis'], { primaryWeapon: 'Staff' }],
  ['warrior', 'Defiant Roar', ['resolution'], { primaryWeapon: 'Staff' }],
  ['warrior', 'Valiant Leap', ['might', 'fury'], { primaryWeapon: 'Staff' }],
  ['warrior', 'Fierce Shot', ['might'], { primaryWeapon: 'Rifle' }],
  [
    'warrior',
    'Keen Strike',
    ['might'],
    {
      specialization: 'Spellbreaker',
      primaryWeapon: 'Dagger',
      attributeInputs: baseAttributeInputs({ precision: 4000 })
    },
    ['Precise Cut', 'Focused Slash']
  ],
  [
    'revenant',
    'Inspiring Reinforcement',
    ['stability'],
    { selectedLegends: [L.DWARF, L.ASSASSIN], startingLegend: L.DWARF }
  ],
  ['revenant', 'Envoy of Exuberance', ['protection'], { primaryWeapon: 'Sword', secondaryWeapon: 'Shield' }],
  ['revenant', 'Acerbic Cut', ['might'], { primaryWeapon: 'Scepter' }, ['Serene Slash']],
  [
    'revenant',
    'Orders from Above',
    ['alacrity'],
    { specialization: 'Renegade', selectedLegends: [L.RENEGADE, L.ASSASSIN] }
  ],
  [
    'revenant',
    'Orders from Above',
    ['alacrity', 'protection'],
    {
      specialization: 'Renegade',
      selectedLegends: [L.RENEGADE, L.ASSASSIN],
      selectedTraitIds: [VT.RIGHTEOUS_REBEL, VT.BOLD_REVERSAL]
    }
  ],
  [
    'revenant',
    "Breakrazor's Bastion",
    ['resolution'],
    { specialization: 'Renegade', selectedLegends: [L.RENEGADE, L.ASSASSIN], startingLegend: L.RENEGADE }
  ]
];

for (const [family, name, kinds, config, setup = []] of cases) {
  test(`${family} ${name} delivers its shared boons and projects four allied players`, () => {
    for (const count of [0, 4]) {
      const result = run(family, [...setup, name], { ...config, allies: { count } });
      assert.deepEqual(result.warnings, []);
      for (const kind of kinds) {
        const events = grants(result, name, kind);
        assert.ok(events.length, `${name}: missing ${kind}`);
        assert.ok(
          events.every(
            (event) => event.resolvedAudience.includesSelf && event.resolvedAudience.alliedPlayerCount === count
          )
        );
        const generated = buildBoonGeneration(events, 0, result.rotationEndTime).boons.get(kind);
        assert.ok(generated.self.generatedStackSeconds > 0);
        assert.equal(generated.allies.generatedStackSeconds, 4 * generated.self.generatedStackSeconds);
      }
    }
  });
}

test('Well of Precognition separates personal stun-break stability from shared well boons', () => {
  const result = run('mesmer', ['Well of Precognition'], { specialization: 'Chronomancer' });
  assert.deepEqual(result.warnings, []);
  const events = grants(result, 'Well of Precognition');
  for (const [kind, stacks, allies] of [
    ['aegis', 1, 4],
    ['stability', 1, 0],
    ['stability', 3, 4]
  ]) {
    const matching = events.filter((event) => event.kind === kind && event.stacks === stacks);
    assert.ok(matching.length);
    assert.ok(matching.every((event) => event.resolvedAudience.alliedPlayerCount === allies));
  }
});

test('detonating Inspiring Imagery suppresses its natural allied boon explosion', () => {
  const result = run('mesmer', ['Inspiring Imagery', 'Abstraction'], { primaryWeapon: 'Rifle' });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(grants(result, 'Inspiring Imagery'), []);
});

test('Chaos Vortex clones fill spare slots after players and retain their caster ownership', () => {
  for (const count of [0, 3, 4]) {
    const result = run('mesmer', [M.DODGE_MIRAGE_CLOAK, M.CHAOS_VORTEX], {
      specialization: 'Mirage',
      primaryWeapon: 'Staff',
      initialResource: 3,
      selectedTraitIds: [MT.INFINITE_HORIZON],
      allies: { count },
      sharePlayerBoonsWithSummons: false
    });
    assert.deepEqual(result.warnings, []);
    const events = result.resolvedEvents.filter(
      (event) => event.type === 'buff' && event.skillId === M.CHAOS_VORTEX && event.actorType === 'summon'
    );
    assert.ok(events.length);
    for (const event of events) {
      assert.match(event.summonOwner, /^mesmer\.clone:\d+$/);
      assert.equal(event.summonKind, 'clone');
      assert.equal(event.resolvedAudience.alliedPlayerCount, count);
      assert.equal(event.resolvedAudience.companionIds.length, Math.min(3, 4 - count));

      if (count === 0) assert.ok(event.resolvedAudience.companionIds.includes(event.summonOwner));
    }

    const generated = buildBoonGeneration(events, 0, result.rotationEndTime).boons.get('might');
    assert.equal(generated.allies.generatedStackSeconds, 4 * generated.self.generatedStackSeconds);
  }
});

test('a lone summon can receive its own group boon without reserving a phantom player', () => {
  const audience = gw2BoonApplicationRecipients(
    { allies: { count: 0 }, sharePlayerBoonsWithSummons: false },
    {
      actorType: 'summon',
      summonOwner: 'clone:1',
      audience: { recipients: 'party', affectsSelf: false, maximumRecipients: 5 }
    }
  );
  assert.deepEqual(audience, {
    includesSelf: false,
    includesSummons: true,
    alliedPlayerCount: 0,
    companionIds: ['clone:1'],
    recipientCount: 1
  });
});

for (const id of [
  R.MIGHTY_ROAR,
  R.PROTECTING_SCREECH,
  R.FURIOUS_SCREECH,
  R.REGENERATE_FERN_HOUND,
  R.FURIOUS_POUNCE,
  R.SAVANNAH_STRIKE,
  R.GUARDIANS_ROAR,
  R.HUNKER_DOWN,
  R.QUICKENING_SCREECH_PET
]) {
  const pet = RANGER_PETS.find((pet) => pet.skillIds.includes(id));
  test(`pet boon ${id} prioritizes players and reaches its caster in a smaller party`, () => {
    for (const count of [0, 4]) {
      const result = run('ranger', [id], {
        specialization: 'Untamed',
        initialUntamedState: 'Ranger',
        selectedPet: pet.name,
        allies: { count },
        sharePlayerBoonsWithSummons: false
      });
      assert.deepEqual(result.warnings, []);
      const events = result.resolvedEvents.filter((event) => event.type === 'buff' && event.skillId === id);
      assert.ok(events.length);
      for (const event of events) {
        assert.equal(event.resolvedAudience.alliedPlayerCount, count);
        assert.deepEqual(event.resolvedAudience.companionIds, count ? [] : [event.summonOwner]);
      }
    }
  });
}

test('Ancestral Grace grants protection exclusively to the active pet', () => {
  const result = run('ranger', [R.ANCESTRAL_GRACE], {
    primaryWeapon: 'Staff',
    selectedPet: 'Tiger',
    sharePlayerBoonsWithSummons: false
  });
  assert.deepEqual(result.warnings, []);
  const events = grants(result, 'Ancestral Grace', 'protection');
  assert.ok(events.length);
  for (const event of events) {
    assert.equal(event.resolvedAudience.includesSelf, false);
    assert.equal(event.resolvedAudience.alliedPlayerCount, 0);
    assert.equal(event.resolvedAudience.companionIds.length, 1);
  }
});

test('steal traits and the assumed Specter tether share their boon grants', () => {
  const steal = run('thief', ['Steal'], { selectedTraitIds: [TT.THRILL_OF_THE_CRIME, TT.BOUNTIFUL_THEFT] });
  assert.deepEqual(steal.warnings, []);
  const shared = steal.resolvedEvents.filter(
    (event) => event.type === 'buff' && [TT.THRILL_OF_THE_CRIME, TT.BOUNTIFUL_THEFT].includes(event.sourceId)
  );
  assert.ok(shared.length);
  assert.ok(shared.every((event) => event.resolvedAudience.alliedPlayerCount === 4));
  for (const [skill, kind] of [
    [T.GRASPING_SHADOWS, 'alacrity'],
    [T.DAWNS_REPOSE, 'protection'],
    [T.MIND_SHOCK, 'aegis']
  ]) {
    const result = run('thief', [T.ENTER_SHADOW_SHROUD, skill], {
      specialization: 'Specter',
      initialShadowForce: 100,
      selectedTraitIds: [TT.SHADESTEP]
    });
    assert.deepEqual(result.warnings, []);
    const events = result.resolvedEvents.filter(
      (event) => event.type === 'buff' && event.sourceId === TT.SHADESTEP && event.kind === kind
    );
    assert.ok(events.length);
    assert.ok(events.every((event) => event.resolvedAudience.alliedPlayerCount === 4));
  }
});

test('mech support grants five players and the mech distinct entitlements', () => {
  const result = run('engineer', ['Crisis Zone', 'Barrier Burst'], {
    specialization: 'Mechanist',
    sharePlayerBoonsWithSummons: false,
    selectedTraitIds: [ET.MECH_ARMS_HIGH_IMPACT_DRIVERS, ET.MECH_FRAME_CHANNELING_CONDUITS, ET.MECH_CORE_BARRIER_ENGINE]
  });
  assert.deepEqual(result.warnings, []);
  for (const name of ['Crisis Zone', 'Barrier Burst', 'Mech Arms: High-Impact Drivers']) {
    const events = grants(result, name);
    assert.ok(events.length, name);
    for (const event of events) {
      assert.equal(event.resolvedAudience.alliedPlayerCount, 4);
      assert.equal(event.resolvedAudience.includesSelf, true);
      assert.deepEqual(event.resolvedAudience.companionIds, ['engineer.mech']);
      assert.equal(event.resolvedAudience.recipientCount, 6);
    }
  }
});

test('Indomitable Courage and Stoic Demeanor share their triggered boons', () => {
  for (const [specialization, skill, trait] of [
    ['Core', 'Virtue of Courage', GT.INDOMITABLE_COURAGE],
    ['Firebrand', 'Chapter 2: Daring Challenge', GT.STOIC_DEMEANOR]
  ]) {
    const result = run('guardian', [...(specialization === 'Firebrand' ? ['Tome of Courage'] : []), skill], {
      specialization,
      selectedTraitIds: [trait]
    });
    assert.deepEqual(result.warnings, []);
    const events = result.resolvedEvents.filter((event) => event.type === 'buff' && event.sourceId === trait);
    assert.ok(events.length);
    assert.ok(events.every((event) => event.resolvedAudience.alliedPlayerCount === 4));
  }
});

test('Pain Absorption shares resistance while resolution remains personal', () => {
  const result = run('revenant', ['Pain Absorption'], {
    selectedLegends: [L.DEMON, L.ASSASSIN],
    startingLegend: L.DEMON
  });
  assert.deepEqual(result.warnings, []);
  for (const [kind, count] of [
    ['resistance', 4],
    ['resolution', 0]
  ]) {
    const events = grants(result, 'Pain Absorption', kind);
    assert.ok(events.length);
    assert.ok(events.every((event) => event.resolvedAudience.alliedPlayerCount === count));
  }
});

test('Gladiator boons share only with Dwarf resonance', () => {
  for (const legend of [L.DWARF, L.ASSASSIN]) {
    const result = run('revenant', ["Gladiator's Defense"], {
      specialization: 'Conduit',
      selectedLegends: [L.ENTITY, legend],
      startingLegend: L.ENTITY
    });
    assert.deepEqual(result.warnings, []);
    for (const kind of ['resolution', 'resistance']) {
      const events = grants(result, "Gladiator's Defense", kind);
      assert.ok(events.length);
      assert.ok(events.every((event) => event.resolvedAudience.alliedPlayerCount === (legend === L.DWARF ? 4 : 0)));
    }
  }
});

test('enemy Otherworldly Bond does not grant the ally-target payload', () => {
  const result = run('revenant', ['Otherworldly Bond'], { primaryWeapon: 'Scepter' });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(grants(result, 'Otherworldly Bond'), []);
});

test('merged Ancestral Grace transfers pet protection to the ranger without sharing it', () => {
  const result = run('ranger', [R.ANCESTRAL_GRACE], {
    specialization: 'Soulbeast',
    primaryWeapon: 'Staff',
    selectedPet: 'Tiger'
  });
  assert.deepEqual(result.warnings, []);
  const events = grants(result, 'Ancestral Grace', 'protection');
  assert.ok(events.length);
  assert.ok(
    events.every((event) => event.resolvedAudience.includesSelf && event.resolvedAudience.recipientCount === 1)
  );
});

test('enemy-target Malicious Shadowsquall applies poison without ally-target regeneration', () => {
  const result = run('thief', ['Hide in Shadows', T.MALICIOUS_SHADOWSQUALL], {
    specialization: 'Deadeye',
    primaryWeapon: 'Scepter'
  });
  assert.deepEqual(result.warnings, []);
  assert.ok(
    result.resolvedEvents.some((event) => event.skillId === T.MALICIOUS_SHADOWSQUALL && event.type === 'condition')
  );
  assert.deepEqual(grants(result, 'Malicious Shadowsquall', 'regeneration'), []);
});

test('No Scope and New Genes share trait boons while Mass Momentum keeps its personal might', () => {
  for (const [specialization, rotation, trait, config] of [
    [
      'Core',
      ['Rifle Burst'],
      ET.NO_SCOPE,
      { primaryWeapon: 'Rifle', attributeInputs: baseAttributeInputs({ precision: 4000 }) }
    ],
    ['Amalgam', [77103], ET.NEW_GENES, { selectedMorphSkillIds: [77103, 77203, 76954] }],
    ['Scrapper', ['Function Gyro'], ET.MASS_MOMENTUM, {}]
  ]) {
    const result = run('engineer', rotation, { specialization, selectedTraitIds: [trait], ...config });
    assert.deepEqual(result.warnings, []);
    const events = result.resolvedEvents.filter((event) => event.type === 'buff' && event.sourceId === trait);
    assert.ok(events.length);

    if (trait === ET.MASS_MOMENTUM) assert.ok(events.some((event) => event.kind === 'might'));

    for (const event of events)
      assert.equal(
        event.resolvedAudience.alliedPlayerCount,
        trait === ET.MASS_MOMENTUM && event.kind === 'might' ? 0 : 4
      );
  }
});

test('Stalwart Speed and Luminous Staff grant their boons to allies', () => {
  for (const [specialization, rotation, trait, name, kind] of [
    ['Firebrand', ['Tome of Courage', 'Epilogue: Unbroken Lines'], GT.STALWART_SPEED, 'Stalwart Speed', 'quickness'],
    ['Luminary', ['Enter Radiant Forge', 'Luminous Staff'], undefined, 'Luminous Staff', 'resolution']
  ]) {
    const result = run('guardian', rotation, { specialization, selectedTraitIds: trait ? [trait] : [] });
    assert.deepEqual(result.warnings, []);
    const events = grants(result, name, kind);
    assert.ok(events.length);
    assert.ok(events.every((event) => event.resolvedAudience.alliedPlayerCount === 4));
  }
});

test('Helio Rush supports eligible allies only when illuminated, excluding the full-health player', () => {
  for (const illuminated of [false, true]) {
    const result = run('guardian', [...(illuminated ? ['Symbol of Luminance'] : []), 'Helio Rush'], {
      primaryWeapon: 'Spear'
    });
    assert.deepEqual(result.warnings, []);
    const events = grants(result, 'Helio Rush', 'resolution');
    assert.equal(events.length > 0, illuminated);
    for (const event of events) {
      assert.equal(event.resolvedAudience.includesSelf, false);
      assert.equal(event.resolvedAudience.alliedPlayerCount, 4);
    }
  }
});

test('engineer bounce, projectile, and pad grants preserve their distinct audiences', () => {
  for (const [specialization, rotation, skill, self, allies, config] of [
    ['Core', ['Elixir Gun', 'Glob Shot'], 'Glob Shot', true, 2, {}],
    [
      'Holosmith',
      ['Particle Accelerator'],
      'Particle Accelerator',
      true,
      4,
      { selectedSkillIds: [engineerProfession.catalog.skillsByName.get('Photon Wall').id] }
    ],
    ['Holosmith', ['Engage Photon Forge', 'Holo Leap'], 'Holo Leap', true, 2, {}]
  ]) {
    const result = run('engineer', rotation, { specialization, ...config });
    assert.deepEqual(result.warnings, []);
    const events = grants(result, skill, 'swiftness');
    assert.ok(events.length);
    for (const event of events) {
      assert.equal(event.resolvedAudience.includesSelf, self);
      assert.equal(event.resolvedAudience.alliedPlayerCount, allies);
    }
  }
});

test('Conduit support releases retain their legend gates while sharing boons', () => {
  for (const [legend, setup, skill, kinds] of [
    [L.CENTAUR, 'Natural Harmony', 'Release Potential: Monk', ['resistance', 'regeneration']],
    [L.ENTITY, "Gladiator's Defense", 'Release Potential: Dervish', ['might', 'fury']]
  ]) {
    const result = run('revenant', [setup, skill], {
      specialization: 'Conduit',
      selectedLegends: [L.ENTITY, L.CENTAUR],
      startingLegend: legend,
      initialEnergy: 100
    });
    assert.deepEqual(result.warnings, []);
    for (const kind of kinds) {
      const events = grants(result, skill, kind);
      assert.ok(events.length);
      assert.ok(events.every((event) => event.resolvedAudience.alliedPlayerCount === 4));
    }
  }

  const unselected = run('revenant', ["Gladiator's Defense", 'Release Potential: Dervish'], {
    specialization: 'Conduit',
    selectedLegends: [L.ENTITY, L.DEMON],
    startingLegend: L.ENTITY,
    initialEnergy: 100
  });
  assert.deepEqual(unselected.warnings, []);
  assert.deepEqual(grants(unselected, 'Release Potential: Dervish'), []);
});

test('Heroic Command preserves the shared audience through both live Fervor profiles', () => {
  for (const legacy of [false, true]) {
    const result = run('revenant', ['Citadel Bombardment', { type: 'wait', durationMs: 2000 }, 'Heroic Command'], {
      specialization: 'Renegade',
      selectedLegends: [L.RENEGADE, L.ASSASSIN],
      startingLegend: L.RENEGADE,
      selectedTraitIds: [VT.AMBUSH_COMMANDER, ...(legacy ? [VT.LASTING_LEGACY] : [])],
      target: { defiant: true },
      initialEnergy: 100
    });
    assert.deepEqual(result.warnings, []);
    const events = grants(result, 'Heroic Command', 'might');
    assert.ok(events.length);
    assert.ok(events.every((event) => event.resolvedAudience.alliedPlayerCount === 4));
  }
});

test('Spirit Boon and Song of Arboreum retain shared recipients after trait emission', () => {
  for (const [specialization, skill, trait] of [
    ['Core', 'Swap Legends', VT.SPIRIT_BOON],
    ['Vindicator', 'Energy Meld', VT.SONG_OF_ARBOREUM]
  ]) {
    const result = run('revenant', [skill], {
      specialization,
      selectedLegends: [L.ASSASSIN, L.DEMON],
      startingLegend: L.ASSASSIN,
      selectedTraitIds: [trait]
    });
    assert.deepEqual(result.warnings, []);
    const events = result.resolvedEvents.filter((event) => event.type === 'buff' && event.sourceId === trait);
    assert.ok(events.length);
    assert.ok(events.every((event) => event.resolvedAudience.alliedPlayerCount === 4));
  }
});
