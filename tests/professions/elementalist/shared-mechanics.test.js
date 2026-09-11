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

test('Aerial Agility expires while its original cooldown keeps counting down', () => {
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
  // Switching variants must preserve the first variant's recharge.
  const recharge = (elementalistCatalog.skillsByName.get('Glyph of Storms (Air)').cooldown * 1000) / 1.25;
  assert.ok(casts[1].start - casts[0].start >= recharge);
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

  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Flame Burst (trait)'),
    true
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'condition' && event.skillName === 'Flame Burst (trait)' && event.condition === 'Burning'
    ),
    true
  );
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Flame Burst (trait)'),
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
  const pistolEvents = [];
  const pistolContext = {
    state: { profession: { core } },
    effectiveEnd: 1,
    config: { selectedTraitIds: [] },
    emit: (event) => pistolEvents.push(event)
  };
  const shatteringStone = {
    ...elementalistCatalog.skillsById.get(ID.SHATTERING_STONE),
    name: 'Renamed core pistol skill'
  };
  applyPistolState(pistolContext, shatteringStone);
  assert.equal(core.pistolBullets.Earth, false);
  assert.equal(pistolEvents[0].kind, 'shattering stone');
  assert.equal(pistolEvents[0].skillId, shatteringStone.id);

  const purblindingPlasma = {
    ...elementalistCatalog.skillsById.get(ID.PURBLINDING_PLASMA),
    name: 'Renamed Weaver pistol skill'
  };
  assert.equal(weaverCastRules.modifyRechargeDuration({ ...pistolContext, skill: purblindingPlasma }, 15), 10);
});

// Fire exit starts a delayed proc; its strike and Burning must land together.
test('Flame Expulsion delays both packets and uses its own icon in the damage breakdown', () => {
  const result = runNative({
    lines: [['Fire', '1-1-2'], ['Air'], ['Arcane']],
    rotation: ['Flame Uprising', 'Air Attunement', 1000],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });
  const expectedIcon = 'https://render.guildwars2.com/file/998095CB1FD2CF0164B8A36BABFDB911DF08DB02/1012313.png';
  const packet = result.events.find((event) => event.type === 'damage' && event.skillName === 'Flame Expulsion');
  const row = skillBreakdownRows(result).find((entry) => entry.name === 'Flame Expulsion');
  const exit = result.events.find((event) => event.type === 'elementalist.attunement' && event.from === 'Fire');
  const burning = result.events.find((event) => event.type === 'condition' && event.skillName === 'Flame Expulsion');

  assert.ok(packet.at > exit.at);
  assert.equal(burning.at, packet.at);
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

// Both entry paths must retain trigger attribution through strike and Burning resolution.
for (const [specialization, startAttunement, rotation, trigger] of [
  ['Arcane', 'Air', ['Lightning Strike', 'Fire Attunement', 5000], 'Fire Attunement'],
  ['Tempest', 'Fire', [6000, 'Overload Fire', 5000], 'Overload Fire']
]) {
  test(`Sunspot attributes its strike and Burning to ${trigger}`, () => {
    const result = runNative({
      lines: [['Fire', '1-1-1'], ['Air'], [specialization]],
      rotation,
      startAttunement,
      weapons: ['Scepter', 'Dagger']
    });
    const packets = result.resolvedEvents.filter(
      (event) => event.skillName === 'Sunspot' && (event.type === 'damage' || event.type === 'condition')
    );
    assert.ok(packets.some((event) => event.type === 'damage' && event.damage > 0));
    assert.ok(packets.some((event) => event.type === 'condition' && event.damage > 0));
    assert.ok(packets.every((event) => event.triggeredBy === trigger));
    const row = skillBreakdownRows(result).find((entry) => entry.name === 'Sunspot');
    const attributed = row.procDamage.find((entry) => entry.sourceSkill === trigger);
    assert.ok(attributed);
    assert.ok(Math.abs(attributed.total - row.total) < 1e-6);
    assert.ok(Math.abs(attributed.dps - row.dps) < 1e-6);
  });
}

// Attunement and overload activations must retain both the effect icon and the actual damage trigger.
for (const [specialization, startAttunement, rotation, trigger] of [
  ['Arcane', 'Air', ['Lightning Strike', 'Earth Attunement'], 'Earth Attunement'],
  ['Tempest', 'Earth', [6000, 'Overload Earth'], 'Overload Earth']
]) {
  test(`Earthen Blast preserves its icon and attributes damage to ${trigger}`, () => {
    const result = runNative({
      lines: [['Earth'], ['Air'], [specialization]],
      rotation,
      startAttunement,
      weapons: ['Scepter', 'Dagger']
    });
    const expectedIcon = 'https://render.guildwars2.com/file/2531DCAFAEAB452C90C4572E1ADCE8236DCF5636/1012304.png';
    const packet = result.events.find((event) => event.type === 'damage' && event.skillName === 'Earthen Blast');
    const row = skillBreakdownRows(result).find((entry) => entry.name === 'Earthen Blast');

    assert.equal(packet?.icon, expectedIcon);
    assert.equal(row?.icon, expectedIcon);
    const damage = result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.skillName === 'Earthen Blast'
    );
    assert.ok(damage?.damage > 0);
    assert.equal(damage.triggeredBy, trigger);
    const attributed = row.procDamage.find((entry) => entry.sourceSkill === trigger);
    assert.ok(attributed);
    assert.equal(attributed.total, row.total);
    assert.equal(attributed.dps, row.dps);
  });
}

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
  assert.equal(barriers[1].at - hurl.endsAt, elementalistCatalog.skillsByName.get('Rock Barrier').cooldown / 1.25);
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
  assert.ok(finaleHits[0].at > finale.endsAt);
  const airProcs = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Sigil of Air'
  );

  assert.equal(airProcs.length, 1);
  assert.equal(airProcs[0].triggeredBy, 'Grand Finale');
});

test('Hammer orb strikes carry Burning and feed Fresh Air', () => {
  const packets = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Flame Wheel', 16000],
    weapons: ['Hammer', ''],
    startAttunement: 'Fire'
  });
  const strikes = packets.events.filter((event) => event.type === 'damage' && event.skillName === 'Flame Wheel');
  const burning = packets.events.filter((event) => event.type === 'condition' && event.skillName === 'Flame Wheel');

  // Orb conditions follow their strikes, independent of the authored pulse schedule.
  assert.ok(strikes.length > 1);
  assert.deepEqual(
    burning.map((event) => [event.at, event.condition]),
    strikes.map((event) => [event.at, 'Burning'])
  );

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

test('Spear etchings expire at the field boundary and cannot charge afterward', () => {
  // Exercise expiry through the scheduler so both payoff gates and the palette see the cleared state.
  for (const attunement of ['Fire', 'Water', 'Air', 'Earth']) {
    const root = [...elementalistCatalog.skillsById.values()].find(
      (skill) => skill.name.startsWith('Etching:') && skill.attunement === attunement
    );
    const result = runNative({
      lines: [['Fire'], ['Air'], ['Arcane']],
      rotation: [root.name, Number(root.comboFields[0].duration) * 1000],
      startAttunement: attunement,
      weapons: ['Spear', '']
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.endState.profession.etchings[root.name], null, root.name);
    assert.ok(
      elementalistProfession.ui
        .paletteWeaponSkills({ build: { weapons: ['Spear', ''] }, professionState: result.endState.profession }, [root])
        .includes(root)
    );
  }

  for (const rotation of [
    ['Etching: Volcano', 10000, 'Flame Spear', 'Seethe', 'Blazing Barrage', 'Volcano'],
    ['Etching: Volcano', 7000, 'Lesser Volcano'],
    ['Etching: Volcano', 'Flame Spear', 'Seethe', 'Blazing Barrage', 7000, 'Volcano']
  ]) {
    const result = runNative({ lines: [['Fire'], ['Air'], ['Arcane']], rotation, weapons: ['Spear', ''] });
    assert.equal(result.endState.profession.etchings['Etching: Volcano'], null);
    assert.equal(
      result.events.some((event) => event.type === 'action' && ['Volcano', 'Lesser Volcano'].includes(event.skillName)),
      false
    );
    assert.ok(result.warnings.some((warning) => warning.includes('Volcano')));
  }

  const renewed = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Etching: Volcano', 10000, 'Etching: Volcano', 'Flame Spear', 'Seethe', 'Blazing Barrage', 'Volcano'],
    weapons: ['Spear', '']
  });
  assert.deepEqual(renewed.warnings, []);
  assert.ok(renewed.events.some((event) => event.type === 'action' && event.skillName === 'Volcano'));
});

test('Tempest overloads retain their full etching charge only within the active field', () => {
  // The extra overload charges must survive the expiry fix without extending or reviving the field.
  for (const [attunement, etching, payoff] of [
    ['Fire', 'Etching: Volcano', 'Volcano'],
    ['Air', 'Etching: Derecho', 'Derecho'],
    ['Earth', 'Etching: Haboob', 'Haboob']
  ]) {
    for (const wait of [0, 10000]) {
      const result = runNative({
        lines: [['Fire'], ['Air'], ['Tempest']],
        rotation: [etching, wait, `Overload ${attunement}`, payoff],
        startAttunement: attunement,
        weapons: ['Spear', '']
      });
      assert.equal(
        result.events.some((event) => event.type === 'action' && event.skillName === payoff),
        wait === 0,
        `${attunement} overload after ${wait} ms`
      );
      if (wait === 0) assert.deepEqual(result.warnings, []);
      else assert.ok(result.warnings.some((warning) => warning.includes(payoff)));
    }

    const expired = runNative({
      lines: [['Fire'], ['Air'], ['Tempest']],
      rotation: [etching, `Overload ${attunement}`, 7000, payoff],
      startAttunement: attunement,
      weapons: ['Spear', '']
    });
    assert.equal(expired.endState.profession.etchings[etching], null);
    assert.equal(
      expired.events.some((event) => event.type === 'action' && event.skillName === payoff),
      false
    );
  }
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
