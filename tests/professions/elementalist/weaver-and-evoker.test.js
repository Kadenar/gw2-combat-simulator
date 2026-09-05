import assert from 'node:assert/strict';
import test from 'node:test';
import { runNative } from '../../helpers/elementalist-simulation.js';
import { skillBreakdownRows } from '#gw2/app/results/result-tables.js';
import { rotationSelectedSlotSkills } from '#gw2/app/rotation/palette/model.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { elementalistProfession } from '#gw2/professions/elementalist/definition.js';
import { targetAttunement } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { applyPistolState } from '#gw2/professions/elementalist/core/mechanics/pistol-bullets.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { availability as evokerAvailability } from '#gw2/professions/elementalist/specializations/evoker/mechanics/availability.js';
import { createEvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { weaverCastRules } from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-attunements.js';

test('Unravel requires Elements of Rage, disables dual attacks, and has a 25-second recharge', () => {
  const unavailable = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-2']],
    rotation: ['Unravel'],
    startAttunement: 'Air',
    secondaryAttunement: 'Fire'
  });

  assert.equal(
    unavailable.events.some((event) => event.type === 'action' && event.skillName === 'Unravel'),
    false
  );
  assert.match(unavailable.warnings[0], /requires Elements of Rage/i);

  const dualAttack = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-1']],
    rotation: ['Unravel', 'Pyro Vortex'],
    startAttunement: 'Fire',
    secondaryAttunement: 'Air',
    weapons: ['Sword', 'Dagger']
  });

  assert.equal(
    dualAttack.events.some((event) => event.type === 'action' && event.skillName === 'Pyro Vortex'),
    false
  );
  assert.match(dualAttack.warnings[0], /while Unravel is active/i);

  const unravel = elementalistCatalog.skillsByName.get('Unravel');
  const queuedDualAttack = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-1']],
    rotation: [
      'Pyro Vortex',
      {
        type: 'cast',
        skillId: unravel.id,
        concurrentOffsetMs: 100
      }
    ],
    startAttunement: 'Fire',
    secondaryAttunement: 'Air',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(queuedDualAttack.warnings, []);
  assert.deepEqual(
    queuedDualAttack.steps.map((step) => [step.skill, step.start, step.end]),
    [
      ['Pyro Vortex', 0, 560],
      ['Unravel', 100, 100]
    ]
  );
  assert.equal(
    queuedDualAttack.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Pyro Vortex' && event.at > 0.1
    ),
    true
  );

  const cooldown = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-1']],
    rotation: ['Unravel', 'Unravel'],
    startAttunement: 'Air',
    secondaryAttunement: 'Fire',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });

  assert.deepEqual(
    cooldown.steps.map((step) => step.start),
    [0, 25000]
  );
});

test('cooldown reset also resets native attunement recharge', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Air Attunement', { type: 'cooldown-reset' }, 'Fire Attunement'],
    startAttunement: 'Fire',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });
  const fire = result.steps.find((step) => step.skill === 'Fire Attunement');

  assert.deepEqual(result.warnings, []);
  assert.equal(fire.start, 0);
});

test('autoattack chains carry across attunements until their third strike', () => {
  const fireRoot = elementalistCatalog.skillsByName.get('Fire Strike').id;
  const fireSecond = elementalistCatalog.skillsByName.get('Fire Swipe');
  const airRoot = elementalistCatalog.skillsByName.get('Charged Strike').id;

  assert.deepEqual(
    elementalistCatalog.autoattackChains
      .find((chain) => chain[0] === fireRoot)
      .map((id) => elementalistCatalog.skillsById.get(id).name),
    ['Fire Strike', 'Fire Swipe', 'Searing Slash']
  );

  const carried = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Fire Strike', 'Air Attunement'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(carried.warnings, []);
  assert.deepEqual(carried.endState.profession.autoattackCarryover, {
    root: fireRoot,
    attunement: 'Fire'
  });
  assert.equal(carried.endState.profession.autoattackChains[fireRoot], fireSecond.id);
  assert.equal(
    elementalistProfession.ui.paletteSkillAvailability(
      {
        specialization: 'Core',
        professionState: carried.endState.profession,
        time: carried.endState.time / 1000,
        catalog: elementalistCatalog,
        build: { startAttunement: 'Fire' }
      },
      fireSecond
    ).available,
    true
  );

  const completed = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Fire Strike', 'Air Attunement', 'Fire Swipe', 'Searing Slash', 'Charged Strike'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(completed.warnings, []);
  assert.equal(completed.endState.profession.autoattackCarryover, null);
  assert.equal(
    completed.endState.profession.autoattackChains[airRoot],
    elementalistCatalog.skillsByName.get('Polaric Slash').id
  );
});

test('a skill in the new attunement interrupts autoattack carryover', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Fire Strike', 'Air Attunement', 'Polaric Leap', 'Fire Swipe'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.equal(result.endState.profession.autoattackCarryover, null);
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Fire Swipe'),
    false
  );
  assert.equal(
    result.warnings.some((warning) => warning.includes('Fire Swipe')),
    true
  );
});

test('Weaver can cancel a carried autoattack by starting the current primary chain', () => {
  const airRoot = elementalistCatalog.skillsByName.get('Charged Strike').id;
  const fireRoot = elementalistCatalog.skillsByName.get('Fire Strike').id;
  const fireSecond = elementalistCatalog.skillsByName.get('Fire Swipe').id;
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-1']],
    rotation: ['Charged Strike', 'Fire Attunement', 'Fire Strike'],
    startAttunement: 'Air',
    secondaryAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.autoattackCarryover, null);
  assert.equal(result.endState.profession.autoattackChains[airRoot], undefined);
  assert.equal(result.endState.profession.autoattackChains[fireRoot], fireSecond);
});

test('a concurrent attunement swap preserves the in-flight auto chain', () => {
  const airAttunement = elementalistCatalog.skillsByName.get('Air Attunement');
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: [
      'Fire Strike',
      {
        type: 'cast',
        skillId: airAttunement.id,
        concurrentOffsetMs: 100
      },
      'Fire Swipe'
    ],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Fire Swipe'),
    true
  );
});

test('Ride the Lightning preserves sword roots without exempting other dagger skills', () => {
  const preserved = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Charged Strike', 'Ride the Lightning', 'Polaric Slash'],
    startAttunement: 'Air',
    weapons: ['Sword', 'Dagger']
  });
  const reset = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Charged Strike', 'Updraft', 'Charged Strike'],
    startAttunement: 'Air',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(preserved.warnings, []);
  assert.deepEqual(
    preserved.steps.map((step) => step.skill),
    ['Charged Strike', 'Ride the Lightning', 'Polaric Slash']
  );
  assert.deepEqual(reset.warnings, []);
  assert.deepEqual(
    reset.steps.map((step) => step.skill),
    ['Charged Strike', 'Updraft', 'Charged Strike']
  );
});

test('Relentless Fire preserves the sword autoattack chain', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Catalyst']],
    rotation: ['Charged Strike', 'Relentless Fire', 'Polaric Slash'],
    startAttunement: 'Air',
    weapons: ['Sword', 'Dagger'],
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Relentless Fire',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Charged Strike', 'Relentless Fire', 'Polaric Slash']
  );
});

test('Ride the Lightning preserves the timed Aerial Agility flip sequence', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Aerial Agility', 'Ride the Lightning', 'Aerial Agility (chain)', 'Aerial Agility (dash)'],
    startAttunement: 'Air',
    weapons: ['Pistol', 'Dagger']
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Aerial Agility', 'Ride the Lightning', 'Aerial Agility (chain)', 'Aerial Agility (dash)']
  );
});

test('Aerial Agility expires after five seconds while its original cooldown keeps counting down', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Aerial Agility', 5100],
    startAttunement: 'Air',
    weapons: ['Pistol', 'Dagger']
  });

  assert.equal(result.endState.profession.autoattackChains[ID.AERIAL_AGILITY], undefined);
  assert.ok(result.endState.cooldowns['Aerial Agility'].remaining > 0);
});

test('using the first Aerial Agility follow-up restarts its full cooldown', () => {
  const unused = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Aerial Agility', 2000],
    startAttunement: 'Air',
    weapons: ['Pistol', 'Dagger']
  });
  const used = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Aerial Agility', 2000, 'Aerial Agility (chain)'],
    startAttunement: 'Air',
    weapons: ['Pistol', 'Dagger']
  });
  const initialDuration = unused.endState.cooldowns['Aerial Agility'].readyAt - unused.steps[0].end;
  const followup = used.steps[2];

  assert.equal(used.endState.cooldowns['Aerial Agility'].readyAt - followup.end, initialDuration);
  assert.ok(used.endState.cooldowns['Aerial Agility'].readyAt > unused.endState.cooldowns['Aerial Agility'].readyAt);
});

test('rotation palette resolves equipped glyphs to the active attunement', () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    selectedSkills: {
      ...elementalistProfession.createBuildDefaults().selectedSkills,
      Utility2: 'Glyph of Storms (Fire)'
    }
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    results: {
      endState: { profession: { primaryAttunement: 'Air' } }
    }
  };

  assert.equal(
    rotationSelectedSlotSkills(app).some((skill) => skill.name === 'Glyph of Storms (Air)'),
    true
  );
  assert.equal(
    elementalistProfession.ui.paletteSkillAvailability(
      {
        build,
        specialization: 'Weaver',
        professionState: { primaryAttunement: 'Air' }
      },
      elementalistCatalog.skillsByName.get('Glyph of Storms (Air)')
    ).available,
    true
  );
});

test('equipped glyphs remain available across attunement variants', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Air Attunement', 'Glyph of Storms (Air)'],
    startAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Arcane Blast',
      Utility2: 'Glyph of Storms (Fire)',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Glyph of Storms (Air)'),
    true
  );
});

test('attunement variants of an equipped glyph share their cooldown', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Air Attunement', 'Glyph of Storms (Air)', 10000, 'Fire Attunement', 'Glyph of Storms (Fire)'],
    startAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Arcane Blast',
      Utility2: 'Glyph of Storms (Fire)',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });
  const casts = result.steps.filter((step) => String(step.skill).startsWith('Glyph of Storms'));

  assert.deepEqual(result.warnings, []);
  assert.equal(casts.length, 2);
  assert.ok(casts[1].start - casts[0].start >= 48000);
});

test('Primordial Stance variants share charges and count recharge', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Weaver']],
    rotation: [
      'Primordial Stance (Fire)',
      'Air Attunement',
      'Primordial Stance (Air)',
      'Earth Attunement',
      'Primordial Stance (Earth)'
    ],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Primordial Stance (Fire)',
      Utility2: 'Glyph of Storms (Fire)',
      Utility3: 'Arcane Wave',
      Elite: 'Weave Self'
    }
  });
  const casts = result.steps.filter((step) => String(step.skill).startsWith('Primordial Stance'));

  assert.deepEqual(result.warnings, []);
  assert.equal(casts.length, 3);
  assert.ok(casts[2].start - casts[0].start >= 16000);
});

test('Primordial Stance pulses use the active attunements at each pulse', () => {
  const result = runNative({
    lines: [['Fire'], ['Earth'], ['Weaver']],
    rotation: ['Primordial Stance (Fire)', 1500, 'Earth Attunement', 4500],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Primordial Stance (Fire)',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Weave Self'
    }
  });
  const action = result.events.find(
    (event) => event.type === 'action' && event.skillName === 'Primordial Stance (Fire)'
  );
  const hits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Primordial Stance'
  );
  const conditions = result.events.filter(
    (event) => event.type === 'condition' && event.skillName === 'Primordial Stance'
  );

  assert.equal(hits.length, 5);
  assert.deepEqual(
    hits.map((event) => event.at - action.at),
    [1, 2, 3, 4, 5]
  );
  assert.deepEqual(
    conditions.map((event) => [event.at - action.at, event.condition, event.stacks]),
    [
      [1, 'Burning', 1],
      [1, 'Burning', 1],
      [2, 'Bleeding', 2],
      [2, 'Burning', 1],
      [3, 'Bleeding', 2],
      [3, 'Burning', 1],
      [4, 'Bleeding', 2],
      [4, 'Burning', 1],
      [5, 'Bleeding', 2],
      [5, 'Burning', 1]
    ]
  );
});

test("Evasive Arcana uses the active attunement's native trait skill", () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane', '1-1-1']],
    rotation: ['Dodge', 1000],
    startAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Arcane Blast',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Conjure Fiery Greatsword'
    }
  });

  assert.equal(result.endState.profession.endurance, 57.5);
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Flame Burst (trait)'),
    true
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Flame Burst (trait)' &&
        event.condition === 'Burning' &&
        event.stacks === 3
    ),
    true
  );
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Flame Burst (trait)'),
    true
  );
});

test('Weaver mechanics execute through native hooks', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Weaver']],
    rotation: ['Weave Self', 'Water Attunement', 'Air Attunement', 'Earth Attunement', 'Tailored Victory'],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Arcane Blast',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Weave Self'
    }
  });

  assert.equal(
    result.events.some((event) => event.type === 'buff' && event.kind === 'perfect weave'),
    true
  );
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Tailored Victory'),
    true
  );
  assert.equal(result.endState.profession.perfectWeaveUntil, 0);

  const weaveSelf = result.events.find((event) => event.type === 'action' && event.skillName === 'Weave Self');
  const weaveSelfFire = result.events.find(
    (event) => event.type === 'buff' && event.source === 'Weave Self' && event.kind === 'weave self fire'
  );

  assert.equal(weaveSelfFire.at - weaveSelf.at, 0.52);
  assert.ok(weaveSelfFire.at < weaveSelf.endsAt);
  assert.equal(weaveSelf.rechargeReadyAt - weaveSelfFire.at, 72);
});

test('Evoker mechanics execute through native hooks', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Lightning Blitz', 4000],
    evokerElement: 'Air',
    initialEvokerCharges: 6,
    initialEvokerEmpowered: 3
  });

  assert.equal(result.endState.profession.maximumCharges, 6);
  assert.equal(result.endState.profession.empowered, 0);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Electric Enchantment')
      .length,
    3
  );
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Electric Enchantment'),
    true
  );
});

test('Elementalist behavior follows skill IDs after display labels change', () => {
  const fireAttunement = { ...elementalistCatalog.skillsById.get(ID.FIRE_ATTUNEMENT), name: 'Renamed attunement' };
  const ignite = { ...elementalistCatalog.skillsById.get(ID.IGNITE), name: 'Renamed familiar' };
  const state = createEvokerState({ evokerElement: 'Fire', initialEvokerCharges: 6 });
  const context = {
    state: {
      profession: {
        core: {},
        specialization: { kind: 'Evoker', state }
      }
    },
    start: 0,
    epsilon: 1e-9,
    commandIndex: 0,
    config: { selectedTraitIds: [] }
  };

  assert.equal(targetAttunement(fireAttunement), 'Fire');
  assert.deepEqual(evokerAvailability(context, ignite), { ready: true });
  state.element = 'Water';
  assert.equal(evokerAvailability(context, ignite).code, 'elementalist.evoker-element');

  const unravel = { ...elementalistCatalog.skillsById.get(ID.UNRAVEL), name: 'Renamed unravel' };
  assert.equal(
    weaverCastRules.availability.handler({ config: { selectedTraitIds: [] } }, unravel).code,
    'elementalist.weaver-elements-of-rage'
  );

  const core = createElementalistCoreState({ pistolBullets: { Earth: true, Air: true } });
  const pistolContext = { state: { profession: { core } }, effectiveEnd: 1, config: { selectedTraitIds: [] } };
  const shatteringStone = {
    ...elementalistCatalog.skillsById.get(ID.SHATTERING_STONE),
    name: 'Renamed core pistol skill'
  };
  applyPistolState(pistolContext, shatteringStone);
  assert.equal(core.shatteringStoneHitsRemaining, 3);

  const purblindingPlasma = {
    ...elementalistCatalog.skillsById.get(ID.PURBLINDING_PLASMA),
    name: 'Renamed Weaver pistol skill'
  };
  assert.equal(weaverCastRules.modifyRechargeDuration({ ...pistolContext, skill: purblindingPlasma }, 15), 10);
});

test('Evoker weapon skills build familiar charges', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Flame Uprising'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger'],
    evokerElement: 'Fire',
    initialEvokerCharges: 0
  });
  const charge = result.events.find(
    (event) => event.type === 'resource' && event.kind === 'evoker-charges' && event.source === 'Flame Uprising'
  );

  assert.ok(charge);
  assert.equal(charge.change, 2);
  assert.equal(result.endState.profession.charges, 2);
});

test('Fire-specialized Evoker gives Sunspot and Flame Expulsion independent 5-second cooldowns', () => {
  const simulate = (evokerElement) =>
    runNative({
      lines: [
        ['Fire', '1-1-2'],
        ['Earth', '2-1-2'],
        ['Evoker', '1-1-1']
      ],
      rotation: [
        'Raging Ricochet',
        'Earth Attunement',
        'Fire Attunement',
        'Water Attunement',
        'Fire Attunement',
        'Air Attunement'
      ],
      startAttunement: 'Fire',
      weapons: ['Pistol', 'Dagger'],
      evokerElement
    });
  const attempts = (result, direction) =>
    result.events.filter(
      (event) =>
        event.type === 'elementalist.attunement' &&
        (direction === 'enter' ? event.to === 'Fire' : event.from === 'Fire')
    );
  const procs = (result, skillName) =>
    result.events.filter((event) => event.type === 'damage' && event.skillName === skillName);
  const fire = simulate('Fire');
  const fireEntries = attempts(fire, 'enter');
  const fireExits = attempts(fire, 'exit');

  assert.deepEqual(fire.warnings, []);
  assert.equal(fireEntries.length, 2);
  assert.equal(fireExits.length, 3);
  assert.ok(fireEntries.at(-1).at - fireEntries[0].at < 5);
  assert.ok(fireExits.at(-1).at - fireExits[0].at < 5);
  assert.equal(procs(fire, 'Sunspot').length, 1);
  assert.equal(procs(fire, 'Flame Expulsion').length, 1);
  // Independent timers allow the first Sunspot while Flame Expulsion is already cooling down.
  assert.ok(procs(fire, 'Sunspot')[0].at - procs(fire, 'Flame Expulsion')[0].at < 5);

  const nonFire = simulate('Water');

  assert.equal(procs(nonFire, 'Sunspot').length, attempts(nonFire, 'enter').length);
  assert.equal(procs(nonFire, 'Flame Expulsion').length, attempts(nonFire, 'exit').length);
});

test('Flame Expulsion uses its own icon in the damage breakdown', () => {
  const result = runNative({
    lines: [['Fire', '1-1-2'], ['Air'], ['Arcane']],
    rotation: ['Flame Uprising', 'Air Attunement'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });
  const expectedIcon = 'https://render.guildwars2.com/file/998095CB1FD2CF0164B8A36BABFDB911DF08DB02/1012313.png';
  const packet = result.events.find((event) => event.type === 'damage' && event.skillName === 'Flame Expulsion');
  const row = skillBreakdownRows(result).find((entry) => entry.name === 'Flame Expulsion');

  assert.equal(packet?.icon, expectedIcon);
  assert.equal(row?.icon, expectedIcon);
});

test('Sunspot uses its own icon in the damage breakdown', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Lightning Strike', 'Fire Attunement'],
    startAttunement: 'Air',
    weapons: ['Scepter', 'Dagger']
  });
  const expectedIcon = 'https://render.guildwars2.com/file/1405047ED70DE30F80B1F6304A787B215BB50878/1012316.png';
  const packet = result.events.find((event) => event.type === 'damage' && event.skillName === 'Sunspot');
  const row = skillBreakdownRows(result).find((entry) => entry.name === 'Sunspot');

  assert.equal(packet?.icon, expectedIcon);
  assert.equal(row?.icon, expectedIcon);
});

test('Earthen Blast uses its own icon in the damage breakdown', () => {
  const result = runNative({
    lines: [['Earth'], ['Air'], ['Arcane']],
    rotation: ['Lightning Strike', 'Earth Attunement'],
    startAttunement: 'Air',
    weapons: ['Scepter', 'Dagger']
  });
  const expectedIcon = 'https://render.guildwars2.com/file/2531DCAFAEAB452C90C4572E1ADCE8236DCF5636/1012304.png';
  const packet = result.events.find((event) => event.type === 'damage' && event.skillName === 'Earthen Blast');
  const row = skillBreakdownRows(result).find((entry) => entry.name === 'Earthen Blast');

  assert.equal(packet?.icon, expectedIcon);
  assert.equal(row?.icon, expectedIcon);
});

test('Air-specialized Evoker leaves Electric Discharge without an internal cooldown', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Raging Ricochet',
      'Earth Attunement',
      'Air Attunement',
      'Water Attunement',
      'Air Attunement',
      'Fire Attunement'
    ],
    startAttunement: 'Fire',
    weapons: ['Pistol', 'Dagger'],
    evokerElement: 'Air'
  });
  const entries = result.events.filter((event) => event.type === 'elementalist.attunement' && event.to === 'Air');
  const discharges = result.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Electric Discharge'
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(entries.length, 2);
  assert.ok(entries.at(-1).at - entries[0].at < 5);
  assert.equal(discharges.length, entries.length);
});

test('Earth-specialized Evoker gives Earthen Blast and Rock Solid independent 5-second cooldowns', () => {
  const simulate = (evokerElement) =>
    runNative({
      lines: [['Earth', '1-2-2'], ['Air'], ['Evoker']],
      rotation: [
        'Raging Ricochet',
        'Air Attunement',
        'Earth Attunement',
        'Water Attunement',
        'Earth Attunement',
        'Fire Attunement'
      ],
      startAttunement: 'Fire',
      weapons: ['Pistol', 'Dagger'],
      evokerElement
    });
  const earthEntries = (result) =>
    result.events.filter((event) => event.type === 'elementalist.attunement' && event.to === 'Earth');
  const earthenBlasts = (result) =>
    result.events.filter((event) => event.type === 'damage' && event.skillName === 'Earthen Blast');
  const rockSolid = (result) => result.events.filter((event) => event.type === 'buff' && event.source === 'Rock Solid');
  const earth = simulate('Earth');
  const entries = earthEntries(earth);

  assert.deepEqual(earth.warnings, []);
  assert.equal(entries.length, 2);
  assert.ok(entries.at(-1).at - entries[0].at < 5);
  assert.equal(earthenBlasts(earth).length, 1);
  assert.equal(rockSolid(earth).length, 1);

  const nonEarth = simulate('Water');

  assert.equal(earthenBlasts(nonEarth).length, earthEntries(nonEarth).length);
  assert.equal(rockSolid(nonEarth).length, earthEntries(nonEarth).length);
});

test('Specialized Elements grants three familiar charges per matching weapon skill', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker', '1-1-3']],
    rotation: ['Flame Uprising'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger'],
    evokerElement: 'Fire',
    initialEvokerCharges: 0
  });
  const charge = result.events.find(
    (event) => event.type === 'resource' && event.kind === 'evoker-charges' && event.source === 'Flame Uprising'
  );

  assert.equal(result.endState.profession.maximumCharges, 6);
  assert.ok(charge);
  assert.equal(charge.change, 3);
  assert.equal(result.endState.profession.charges, 3);
});

test('Specialized Elements familiar casts reduce active weapon recharge', () => {
  const simulate = (traits) =>
    runNative({
      lines: [['Fire'], ['Air'], ['Evoker', traits]],
      rotation: ['Flame Uprising', 'Ignite'],
      startAttunement: 'Fire',
      weapons: ['Sword', 'Dagger'],
      evokerElement: 'Fire'
    });
  const baseline = simulate('1-1-1');
  const specialized = simulate('1-1-3');

  assert.deepEqual(baseline.warnings, []);
  assert.deepEqual(specialized.warnings, []);
  assert.equal(
    baseline.endState.cooldowns['Flame Uprising'].readyAt - specialized.endState.cooldowns['Flame Uprising'].readyAt,
    512
  );
});

test('Evoker can cast a basic familiar after configured start charges fill', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Flame Uprising', 'Ignite'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger'],
    evokerElement: 'Fire',
    initialEvokerCharges: 4
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Ignite'),
    true
  );
  assert.equal(result.endState.profession.charges, 0);
  assert.equal(result.endState.profession.empowered, 1);
});

test('Evoker preserves off-attunement recharge while waiting for a swap', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Shattering Stone',
      'Water Attunement',
      'Frigid Flurry',
      'Air Attunement',
      'Dazing Discharge',
      'Fire Attunement'
    ],
    startAttunement: 'Earth',
    weapons: ['Pistol', 'Dagger'],
    evokerElement: 'Earth'
  });
  const dazing = result.events.find((event) => event.type === 'action' && event.skillName === 'Dazing Discharge');
  const fire = result.events.find((event) => event.type === 'action' && event.skillName === 'Fire Attunement');

  assert.deepEqual(result.warnings, []);
  assert.equal(fire.at, dazing.endsAt);
});

test('Evoker concurrent actions wait for an active familiar cast', () => {
  const earthAttunement = elementalistCatalog.skillsByName.get('Earth Attunement');
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Lightning Blitz',
      {
        type: 'cast',
        skillId: earthAttunement.id,
        concurrentOffsetMs: 100
      }
    ],
    startAttunement: 'Air',
    evokerElement: 'Air',
    initialEvokerEmpowered: 3
  });
  const familiar = result.events.find((event) => event.type === 'action' && event.skillName === 'Lightning Blitz');
  const attunement = result.events.find((event) => event.type === 'action' && event.skillName === 'Earth Attunement');

  assert.deepEqual(result.warnings, []);
  assert.ok(attunement.at >= familiar.endsAt);
});

test('Evoker applies parent charge progression after a concurrent basic familiar', () => {
  const calcify = elementalistCatalog.skillsByName.get('Calcify');
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Shatterstone',
      {
        type: 'cast',
        skillId: calcify.id,
        concurrentOffsetMs: 560
      }
    ],
    startAttunement: 'Water',
    weapons: ['Scepter', 'Dagger'],
    evokerElement: 'Earth',
    initialEvokerCharges: 6
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.charges, 1);
  assert.equal(result.endState.profession.empowered, 1);
});

test('Evoker reapplies Rejuvenate after its concurrent basic familiar', () => {
  const calcify = elementalistCatalog.skillsByName.get('Calcify');
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Rejuvenate',
      {
        type: 'cast',
        skillId: calcify.id,
        concurrentOffsetMs: 800
      }
    ],
    evokerElement: 'Earth',
    initialEvokerCharges: 0,
    selectedSkills: {
      Heal: 'Rejuvenate',
      Utility1: "Fox's Fury",
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Elemental Procession'
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.charges, 6);
  assert.equal(result.endState.profession.empowered, 1);
});

test('Evasive Arcana does not grant Evoker familiar charges', () => {
  const result = runNative({
    lines: [['Fire'], ['Arcane', '1-1-1'], ['Evoker']],
    rotation: ['Dodge', 1000],
    startAttunement: 'Fire',
    evokerElement: 'Fire',
    initialEvokerCharges: 0
  });

  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Flame Burst (trait)'),
    true
  );
  assert.equal(result.endState.profession.charges, 0);
});

test('Evoker materializes final Electric Enchantment stacks on prior hits', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Charged Strike', 'Polaric Slash', 'Zap'],
    startAttunement: 'Air',
    weapons: ['Sword', 'Dagger'],
    evokerElement: 'Air',
    initialEvokerCharges: 6
  });
  const enchantments = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Electric Enchantment'
  );

  assert.equal(enchantments.length, 2);
  assert.equal(enchantments[0].triggeredBy, 'Charged Strike');
});

test('Specialized Elements forces and locks the selected attunement', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker', '1-1-3']],
    rotation: ['Fire Attunement'],
    startAttunement: 'Fire',
    evokerElement: 'Air'
  });

  assert.equal(result.endState.profession.primaryAttunement, 'Air');
  assert.equal(result.endState.profession.maximumCharges, 6);
  assert.equal(
    result.events.some((event) => event.type === 'elementalist.attunement'),
    false
  );
  assert.equal(
    result.warnings.some((warning) =>
      String(warning).includes('attunement swapping is disabled by Specialized Elements')
    ),
    true
  );
});

test('Zap grants its five-second strike-damage buff', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Zap'],
    evokerElement: 'Air',
    initialEvokerCharges: 6
  });

  assert.equal(
    result.events.some((event) => event.type === 'buff' && event.kind === 'zap buff' && event.duration === 5),
    true
  );
});

test('conjured weapons enforce bundle access and preserve their pickup', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: [
      'Conjure Frost Bow',
      'Frost Volley',
      '__drop_bundle',
      'Flame Uprising',
      '__pickup_Frost Bow',
      'Frost Volley'
    ],
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Conjure Frost Bow',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Conjure Fiery Greatsword'
    }
  });

  assert.deepEqual(
    result.events.filter((event) => event.type === 'action').map((event) => event.skillName),
    ['Conjure Frost Bow', 'Frost Volley', '__drop_bundle', 'Flame Uprising', '__pickup_Frost Bow', 'Frost Volley']
  );
  assert.equal(result.endState.profession.conjureEquipped, 'Frost Bow');
  assert.equal(result.warnings.length, 0);
});

test('Rock Barrier starts its root recharge when Hurl is used', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Rock Barrier', 'Hurl', 'Rock Barrier'],
    weapons: ['Scepter', 'Warhorn'],
    startAttunement: 'Earth'
  });
  const actions = result.events.filter((event) => event.type === 'action');
  const barriers = actions.filter((event) => event.skillName === 'Rock Barrier');
  const hurl = actions.find((event) => event.skillName === 'Hurl');

  assert.equal(barriers.length, 2);
  assert.equal(barriers[0].rechargeReadyAt, null);
  assert.ok(barriers[1].at > hurl.endsAt + 5);
});

test('Elemental Explosion, Shattering Stone, and Signet of Earth commit at 480 ms', () => {
  for (const skillId of [ID.ELEMENTAL_EXPLOSION, ID.SHATTERING_STONE, ID.SIGNET_OF_EARTH]) {
    const skill = elementalistCatalog.skillsById.get(skillId);
    for (const interruptAfterMs of [440, 480]) {
      const result = runNative({
        lines: [['Fire'], ['Air'], ['Arcane']],
        rotation: [{ type: 'cast', skillId, interruptAfterMs }, 1_000],
        selectedSkills: {
          ...elementalistProfession.createBuildDefaults().selectedSkills,
          Utility1: 'Signet of Earth'
        },
        startAttunement: 'Earth',
        weapons: ['Pistol', 'Warhorn'],
        pistolBullets: { Fire: true, Water: true, Air: true, Earth: true }
      });
      const step = result.steps.find((candidate) => candidate.skillId === skillId);
      const packets = result.resolvedEvents.filter((packet) => packet.type === 'damage' && packet.skillId === skillId);

      assert.deepEqual(result.warnings, []);
      assert.equal(step.end - step.start, interruptAfterMs);
      assert.equal(step.cancelledBeforeCommit === true, interruptAfterMs < 480);
      assert.equal(packets.length > 0, interruptAfterMs >= 480, skill.name);
      assert.equal(
        result.endState.profession.pistolBullets.Earth,
        skillId === ID.SIGNET_OF_EARTH || interruptAfterMs < 480
      );
    }
  }
});

test('Pistol bullets grant, consume, and apply their payload', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Raging Ricochet', 'Raging Ricochet'],
    weapons: ['Pistol', 'Warhorn']
  });

  assert.equal(result.endState.profession.pistolBullets.Fire, false);
  assert.equal(
    result.events.some(
      (event) => event.type === 'buff' && event.source === 'Raging Ricochet' && event.kind === 'might'
    ),
    true
  );

  const unavailableExplosion = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Elemental Explosion'],
    weapons: ['Pistol', 'Warhorn']
  });

  assert.equal(
    unavailableExplosion.events.some((event) => event.type === 'action' && event.skillName === 'Elemental Explosion'),
    false
  );
  assert.match(unavailableExplosion.warnings[0], /all four elemental bullets/i);

  const explosion = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Elemental Explosion'],
    weapons: ['Pistol', 'Warhorn'],
    pistolBullets: { Fire: true, Water: true, Air: true, Earth: true }
  });

  assert.deepEqual(explosion.warnings, []);
  assert.equal(
    explosion.events.some((event) => event.type === 'action' && event.skillName === 'Elemental Explosion'),
    true
  );
  assert.deepEqual(explosion.endState.profession.pistolBullets, {
    Fire: false,
    Water: false,
    Air: false,
    Earth: false
  });
});

test('Hammer orbs block reuse and Grand Finale cancels future packets', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Flame Wheel', 'Flame Wheel', 'Grand Finale', 8000],
    weapons: ['Hammer', ''],
    gear: Object.fromEntries(
      Object.keys(elementalistProfession.createBuildDefaults().gear).map((slot) => [slot, "Assassin's"])
    ),
    weaponSigils: [
      ['Air', 'Accuracy'],
      ['Air', 'Accuracy']
    ]
  });

  assert.equal(result.events.filter((event) => event.type === 'action' && event.skillName === 'Flame Wheel').length, 1);
  assert.equal(result.endState.profession.hammerOrbs.Fire, null);
  assert.equal(
    result.events.some((event) => event.cancelled && event.detail === 'cancelled by Grand Finale'),
    true
  );
  assert.equal(
    result.warnings.some((warning) => warning.includes('Grand Finale must consume the active orb')),
    true
  );
  const finale = result.events.find((event) => event.type === 'action' && event.skillName === 'Grand Finale');
  const finaleHits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Grand Finale');

  assert.equal(finaleHits.length, 1);
  assert.equal(finaleHits[0].coefficient, 1.4);
  assert.ok(Math.abs(finaleHits[0].at - finale.endsAt - 0.68) < 0.001);
  const airProcs = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Sigil of Air'
  );

  assert.equal(airProcs.length, 1);
  assert.equal(airProcs[0].triggeredBy, 'Grand Finale');
});

test('Hammer orbs emit fifteen one-second packets and feed Fresh Air', () => {
  const packets = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Flame Wheel', 16000],
    weapons: ['Hammer', ''],
    startAttunement: 'Fire'
  });
  const strikes = packets.events.filter((event) => event.type === 'damage' && event.skillName === 'Flame Wheel');
  const burning = packets.events.filter((event) => event.type === 'condition' && event.skillName === 'Flame Wheel');

  assert.deepEqual(
    strikes.map((event) => Math.round(event.at * 1000)),
    Array.from({ length: 15 }, (_, index) => (index + 1) * 1000)
  );
  assert.equal(burning.length, 15);
  assert.ok(burning.every((event) => event.condition === 'Burning' && event.stacks === 1 && event.duration === 0.75));

  const freshAir = runNative({
    lines: [['Fire'], ['Air', '3-3-2'], ['Arcane']],
    rotation: ['Fire Attunement', 'Flame Wheel', 'Air Attunement'],
    weapons: ['Hammer', ''],
    startAttunement: 'Air'
  });
  const returnToAir = freshAir.events.find((event) => event.type === 'elementalist.attunement' && event.to === 'Air');
  const reset = freshAir.events.find((event) => event.type === 'elementalist.fresh-air');

  assert.ok(reset);
  assert.equal(returnToAir.at, reset.at);
  assert.ok(returnToAir.at < 8);
});

test('Spear etchings upgrade after three other casts', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Etching: Volcano', 'Flame Spear', 'Seethe', 'Blazing Barrage', 'Volcano'],
    weapons: ['Spear', '']
  });

  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Volcano'),
    true
  );
  assert.equal(result.endState.profession.etchings['Etching: Volcano'], null);
});

test('Spear etching stages replace one another in the weapon palette', () => {
  const family = ['Etching: Volcano', 'Lesser Volcano', 'Volcano'].map((name) =>
    elementalistCatalog.skillsByName.get(name)
  );
  const displayed = (progress) =>
    elementalistProfession.ui
      .paletteWeaponSkills(
        {
          build: { weapons: ['Spear', ''] },
          professionState: {
            etchings: progress ? { 'Etching: Volcano': progress } : {}
          }
        },
        family
      )
      .map((skill) => skill.name);

  assert.deepEqual(displayed(null), ['Etching: Volcano']);
  assert.deepEqual(displayed({ stage: 'lesser', otherCasts: 0 }), ['Lesser Volcano']);
  assert.deepEqual(displayed({ stage: 'full', otherCasts: 3 }), ['Volcano']);
});

test('Alacrity shortens overload dwell and Lucid Singularity follows hit timing', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '1-2-2']],
    rotation: [1000, 'Fire Attunement', 'Overload Fire'],
    startAttunement: 'Air'
  });
  const attunement = result.events.find((event) => event.type === 'elementalist.attunement' && event.to === 'Fire');
  const overload = result.events.find((event) => event.type === 'action' && event.skillName === 'Overload Fire');
  const alacrity = result.events.filter((event) => event.type === 'buff' && event.source === 'Lucid Singularity');

  assert.ok(Math.abs(overload.at - attunement.at - 4.8) < 0.001);
  assert.equal(alacrity.length, 5);
  assert.ok(alacrity[4].duration > alacrity[0].duration * 4);
});

test('Tempest always starts with its initial overload available', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-1']],
    rotation: ['Overload Air'],
    startAttunement: 'Air'
  });
  const overload = result.events.find((event) => event.type === 'action' && event.skillName === 'Overload Air');

  assert.equal(overload.at, 0);
});

test('Transcendent Tempest precedes same-time Overload completion damage', () => {
  const withTrait = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-1']],
    rotation: ['Overload Air'],
    startAttunement: 'Air'
  });
  const withoutTrait = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-2']],
    rotation: ['Overload Air'],
    startAttunement: 'Air'
  });
  const action = withTrait.events.find((event) => event.type === 'action' && event.skillName === 'Overload Air');
  const buff = withTrait.events.find((event) => event.type === 'buff' && event.kind === 'transcendent-tempest');
  const damageAtCompletion = (result, name) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === name)
      .sort((left, right) => left.at - right.at)
      .at(-1);
  const finalWithTrait = damageAtCompletion(withTrait, 'Overload Air');
  const finalWithoutTrait = damageAtCompletion(withoutTrait, 'Overload Air');
  const joltWithTrait = damageAtCompletion(withTrait, 'Lightning Jolt');
  const joltWithoutTrait = damageAtCompletion(withoutTrait, 'Lightning Jolt');
  const completionOrder = withTrait.events
    .filter((event) => Math.abs(event.at - action.endsAt) < 0.0001)
    .map((event) => event.kind || event.skillName);

  assert.equal(buff.at, action.endsAt);
  assert.equal(buff.priority, -10);
  assert.ok(completionOrder.indexOf('transcendent-tempest') < completionOrder.indexOf('Lightning Jolt'));
  assert.equal(finalWithTrait.damage, finalWithoutTrait.damage);
  assert.ok(joltWithTrait.damage > joltWithoutTrait.damage * 1.2);
});

test('Overload Air applies a 1.32 non-critical Lightning Jolt to the player and active elemental', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-1']],
    rotation: ['Glyph of Elementals', 'Overload Air', 10000],
    startAttunement: 'Air',
    targetHealth: 0
  });
  const jolts = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Lightning Jolt'
  );
  const playerJolt = jolts.find((event) => event.actorType === 'effect');
  const elementalJolt = jolts.find((event) => event.actorType === 'summon');
  const triggeringElementalStrike = result.resolvedEvents.find(
    (event) =>
      event.type === 'damage' &&
      event.actorType === 'summon' &&
      event.skillName !== 'Lightning Jolt' &&
      event.at === elementalJolt?.at
  );

  assert.equal(jolts.length, 2);
  assert.equal(playerJolt.coefficient, 1.32);
  assert.equal(playerJolt.resolvedWeaponStrength, 690.5);
  assert.equal(playerJolt.criticalChance, 0);
  assert.equal(elementalJolt.coefficient, 1.32);
  assert.equal(elementalJolt.resolvedWeaponStrength, 690.5);
  assert.equal(elementalJolt.criticalChance, 0);
  assert.equal(elementalJolt.independentSummonStrike, true);
  assert.equal(elementalJolt.summonUsesMight, false);
  assert.equal(elementalJolt.summonUsesProfessionModifiers, false);
  assert.ok(elementalJolt.at > playerJolt.at);
  assert.ok(triggeringElementalStrike);
});
