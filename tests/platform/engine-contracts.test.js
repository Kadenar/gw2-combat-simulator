import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import {
  deriveAutoattackChains,
  indexAutoattackChains,
  resolveAutoattackChainStep
} from '#gw2/platform/engine/skills/autoattack-chains.js';
import { conditionTimeline, strikeTimeline } from '#gw2/platform/engine/effects/factories.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { HandlerRegistry, OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/engine/resolution/handler-registry.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { normalizeRotation } from '#gw2/platform/engine/execution/rotation.js';
import { createSchedulerState } from '#gw2/platform/engine/execution/state.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { replaceSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { professionRegistry } from '#gw2/app/profession/registry.js';
import { testProfession } from '../fixtures/test-profession.js';
import { isStandardBoon } from '#gw2/platform/combat/state/boons.js';

test('native professions share one skill timing contract', async () => {
  for (const entry of professionRegistry) {
    const catalog = (await entry.loadProfession()).catalog;

    for (const skill of catalog.skills) {
      assert.equal('activation' in skill, false, skill.name);
      assert.equal('castTime' in skill, false, skill.name);
      assert.ok(Number.isFinite(skill.castTimeMs), skill.name);

      if (skill.quicknessCastTimeMs != null) {
        assert.equal(skill.castTimeMs, skill.quicknessCastTimeMs * 1.5, skill.name);
      }

      if (skill.unaffectedByQuickness) {
        assert.equal(skill.quicknessCastTimeMs, undefined, skill.name);
      }

      assert.ok(Array.isArray(skill.lockouts), skill.name);
      for (const effect of skill.effects) {
        assert.equal('atMsList' in effect, false, skill.name);
        assert.equal('packetOffsets' in effect, false, skill.name);
        assert.equal('atCastEndOffsetMs' in effect, false, skill.name);
        assert.equal(effect.timingAnchor == null, effect.timingScale == null, skill.name);
      }
    }
  }
});

test('GW2 catalogs separate standard boons from generic timed buffs', async () => {
  for (const entry of professionRegistry) {
    const catalog = (await entry.loadProfession()).catalog;
    const records = [...catalog.skills, ...(catalog.balanceProfiles || [])];
    for (const record of records) {
      for (const status of record.effects || []) {
        if (status.type === 'boon') {
          assert.equal(
            isStandardBoon(status.boon),
            true,
            `${entry.id}: ${record.name} uses nonstandard boon ${status.boon}`
          );
        } else if (status.type === 'buff') {
          assert.equal(
            isStandardBoon(status.kind),
            false,
            `${entry.id}: ${record.name} authors standard boon ${status.kind} as a generic buff`
          );
        }
      }
    }
  }
});

test('canonical skills derive base casts and can opt out of Quickness', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930000,
        name: 'Derived Base Cast',
        quicknessCastTimeMs: 600,
        effects: []
      },
      {
        id: 930001,
        name: 'Quickness Immune Cast',
        castTimeMs: 700,
        unaffectedByQuickness: true,
        effects: []
      }
    ]
  });

  assert.deepEqual(
    [catalog.skillsById.get(930000).castTimeMs, catalog.skillsById.get(930000).quicknessCastTimeMs],
    [900, 600]
  );
  assert.deepEqual(
    [catalog.skillsById.get(930001).castTimeMs, catalog.skillsById.get(930001).unaffectedByQuickness],
    [700, true]
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930002,
            name: 'Conflicting Quickness Cast',
            castTimeMs: 700,
            quicknessCastTimeMs: 500,
            unaffectedByQuickness: true
          }
        ]
      }),
    /cannot specify quicknessCastTimeMs/
  );
});

test('native profession weapon swaps share timing policy except Elementalist', async () => {
  for (const entry of professionRegistry) {
    const catalog = (await entry.loadProfession()).catalog;
    const skill = catalog.skillsByName.get('Swap Weapons');

    if (entry.id === 'elementalist') {
      assert.equal(skill, undefined, entry.id);
      continue;
    }

    assert.ok(skill, entry.id);
    assert.equal(skill.castTimeMs, 0, entry.id);
    assert.equal(Number(skill.quicknessCastTimeMs || 0), 0, entry.id);
    assert.equal(skill.rechargeAnchor, 'castStart', entry.id);
  }
});

test('profession contract supplies defaults and deterministic hook ordering', () => {
  const calls = [];
  const profession = defineProfession({
    id: 'ordered',
    name: 'Ordered',
    schedulerHooks: {
      initialize: [
        { id: 'later', order: 20, handler: () => calls.push('later') },
        { id: 'first', order: 10, handler: () => calls.push('first') },
        { id: 'same', order: 10, handler: () => calls.push('same') }
      ]
    },
    resolverHooks: {
      eventReactions: {
        control: [
          {
            id: 'later-control',
            order: 20,
            handler: () => calls.push('later-control')
          },
          {
            id: 'first-control',
            order: 10,
            handler: () => calls.push('first-control')
          }
        ]
      }
    }
  });

  profession.initialize({});
  assert.deepEqual(calls, ['first', 'same', 'later']);
  profession.eventReactions.control({}, { type: 'control' });
  assert.deepEqual(calls, ['first', 'same', 'later', 'first-control', 'later-control']);
  assert.deepEqual(profession.availability({}, {}), { ready: true });
  assert.deepEqual(profession.createProfessionState({}), {});
  assert.equal(profession.modifyStrikeDamage({}, 12), 12);
  assert.deepEqual(profession.paletteGroups({}), []);
});

test('profession contract supports zero or multiple resource views', () => {
  const none = defineProfession({
    id: 'resourceless',
    name: 'Resourceless'
  });
  const multiple = defineProfession({
    id: 'multi-resource',
    name: 'Multi Resource',
    ui: {
      resourceViews: () => [
        { id: 'pages', maximum: 5, value: 2 },
        { id: 'charges', maximum: 3, value: 1 }
      ]
    }
  });

  assert.deepEqual(none.ui.resourceViews({}), []);
  assert.equal(multiple.ui.resourceViews({}).length, 2);
});

test('shared autoattack helpers derive and index ID-based chains', () => {
  const chains = deriveAutoattackChains([
    { id: 1, type: 'Weapon', slot: 'Weapon_1', nextChainId: 2 },
    { id: 2, type: 'Weapon', slot: 'Weapon_1', nextChainId: 3 },
    { id: 3, type: 'Weapon', slot: 'Weapon_1', nextChainId: null }
  ]);

  assert.deepEqual(chains, [[1, 2, 3]]);
  assert.deepEqual(indexAutoattackChains(chains).get(2), {
    root: 1,
    index: 1,
    step: 2,
    next: 3
  });
});

test('shared autoattack helper resolves root and progressed chain expectations', () => {
  const positions = indexAutoattackChains([[1, 2, 3]]);

  assert.deepEqual(resolveAutoattackChainStep(positions, {}, 1), {
    position: positions.get(1),
    expectedSkillId: 1,
    matchesExpectedStep: true
  });
  assert.deepEqual(resolveAutoattackChainStep(positions, { 1: 2 }, 1), {
    position: positions.get(1),
    expectedSkillId: 2,
    matchesExpectedStep: false
  });
  assert.deepEqual(resolveAutoattackChainStep(positions, { 1: 2 }, 2), {
    position: positions.get(2),
    expectedSkillId: 2,
    matchesExpectedStep: true
  });
  assert.equal(resolveAutoattackChainStep(positions, { 1: 2 }, 99), null);
});

test('canonical catalogs own derived and exceptional autoattack chains', () => {
  const skill = (id, nextChainId = null, type = 'Weapon') => ({
    id,
    name: `Skill ${id}`,
    type,
    slot: type === 'Weapon' ? 'Weapon_1' : 'Profession_1',
    nextChainId
  });
  const catalog = createCanonicalCatalog({
    generated: [
      skill(1, 2),
      skill(2, 3),
      skill(3),
      skill(4, 5),
      skill(5),
      skill(6, null, 'Profession'),
      skill(7, null, 'Profession')
    ],
    autoattackChains: {
      excludeSkillIds: [5],
      additional: [[6, 7]]
    }
  });

  assert.deepEqual(catalog.autoattackChains, [
    [1, 2, 3],
    [6, 7]
  ]);
  assert.deepEqual(catalog.autoattackChainPositions.get(2), {
    root: 1,
    index: 1,
    step: 2,
    next: 3
  });
  assert.equal(catalog.skillsById.get(2).chainRoot, 1);
  assert.equal(catalog.skillsById.get(2).chainStep, 2);
  assert.equal(catalog.skillsById.get(4).chainRoot, null);
  assert.equal(catalog.skillsById.get(5).chainStep, null);
  assert.equal(catalog.skillsById.get(7).chainRoot, 6);
});

test('declarative boons can gate dynamic skill availability', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 920001,
        name: 'Grant Aegis',
        castTimeMs: 0,
        effects: [
          {
            type: 'boon',
            boon: 'aegis',
            duration: 2,
            stacks: 1
          }
        ]
      },
      {
        id: 920002,
        name: 'Aegis Strike',
        type: 'Utility',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ]
  });
  const profession = defineProfession({
    id: 'boon-gated',
    name: 'Boon Gated',
    catalog,
    castRules: {
      availability: (context) =>
        context.skill.id !== 920002 || context.hasBuff('aegis')
          ? { ready: true }
          : {
              ready: false,
              retryAt: null,
              code: 'fixture.aegis-required',
              reason: 'Aegis Strike is unavailable — requires aegis.'
            }
    }
  });
  const available = simulateGw2({
    profession,
    rotation: ['Grant Aegis', 'Aegis Strike']
  });
  const expired = simulateGw2({
    profession,
    rotation: ['Grant Aegis', { type: 'wait', durationMs: 2100 }, 'Aegis Strike']
  });
  const extended = simulateGw2({
    profession,
    rotation: ['Grant Aegis', { type: 'wait', durationMs: 3100 }, 'Aegis Strike'],
    config: { stats: { concentration: 1500 } }
  });

  assert.ok(available.totalDamage > 0);
  assert.equal(expired.totalDamage, 0);
  assert.ok(extended.totalDamage > 0);
  assert.match(expired.warnings.join(' '), /unavailable/);
});

test('declarative generic buffs use shared timed state without boon-duration scaling', () => {
  let observedAsBuff = false;
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 920011,
        name: 'Grant Trait Buff',
        castTimeMs: 0,
        effects: [{ type: 'buff', kind: 'trait-charge', duration: 10, stacks: 3 }]
      },
      {
        id: 920012,
        name: 'Inspect Trait Buff',
        castTimeMs: 0,
        handlerId: 'fixture.inspect-buff',
        effects: []
      }
    ],
    skillHandlers: {
      'fixture.inspect-buff': replaceSkillHandler((context) => {
        observedAsBuff = context.hasBuff('trait-charge');
      })
    }
  });
  const profession = defineProfession({
    id: 'buff-state-fixture',
    name: 'Buff State Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: ['Grant Trait Buff', 'Inspect Trait Buff'],
    config: { stats: { concentration: 1500 } }
  });
  const application = result.events.find((event) => event.type === 'buff' && event.kind === 'trait-charge');

  assert.equal(observedAsBuff, true);
  assert.equal(application?.duration, 10);
});

test('handler registry rejects duplicates and missing required handlers', () => {
  const registry = new HandlerRegistry().register('damage', () => {}).register('observable', OBSERVABLE_EVENT_HANDLER);

  assert.equal(registry.dispatch({ type: 'observable' }, {}), undefined);
  assert.throws(() => registry.register('damage', () => {}), /Duplicate event handler/);
  assert.throws(() => registry.require(['condition']), /Missing required/);
  assert.throws(() => registry.dispatch({ type: 'unknown' }, {}), /No event handler/);
});

test('generic scheduler state contains no profession-specific fields', () => {
  const state = createSchedulerState({ profession: testProfession });

  assert.deepEqual(
    Object.keys(state).sort(),
    ['activeWeaponSet', 'ammo', 'cooldowns', 'lockouts', 'pendingEvents', 'profession', 'skillUses', 'time'].sort()
  );
  assert.deepEqual(state.profession, { charge: 0, controlEvents: 0 });
  assert.equal(Object.hasOwn(state, 'clones'), false);
  assert.equal(Object.hasOwn(state, 'numericResource'), false);
});

test('normalized commands migrate legacy cast options', () => {
  assert.deepEqual(
    normalizeRotation(
      [
        'Fixture Slash',
        { name: '__wait', waitMs: 250 },
        {
          name: 'Fixture Charge',
          offset: 100,
          interruptMs: 50,
          offTarget: true,
          releaseAtCharges: 3,
          doubleEdgeOutcome: 'backfire'
        },
        '__cooldown_reset',
        '__combat_start'
      ],
      testProfession.catalog
    ),
    [
      { type: 'cast', skillId: 900001 },
      { type: 'wait', durationMs: 250 },
      {
        type: 'cast',
        skillId: 900002,
        offTarget: true,
        concurrentOffsetMs: 100,
        interruptAfterMs: 50,
        releaseAtCharges: 3,
        doubleEdgeOutcome: 'backfire'
      },
      { type: 'cooldown-reset' },
      { type: 'combat-start' }
    ]
  );
  assert.throws(
    () =>
      normalizeRotation([{ name: 'Fixture Charge', releaseAtCharges: 0 }], testProfession.catalog, { strict: true }),
    /positive whole number/
  );
  assert.throws(
    () =>
      normalizeRotation([{ name: 'Fixture Charge', doubleEdgeOutcome: 'random' }], testProfession.catalog, {
        strict: true
      }),
    /either success or backfire/
  );
  assert.throws(
    () => normalizeRotation([{ name: 'Fixture Charge', offTarget: 'yes' }], testProfession.catalog, { strict: true }),
    /Off-target cast must be a boolean/
  );
});

test('off-target casts retain their activation while hostile packets miss the target', () => {
  const result = simulateGw2({
    profession: testProfession,
    rotation: [{ type: 'cast', skillId: 900001, offTarget: true }],
    config: {
      attributes: { power: 1000, precision: 1000, ferocity: 0, conditionDamage: 0 },
      target: { armor: 2597 },
      weaponStrength: 1000
    }
  });
  const activationEvents = result.events.filter((event) => event.sourceId === 900001);

  assert.equal(result.steps[0].end, 1000);
  assert.equal(
    activationEvents.every((event) => event.offTarget === true),
    true
  );
  assert.equal(
    activationEvents.some((event) => event.type === 'damage'),
    true
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage'),
    false
  );
  assert.equal(result.endState.profession.controlEvents, 0);
});

test('normalized commands preserve signed combat-start offsets', () => {
  assert.deepEqual(
    normalizeRotation(['Fixture Slash', { name: '__combat_start', offset: 100 }], testProfession.catalog),
    [
      { type: 'cast', skillId: 900001 },
      { type: 'combat-start', concurrentOffsetMs: 100 }
    ]
  );
  assert.deepEqual(
    normalizeRotation(['Fixture Slash', { name: '__combat_start', offset: -440 }], testProfession.catalog),
    [
      { type: 'cast', skillId: 900001 },
      { type: 'combat-start', concurrentOffsetMs: -440 }
    ]
  );
});

test('generic simulation starts combat at a delayed marker within a cast', () => {
  const result = simulateGw2({
    profession: testProfession,
    rotation: ['Fixture Slash', { name: '__combat_start', offset: 100 }, { type: 'wait', durationMs: 1000 }],
    config: {
      attributes: {
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 0
      },
      target: { armor: 2597 },
      weaponStrength: 1000
    }
  });
  const marker = result.events.find((event) => event.type === 'combat_start');

  assert.equal(marker.at, 0.1);
  assert.equal(result.firstHitTime, 1);
  assert.equal(result.dpsStartTime, 1);
  assert.equal(result.dpsWindow, 1);
  assert.equal(result.dps, result.totalDamage);
});

test('queued instant casts use the combat marker when their requested overlap has passed', () => {
  const result = createScheduler({ profession: testProfession }).run([
    { type: 'cast', skillId: 900001 },
    { type: 'combat-start', concurrentOffsetMs: 500 },
    { type: 'cast', skillId: 900002, concurrentOffsetMs: 0 }
  ]);

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => [step.skill, step.start]),
    [
      ['Fixture Slash', 0],
      ['Combat Start', 500],
      ['Fixture Charge', 500]
    ]
  );
});

test('generic simulation uses the first hit after a standalone combat marker', () => {
  const result = simulateGw2({
    profession: testProfession,
    rotation: ['__combat_start', 'Fixture Slash', { type: 'wait', durationMs: 1000 }],
    config: {
      attributes: {
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 0
      },
      target: { armor: 2597 },
      weaponStrength: 1000
    }
  });

  assert.equal(result.firstHitTime, 1);
  assert.equal(result.dpsStartTime, result.firstHitTime);
  assert.equal(result.dpsWindow, 1);
  assert.equal(result.dps, result.totalDamage);
});

test('concurrent and interrupted casts are first-class scheduler commands', () => {
  const scheduler = createScheduler({ profession: testProfession });
  const result = scheduler.run([
    { type: 'cast', skillId: 900001, interruptAfterMs: 400 },
    { type: 'cast', skillId: 900002, concurrentOffsetMs: 100 }
  ]);
  const slash = result.events.find((event) => event.sourceId === 900001);
  const charge = result.events.find((event) => event.type === 'action' && event.sourceId === 900002);

  assert.equal(slash.endsAt, 0.4);
  assert.equal(slash.interrupted, true);
  assert.equal(charge.at, 0.1);
  assert.equal(
    result.events.some((event) => event.type === 'damage' && event.sourceId === 900001),
    false
  );
});

test('independent casts use a separate serial cast lane', () => {
  const profession = defineProfession({
    id: 'independent-casts',
    name: 'Independent Casts',
    catalog: createCanonicalCatalog({
      generated: [
        {
          id: 910001,
          name: 'Player Cast One',
          castTimeMs: 1000,
          effects: []
        },
        {
          id: 910002,
          name: 'Companion Cast',
          castTimeMs: 2000,
          independentCast: true,
          effects: []
        },
        {
          id: 910003,
          name: 'Player Cast Two',
          castTimeMs: 500,
          effects: []
        }
      ]
    })
  });
  const result = createScheduler({ profession }).run(['Player Cast One', 'Companion Cast', 'Player Cast Two']);
  const [first, companion, second] = result.steps;

  assert.equal(first.start, 0);
  assert.equal(first.end, 1000);
  assert.equal(companion.start, 0);
  assert.equal(companion.end, 2000);
  assert.equal(second.start, 1000);
  assert.equal(second.end, 1500);
  assert.equal(result.state.time, 2);
});

test('test profession runs end to end without importing Mesmer', () => {
  const base = simulateGw2({
    profession: testProfession,
    rotation: [
      { type: 'cast', skillId: 900001 },
      { type: 'cast', skillId: 900002 }
    ],
    config: {
      selectedTraitIds: ['fixture.power'],
      attributes: {
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 0
      },
      target: { armor: 2597 },
      weaponStrength: 1000
    }
  });
  const withoutTrait = simulateGw2({
    profession: testProfession,
    rotation: [{ type: 'cast', skillId: 900001 }],
    config: {
      attributes: {
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 0
      },
      target: { armor: 2597 },
      weaponStrength: 1000
    }
  });

  assert.ok(base.totalDamage > withoutTrait.totalDamage);
  assert.equal(base.profession.charge, 1);
  assert.equal(base.profession.controlEvents, 1);
  assert.equal(base.schedulerState.profession.charge, 0);
  assert.equal(
    base.events.every((event) => event.type && Number.isFinite(event.at) && event.source && event.sourceId != null),
    true
  );
});

test('declarative ammo consumes and recharges shared charges', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930001,
        name: 'Fixture Ammo',
        type: 'Utility',
        castTimeMs: 0,
        cooldown: 0.25,
        recharge: 0.25,
        ammo: 2,
        ammoRecharge: 5,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ]
  });
  const profession = defineProfession({
    id: 'ammo-fixture',
    name: 'Ammo Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: ['Fixture Ammo', 'Fixture Ammo', { type: 'wait', durationMs: 5000 }]
  });

  assert.equal(result.resolvedEvents.filter((event) => event.type === 'damage').length, 2);
  assert.deepEqual(
    result.events.filter((event) => event.type === 'action').map((event) => event.at),
    [0, 0.25]
  );
  assert.deepEqual(result.endState.ammo['Fixture Ammo'], {
    charges: 1,
    maximum: 2,
    rechargeDuration: 5,
    nextRechargeAt: 10
  });
});

test("shared scheduler waits until a skill's exact cooldown expiry", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930002,
        name: 'Fixture Cooldown',
        type: 'Utility',
        castTimeMs: 0,
        cooldown: 0.3,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ]
  });
  const profession = defineProfession({
    id: 'cooldown-fixture',
    name: 'Cooldown Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: ['Fixture Cooldown', 'Fixture Cooldown']
  });
  const actions = result.events.filter((event) => event.type === 'action');

  assert.deepEqual(
    actions.map((event) => event.at),
    [0, 0.3]
  );
  assert.deepEqual(
    result.steps.map((step) => step.start),
    [0, 300]
  );
  assert.equal(result.endState.time, 300);
  assert.equal(result.endState.cooldowns['Fixture Cooldown'].readyAt, 600);
  assert.deepEqual(result.warnings, []);
});

test('declarative multi-hit and delayed effects preserve individual events', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930010,
        name: 'Fixture Flurry',
        type: 'Weapon',
        weapon: 'Greatsword',
        castTimeMs: 300,
        effects: [
          {
            type: 'strike',
            ticks: [
              { atMs: 66.666667, coefficient: 1 },
              { atMs: 133.333334, coefficient: 1 },
              { atMs: 200, coefficient: 1 }
            ],
            timingAnchor: 'castStart',
            timingScale: 'cast'
          },
          {
            type: 'strike',
            coefficient: 1,
            atMs: 1000,
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          }
        ]
      }
    ],
    weapons: ['Greatsword'],
    weaponHands: { Greatsword: '2h' }
  });
  const profession = defineProfession({
    id: 'multi-hit-fixture',
    name: 'Multi Hit Fixture',
    catalog,
    resources: {
      createProfessionState: () => ({ hits: 0 })
    },
    resolverHooks: {
      eventReactions: {
        'damage.resolved': (context) => {
          context.profession.hits += 1;
        }
      }
    }
  });
  const result = simulateGw2({
    profession,
    rotation: ['Fixture Flurry', { type: 'wait', durationMs: 1000 }]
  });
  const events = result.resolvedEvents.filter((event) => event.type === 'damage');

  assert.deepEqual(
    events.map((event) => Number(event.at.toFixed(3))),
    [0.1, 0.2, 0.3, 1]
  );
  assert.deepEqual(
    events.map((event) => event.hitIndex),
    [1, 2, 3, 1]
  );
  assert.equal(result.endState.profession.hits, 4);
});

test('declarative repeated statuses keep fixed pulse intervals', () => {
  const timing = {
    applications: 3,
    atMs: 200,
    intervalMs: 1000,
    intervalTimingScale: 'fixed',
    timingAnchor: 'castStart',
    timingScale: 'cast'
  };
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930037,
        name: 'Fixture Pulses',
        castTimeMs: 600,
        effects: [
          {
            type: 'blind',
            ...timing
          },
          {
            type: 'condition',
            condition: 'Crippled',
            stacks: 1,
            duration: 2,
            ...timing
          }
        ]
      }
    ]
  });
  const profession = defineProfession({
    id: 'pulse-fixture',
    name: 'Pulse Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: ['Fixture Pulses', { type: 'wait', durationMs: 2500 }],
    config: { boons: { quickness: true } }
  });
  const timestamps = (type) =>
    result.events.filter((event) => event.type === type).map((event) => Math.round(event.at * 1000));

  assert.deepEqual(timestamps('blind'), [200, 1200, 2200]);
  assert.deepEqual(timestamps('condition'), [200, 1200, 2200]);
});

test('declarative strike timelines preserve per-hit coefficients and shared timestamps', () => {
  // Cast-relative fixtures are authored on the Quickness timeline; the normal
  // simulation expands them back to the unquickened packet schedule.
  const ticks = [
    { atMs: 0, coefficient: 0.2 },
    { atMs: 382.57, coefficient: 0.2 },
    { atMs: 670, coefficient: 0.5 },
    { atMs: 765.14, coefficient: 0.2 },
    { atMs: 1148.38, coefficient: 0.2 },
    { atMs: 1340, coefficient: 0.5 },
    { atMs: 1530.95, coefficient: 0.2 },
    { atMs: 1914.19, coefficient: 0.2 },
    { atMs: 2010, coefficient: 0.5 },
    { atMs: 2296.76, coefficient: 0.2 },
    { atMs: 2680, coefficient: 0.2 },
    { atMs: 2680, coefficient: 0.5 }
  ];
  const unquickenedAtMs = [0, 571, 1000, 1142, 1714, 2000, 2285, 2857, 3000, 3428, 4000, 4000];
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930023,
        name: 'Fixture Variable Hits',
        type: 'Utility',
        castTimeMs: 4000,
        effects: [
          strikeTimeline(ticks, {
            timingAnchor: 'castStart',
            timingScale: 'cast'
          })
        ]
      }
    ]
  });
  const profession = defineProfession({
    id: 'variable-hit-fixture',
    name: 'Variable Hit Fixture',
    catalog
  });
  const simulate = (quickness) =>
    simulateGw2({
      profession,
      rotation: ['Fixture Variable Hits'],
      config: { boons: { quickness } }
    });
  const normal = simulate(false);
  const quick = simulate(true);
  const normalHits = normal.resolvedEvents.filter((event) => event.type === 'damage');
  const quickHits = quick.resolvedEvents.filter((event) => event.type === 'damage');
  const quickAction = quick.events.find((event) => event.type === 'action');

  assert.deepEqual(
    normalHits.map((event) => Math.round(event.at * 1000)),
    unquickenedAtMs
  );
  assert.deepEqual(
    normalHits.map((event) => event.coefficient),
    ticks.map((tick) => tick.coefficient)
  );
  assert.deepEqual(
    normalHits.slice(-2).map((event) => [Number(event.at.toFixed(6)), event.coefficient]),
    [
      [4, 0.2],
      [4, 0.5]
    ]
  );
  assert.ok(Math.abs(normalHits.reduce((sum, event) => sum + event.coefficient, 0) - 3.6) < 1e-12);
  assert.equal(Math.round((quickAction.endsAt - quickAction.at) * 1000), 2680);
  assert.deepEqual(
    quickHits.slice(-2).map((event) => [Math.round(event.at * 1000), event.coefficient]),
    [
      [2680, 0.2],
      [2680, 0.5]
    ]
  );
});

test('declarative condition timelines preserve each application', () => {
  const ticks = [
    {
      atMs: 0,
      condition: 'Burning',
      stacks: 1,
      duration: 2
    },
    {
      atMs: 340,
      condition: 'Bleeding',
      stacks: 2,
      duration: 4
    },
    {
      atMs: 1360,
      condition: 'Poisoned',
      stacks: 1,
      duration: 3
    },
    {
      atMs: 1360,
      condition: 'Burning',
      stacks: 3,
      duration: 5
    }
  ];
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930025,
        name: 'Fixture Variable Conditions',
        castTimeMs: 2000,
        effects: [
          conditionTimeline(ticks, {
            timingAnchor: 'castStart',
            timingScale: 'cast'
          })
        ]
      }
    ]
  });
  const profession = defineProfession({
    id: 'condition-timeline-fixture',
    name: 'Condition Timeline Fixture',
    catalog
  });
  const simulate = (quickness) =>
    simulateGw2({
      profession,
      rotation: ['Fixture Variable Conditions'],
      config: { boons: { quickness } }
    });
  const normal = simulate(false);
  const quick = simulate(true);
  const normalApplications = normal.resolvedEvents.filter((event) => event.type === 'condition');
  const quickApplications = quick.resolvedEvents.filter((event) => event.type === 'condition');
  const quickAction = quick.events.find((event) => event.type === 'action');

  assert.deepEqual(
    normalApplications.map((event) => ({
      atMs: Math.round(event.at * 1000),
      condition: event.condition,
      stacks: event.stacks,
      duration: event.duration
    })),
    [
      { ...ticks[0], atMs: 0 },
      { ...ticks[1], atMs: 500 },
      { ...ticks[2], atMs: 2000 },
      { ...ticks[3], atMs: 2000 }
    ]
  );
  assert.deepEqual(
    normalApplications.slice(-2).map((event) => [Number(event.at.toFixed(6)), event.condition]),
    [
      [2, 'Poisoned'],
      [2, 'Burning']
    ]
  );
  assert.ok(normal.conditionDamage > 0);
  assert.equal(Math.round((quickAction.endsAt - quickAction.at) * 1000), 1360);
  assert.deepEqual(
    quickApplications.slice(-2).map((event) => [Math.round(event.at * 1000), event.condition]),
    [
      [1360, 'Poisoned'],
      [1360, 'Burning']
    ]
  );
});

test('canonical strike timelines reject invalid or ambiguous hits', () => {
  const skillWithTicks = (ticks) => ({
    id: 930024,
    name: 'Invalid Tick Fixture',
    effects: [
      {
        type: 'strike',
        ticks,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  });

  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          skillWithTicks([
            { atMs: 100, coefficient: 0.2 },
            { atMs: 50, coefficient: 0.5 }
          ])
        ]
      }),
    /chronological/
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [skillWithTicks([{ atMs: 0, coefficient: -0.2 }])]
      }),
    /non-negative coefficient/
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            ...skillWithTicks([{ atMs: 0, coefficient: 0.2 }]),
            effects: [
              {
                type: 'strike',
                coefficient: 0.2,
                ticks: [{ atMs: 0, coefficient: 0.2 }],
                timingAnchor: 'castStart',
                timingScale: 'fixed'
              }
            ]
          }
        ]
      }),
    /cannot use aggregate/
  );
});

test('canonical strikes distinguish one timestamp from an explicit packet timeline', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930027,
        name: 'Canonical Strike Forms',
        castTimeMs: 0,
        effects: [
          { type: 'strike', name: 'Single', coefficient: 1.8, hits: 1, atMs: 360 },
          { type: 'strike', name: 'Simultaneous', coefficient: 1.8, hits: 2, atMs: 360 },
          {
            type: 'strike',
            name: 'Timeline',
            ticks: [
              { atMs: 360, coefficient: 0.9 },
              { atMs: 860, coefficient: 0.9 }
            ]
          }
        ]
      }
    ]
  });
  const skill = catalog.skillsById.get(930027);
  const packets = skill.effects.map((effect) =>
    materializeSkillEffectApplications({
      skill,
      effect,
      start: 0,
      fullEnd: 0,
      baseEvent: { source: 'Fixture', sourceId: skill.id }
    }).map(({ at, event }) => [Math.round(at * 1000), event.coefficient])
  );

  assert.deepEqual(packets, [
    [[360, 1.8]],
    [
      [360, 0.9],
      [360, 0.9]
    ],
    [
      [360, 0.9],
      [860, 0.9]
    ]
  ]);
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930028,
            name: 'Untimed Aggregate',
            effects: [{ type: 'strike', coefficient: 1.8, hits: 2 }]
          }
        ]
      }),
    /explicit atMs/
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930029,
            name: 'Interval Aggregate',
            effects: [{ type: 'strike', coefficient: 1.8, hits: 2, atMs: 360, intervalMs: 500 }]
          }
        ]
      }),
    /explicit tick timeline/
  );
});

test('strike ticks preserve independent summon formula fields at runtime', () => {
  const [application] = materializeSkillEffectApplications({
    skill: { id: 930044, name: 'Independent Summon Strike' },
    effect: {
      type: 'strike',
      ticks: [
        {
          atMs: 1000,
          coefficient: 0.2,
          name: 'Summon Pulse',
          weaponStrength: 2880,
          independentSummonStrike: true,
          summonUsesProfessionModifiers: true,
          summonInheritsAttributes: true,
          summonInheritsCriticalAttributes: true
        }
      ]
    },
    start: 0,
    fullEnd: 0,
    baseEvent: { source: 'fixture-summon', sourceId: 930044, actorType: 'summon' }
  });

  assert.deepEqual(
    {
      name: application.event.name,
      weaponStrength: application.event.weaponStrength,
      independentSummonStrike: application.event.independentSummonStrike,
      summonUsesProfessionModifiers: application.event.summonUsesProfessionModifiers,
      summonInheritsAttributes: application.event.summonInheritsAttributes,
      summonInheritsCriticalAttributes: application.event.summonInheritsCriticalAttributes
    },
    {
      name: 'Summon Pulse',
      weaponStrength: 2880,
      independentSummonStrike: true,
      summonUsesProfessionModifiers: true,
      summonInheritsAttributes: true,
      summonInheritsCriticalAttributes: true
    }
  );
});

test('canonical effects allow negative offsets only from cast end', () => {
  const effect = {
    type: 'strike',
    coefficient: 1,
    hits: 1,
    atMs: -40,
    timingAnchor: 'castEnd',
    timingScale: 'fixed'
  };
  const catalog = createCanonicalCatalog({
    generated: [{ id: 930025, name: 'Cast-End Offset Fixture', effects: [effect] }]
  });

  assert.equal(catalog.skillsById.get(930025).effects[0].atMs, -40);
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930025,
            name: 'Cast-Start Offset Fixture',
            effects: [{ ...effect, timingAnchor: 'castStart' }]
          }
        ]
      }),
    /may only be negative when anchored to castEnd/
  );
});

test('canonical condition timelines reject invalid or ambiguous applications', () => {
  const skillWithTicks = (ticks) => ({
    id: 930026,
    name: 'Invalid Condition Timeline Fixture',
    effects: [
      {
        type: 'condition',
        ticks,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  });

  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          skillWithTicks([
            {
              atMs: 0,
              condition: 'Burning',
              stacks: 0,
              duration: 2
            }
          ])
        ]
      }),
    /positive stacks/
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            ...skillWithTicks([
              {
                atMs: 0,
                condition: 'Burning',
                stacks: 1,
                duration: 2
              }
            ]),
            effects: [
              {
                type: 'condition',
                condition: 'Burning',
                ticks: [
                  {
                    atMs: 0,
                    condition: 'Burning',
                    stacks: 1,
                    duration: 2
                  }
                ],
                timingAnchor: 'castStart',
                timingScale: 'fixed'
              }
            ]
          }
        ]
      }),
    /cannot use aggregate/
  );
});

test('GW2 Quickness uses stored effect timing and slower casts scale it upward', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930020,
        name: 'Fixture Timeline',
        type: 'Utility',
        castTimeMs: 2200,
        effects: [
          {
            type: 'strike',
            ticks: [
              { atMs: 370, coefficient: 1 },
              { atMs: 740, coefficient: 1 },
              { atMs: 1110, coefficient: 1 },
              { atMs: 1480, coefficient: 1 }
            ],
            timingAnchor: 'castStart',
            timingScale: 'cast'
          }
        ]
      },
      {
        id: 930021,
        name: 'Fixture Channel',
        type: 'Utility',
        castTimeMs: 600,
        effects: [
          {
            type: 'strike',
            ticks: [
              { atMs: 133.333333, coefficient: 1 },
              { atMs: 266.666666, coefficient: 1 },
              { atMs: 400, coefficient: 1 }
            ],
            timingAnchor: 'castStart',
            timingScale: 'cast'
          }
        ]
      },
      {
        id: 930022,
        name: 'Fixture Field',
        type: 'Utility',
        castTimeMs: 600,
        effects: [
          {
            type: 'strike',
            ticks: [
              { atMs: 1000, coefficient: 1 },
              { atMs: 2000, coefficient: 1 },
              { atMs: 3000, coefficient: 1 }
            ],
            timingAnchor: 'castEnd',
            timingScale: 'fixed'
          }
        ]
      },
      {
        id: 930023,
        name: 'Fixture Quickness Immune',
        type: 'Utility',
        castTimeMs: 600,
        unaffectedByQuickness: true,
        effects: [
          {
            type: 'strike',
            coefficient: 1,
            atMs: 600,
            timingAnchor: 'castStart',
            timingScale: 'cast'
          }
        ]
      }
    ]
  });
  const profession = defineProfession({
    id: 'quickness-fixture',
    name: 'Quickness Fixture',
    catalog
  });
  const simulate = (quickness) =>
    simulateGw2({
      profession,
      rotation: [
        'Fixture Timeline',
        'Fixture Channel',
        'Fixture Field',
        'Fixture Quickness Immune',
        { type: 'wait', durationMs: 4000 }
      ],
      config: { boons: { quickness } }
    });
  const quick = simulate(true);
  const normal = simulate(false);
  const profile = (result, skillName) => {
    const action = result.events.find((event) => event.type === 'action' && event.skillName === skillName);

    return {
      cast: Math.round((action.endsAt - action.at) * 1000),
      ticks: result.resolvedEvents
        .filter((event) => event.type === 'damage' && event.skillName === skillName)
        .map((event) => Math.round((event.at - action.at) * 1000))
    };
  };

  assert.deepEqual(profile(quick, 'Fixture Timeline'), {
    cast: 1480,
    ticks: [370, 740, 1110, 1480]
  });
  assert.deepEqual(profile(quick, 'Fixture Channel'), {
    cast: 400,
    ticks: [133, 267, 400]
  });
  assert.deepEqual(profile(quick, 'Fixture Field'), {
    cast: 400,
    ticks: [1400, 2400, 3400]
  });
  assert.deepEqual(profile(quick, 'Fixture Quickness Immune'), {
    cast: 600,
    ticks: [600]
  });
  assert.deepEqual(profile(normal, 'Fixture Timeline'), {
    cast: 2200,
    ticks: [550, 1100, 1650, 2200]
  });
  assert.deepEqual(profile(normal, 'Fixture Channel'), {
    cast: 600,
    ticks: [200, 400, 600]
  });
});

test('GW2 duration-stacks Quickness and Alacrity from repeated grants', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930024,
        name: 'Grant Quickness',
        castTimeMs: 0,
        effects: [{ type: 'boon', boon: 'Quickness', duration: 2, stacks: 1 }]
      },
      {
        id: 930025,
        name: 'Grant Alacrity',
        castTimeMs: 0,
        effects: [{ type: 'boon', boon: 'Alacrity', duration: 2, stacks: 1 }]
      },
      {
        id: 930026,
        name: 'Stacked Quickness Cast',
        castTimeMs: 600,
        effects: []
      },
      {
        id: 930027,
        name: 'Stacked Alacrity Cooldown',
        castTimeMs: 0,
        cooldown: 10,
        effects: []
      }
    ]
  });
  const profession = defineProfession({
    id: 'duration-stacking-boon-fixture',
    name: 'Duration Stacking Boon Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: [
      'Grant Quickness',
      'Grant Alacrity',
      { type: 'wait', durationMs: 1000 },
      'Grant Quickness',
      'Grant Alacrity',
      { type: 'wait', durationMs: 2000 },
      'Stacked Quickness Cast',
      'Stacked Alacrity Cooldown'
    ]
  });
  const quicknessAction = result.events.find(
    (event) => event.type === 'action' && event.skillName === 'Stacked Quickness Cast'
  );

  assert.equal(quicknessAction.at, 3);
  assert.equal(quicknessAction.endsAt, 3.4);
  assert.equal(result.endState.cooldowns['Stacked Alacrity Cooldown'].readyAt, 11400);
});

test('GW2 declarative policy enforces active weapons and skill weapon strength', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930011,
        name: 'Fixture Greatsword',
        type: 'Weapon',
        weapon: 'Greatsword',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      },
      {
        id: 930012,
        name: 'Fixture Sword',
        type: 'Weapon',
        weapon: 'Sword',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ],
    weapons: ['Greatsword', 'Sword'],
    weaponHands: { Greatsword: '2h', Sword: 'mh' }
  });
  const profession = defineProfession({
    id: 'weapon-policy-fixture',
    name: 'Weapon Policy Fixture',
    catalog
  });
  const greatsword = simulateGw2({
    profession,
    rotation: ['Fixture Greatsword']
  });
  const sword = simulateGw2({
    profession,
    rotation: ['Fixture Sword']
  });
  const unavailable = simulateGw2({
    profession,
    rotation: ['Fixture Greatsword'],
    config: { primaryWeapon: 'Sword' }
  });

  assert.equal(greatsword.strikeDamage / sword.strikeDamage, 1.1);
  assert.equal(unavailable.totalDamage, 0);
  assert.match(unavailable.warnings.join(' '), /unavailable/);
});

test('profession condition-duration hooks remain under the GW2 cap', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930013,
        name: 'Fixture Burn',
        castTimeMs: 0,
        effects: [
          {
            type: 'condition',
            condition: 'Burning',
            stacks: 1,
            duration: 1
          }
        ]
      }
    ]
  });
  const profession = defineProfession({
    id: 'duration-cap-fixture',
    name: 'Duration Cap Fixture',
    catalog,
    attributeRules: {
      modifyConditionDuration: (_context, duration) => duration * 2
    }
  });
  const result = simulateGw2({
    profession,
    rotation: ['Fixture Burn', { type: 'wait', durationMs: 2000 }],
    config: { stats: { expertise: 1500 } }
  });
  const burning = result.resolvedEvents.find((event) => event.type === 'condition');

  assert.equal(burning.effectiveDuration, 2);
});

test('resolver modifiers receive stable trait, event, and runtime context', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930002,
        name: 'Context Strike',
        type: 'Utility',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ]
  });
  let observed = null;
  const profession = defineProfession({
    id: 'context-fixture',
    name: 'Context Fixture',
    catalog,
    attributeRules: {
      modifyStrikeDamage(context, multiplier) {
        observed = {
          actorType: context.actorType,
          hasRuntimeProfession: Boolean(context.runtime?.profession),
          skillId: context.skillId,
          trait: context.traits.has('context-fixture.damage')
        };

        return observed.trait && observed.skillId === 930002 ? multiplier * 2 : multiplier;
      }
    }
  });
  const base = simulateGw2({
    profession,
    rotation: ['Context Strike']
  });
  const modified = simulateGw2({
    profession,
    rotation: ['Context Strike'],
    config: {
      selectedTraitIds: ['context-fixture.damage']
    }
  });

  assert.equal(modified.strikeDamage / base.strikeDamage, 2);
  assert.deepEqual(observed, {
    actorType: 'player',
    hasRuntimeProfession: true,
    skillId: 930002,
    trait: true
  });
});
