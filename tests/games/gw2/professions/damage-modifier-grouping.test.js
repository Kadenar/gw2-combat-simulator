import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS as GUARDIAN } from '#gw2/professions/guardian/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { MESMER_TRAIT_IDS as MESMER } from '#gw2/professions/mesmer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_TRAIT_IDS as NECROMANCER } from '#gw2/professions/necromancer/data/ids.js';

const guardianLuminaryRules = guardianProfession.resolveRuntime({
  specialization: 'Luminary'
});
const mesmerRules = (specialization) =>
  mesmerProfession.resolveRuntime({
    specialization
  });
const necromancerRules = (specialization) => necromancerProfession.resolveRuntime({ specialization });

function modifierContext({
  traits = [],
  event = { source: 'Player' },
  config = {},
  runtime = {},
  events = [],
  active = [],
  stacks = {},
  sigils = {
    strike: 1.08,
    strikeAdd: 0.08,
    condition: 1.05,
    conditionAdd: 0.05
  }
} = {}) {
  const activeKinds = new Set(active);
  const mightStacksAt = () => Number(config.boons?.might || 0);
  const furyActiveAt = () => Boolean(config.boons?.fury);
  const vulnerabilityStacksAt = () => Number(config.target?.conditions?.Vulnerability || 0);

  return {
    time: 1,
    traits: new Set(traits),
    event,
    events,
    config: {
      boons: {},
      target: {},
      ...config
    },
    runtime: {
      totals: { strike: 0, condition: 0 },
      profession: {},
      boons: new Map(),
      conditionState: new Map(),
      ...runtime
    },
    query: {
      mightStacksAt,
      furyActiveAt,
      vulnerabilityStacksAt
    },
    damageInputs: {
      strikeSigilBonus: sigils.strikeAdd ?? Number(sigils.strike || 1) - 1,
      conditionSigilBonus: sigils.conditionAdd ?? Number(sigils.condition || 1) - 1
    },
    timeline: {
      activeSigilSetAt: () => sigils,
      timedActive: (kind) => activeKinds.has(kind),
      timedStacks: (kind) => Number(stacks[kind] || 0),
      vigorActiveAt: () => Boolean(config.boons?.vigor)
    }
  };
}

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `expected ${actual} to equal ${expected}`);
}

test('Guardian additive and multiplicative modifiers use separate buckets', () => {
  const context = modifierContext({
    traits: [
      GUARDIAN.EMPOWERED_ARMAMENTS,
      GUARDIAN.RADIANT_ARMAMENTS,
      GUARDIAN.FURIOUS_FOCUS,
      GUARDIAN.RETRIBUTION,
      GUARDIAN.SYMBOLIC_AVENGER,
      GUARDIAN.FIERY_WRATH,
      GUARDIAN.SYMBOLIC_EXPOSURE
    ],
    config: {
      boons: { fury: true },
      target: {
        conditions: { Burning: true, Vulnerability: 25 }
      }
    },
    runtime: {
      totals: { strike: 0, condition: 0 },
      profession: {
        core: {
          resolutionUntil: 10,
          symbolicAvengerExpirations: [6, 7, 8, 9, 10]
        },
        specialization: { kind: 'Luminary', state: {} }
      },
      boons: new Map(),
      conditionState: new Map()
    },
    active: ['guardian-empowered-armaments', 'guardian-piercing-stance'],
    events: [
      {
        type: 'buff',
        kind: 'guardian-radiant-armaments',
        at: 0,
        duration: 10,
        metadata: { radiantWeapon: 'hammer' }
      }
    ]
  });

  const actual = guardianLuminaryRules.modifyStrikeDamage(context, 1);

  assert.ok(Math.abs(actual - 1.6 * 1.05 * 1.05) < 1e-12);
});

test('Glaring Burst hammer damage multiplies shared additive modifiers', () => {
  const context = modifierContext({
    event: {
      source: 'Player',
      skillId: GUARDIAN_SKILL_IDS.GLARING_BURST,
      metadata: { radiantWeapon: 'hammer' }
    },
    active: ['guardian-piercing-stance'],
    sigils: {
      strike: 1.05,
      strikeAdd: 0.05,
      condition: 1,
      conditionAdd: 0
    }
  });

  assertClose(guardianLuminaryRules.modifyStrikeDamage(context, 1), 1.15 * 1.25);
});

test('Necromancer active runtimes isolate their Discretize modifier buckets', () => {
  const shared = {
    config: {
      target: {
        health: 100,

        nearby: true,
        conditions: { Chilled: true }
      }
    },
    active: ['necromancer-soul-barbs']
  };
  const runtime = (kind, core, state) => ({
    totals: { strike: 60, condition: 0 },
    profession: {
      core,
      specialization: { kind, state }
    },
    boons: new Map(),
    conditionState: new Map()
  });

  const core = modifierContext({
    ...shared,
    traits: [NECROMANCER.SOUL_BARBS, NECROMANCER.DREAD, NECROMANCER.SPITEFUL_TALISMAN, NECROMANCER.CLOSE_TO_DEATH],
    runtime: runtime('Core', { dreadUntil: 10 }, {})
  });

  assert.ok(Math.abs(necromancerRules('Core').modifyStrikeDamage(core, 1) - 1.38 * 1.05 * 1.2) < 1e-12);

  const harbinger = modifierContext({
    ...shared,
    traits: [NECROMANCER.WICKED_CORRUPTION, NECROMANCER.SEPTIC_CORRUPTION, NECROMANCER.CASCADING_CORRUPTION],
    config: { ...shared.config, specialization: 'Harbinger' },
    runtime: runtime('Harbinger', {}, { blight: 10, meltdownUntil: 10 })
  });

  assertClose(necromancerRules('Harbinger').modifyStrikeDamage(harbinger, 1), 1.28);
  assertClose(necromancerRules('Harbinger').modifyConditionDamage({ ...harbinger, condition: 'Bleeding' }, 1), 1.175);

  const reaper = modifierContext({
    ...shared,
    traits: [NECROMANCER.COLD_SHOULDER, NECROMANCER.SOUL_EATER],
    config: { ...shared.config, specialization: 'Reaper' },
    runtime: runtime('Reaper', {}, {})
  });

  assert.ok(Math.abs(necromancerRules('Reaper').modifyStrikeDamage(reaper, 1) - 1.08 * 1.15 * 1.15) < 1e-12);

  const ritualist = modifierContext({
    ...shared,
    traits: [NECROMANCER.LINGERING_SPIRITS],
    config: { ...shared.config, specialization: 'Ritualist' },
    runtime: runtime(
      'Ritualist',
      {},
      {
        activeSpirits: { anguish: true }
      }
    )
  });

  assertClose(necromancerRules('Ritualist').modifyStrikeDamage(ritualist, 1), 1.13);
});

test('Mesmer active runtimes isolate their additive damage buckets', () => {
  const shared = {
    config: {
      boons: { vigor: true },
      target: {}
    },
    active: ['illusionary-membrane'],
    stacks: {
      compounding: 5,
      'phantom-pain': 2
    },
    events: [
      {
        type: 'mesmer.instrument',
        instrument: 'Lute',
        at: 0,
        expiresAt: 10
      }
    ]
  };

  const core = modifierContext(shared);

  assertClose(mesmerRules('Core').modifyStrikeDamage(core, 1), 1.13);
  assertClose(mesmerRules('Core').modifyConditionDamage({ ...core, condition: 'Torment' }, 1), 1.17);

  const mirage = modifierContext({
    ...shared,
    traits: [MESMER.NOMADS_ENDURANCE],
    config: { ...shared.config, specialization: 'Mirage' }
  });

  assertClose(mesmerRules('Mirage').modifyStrikeDamage(mirage, 1), 1.355);
  assertClose(mesmerRules('Mirage').modifyConditionDamage({ ...mirage, condition: 'Torment' }, 1), 1.32);

  const troubadour = modifierContext({
    ...shared,
    traits: [MESMER.SHREDDING],
    config: { ...shared.config, specialization: 'Troubadour' },
    active: [...shared.active, 'altered-chord']
  });

  assertClose(mesmerRules('Troubadour').modifyStrikeDamage(troubadour, 1), 1.63);
  assertClose(mesmerRules('Troubadour').modifyConditionDamage({ ...troubadour, condition: 'Torment' }, 1), 1.42);
});

test('Superiority Complex accepts Fear or Taunt while generic disabled requires a non-defiant target', () => {
  const defiant = modifierContext({
    traits: [MESMER.SUPERIORITY_COMPLEX],
    config: {
      target: {
        defiant: true,
        disabled: true,
        health: 100
      }
    }
  });
  const nonDefiant = modifierContext({
    traits: [MESMER.SUPERIORITY_COMPLEX],
    config: {
      target: {
        defiant: false,
        disabled: true,
        health: 100
      }
    }
  });

  assertClose(mesmerRules('Core').modifyCriticalDamage({ catalog: mesmerCatalog, ...defiant }, 2), 2 * 1.15);
  assertClose(mesmerRules('Core').modifyCriticalDamage({ catalog: mesmerCatalog, ...nonDefiant }, 2), 2 * 1.25);
  for (const condition of ['Fear', 'Taunt']) {
    assertClose(
      mesmerRules('Core').modifyCriticalDamage(
        {
          catalog: mesmerCatalog,
          ...defiant,
          config: {
            ...defiant.config,
            target: {
              ...defiant.config.target,
              conditions: { [condition]: true }
            }
          }
        },
        2
      ),
      2 * 1.25
    );
  }

  assertClose(
    mesmerRules('Core').modifyCriticalDamage(
      {
        catalog: mesmerCatalog,
        ...defiant,
        runtime: {
          ...defiant.runtime,
          totals: { strike: 60, condition: 0 }
        }
      },
      2
    ),
    2 * 1.25
  );
});

test('Mesmer Lute Playing damage excludes illusion attacks', () => {
  const shared = {
    config: { specialization: 'Troubadour' },
    events: [{ type: 'mesmer.instrument', instrument: 'Lute', at: 0, expiresAt: 10 }],
    sigils: { strike: 1, strikeAdd: 0, condition: 1, conditionAdd: 0 }
  };
  const player = modifierContext(shared);
  const phantasm = modifierContext({
    ...shared,
    event: { source: 'Phantasm', actorType: 'summon', summonKind: 'phantasm' }
  });
  const clone = modifierContext({ ...shared, event: { source: 'Clone', actorType: 'summon', summonKind: 'clone' } });

  assertClose(mesmerRules('Troubadour').modifyStrikeDamage(player, 1), 1.1);
  assert.equal(mesmerRules('Troubadour').modifyStrikeDamage(phantasm, 1), 1);
  assert.equal(mesmerRules('Troubadour').modifyConditionDamage({ ...clone, condition: 'Bleeding' }, 1), 1);
});

test('Mesmer Deadly Blades does not increase phantasm damage', () => {
  const context = modifierContext({
    event: { source: 'Phantasm', actorType: 'summon', summonKind: 'phantasm' },
    active: ['deadly-blades']
  });

  assert.equal(mesmerRules('Virtuoso').modifyStrikeDamage(context, 1), 1);
  assert.equal(mesmerRules('Virtuoso').modifyConditionDamage({ ...context, condition: 'Bleeding' }, 1), 1.05);
});

test('Mesmer instrument checks skip other specializations and index events once', () => {
  const countedEvents = () => {
    let reads = 0;
    const events = new Proxy(
      [
        ...Array.from({ length: 100 }, (_, index) => ({
          type: 'action',
          at: index
        })),
        {
          type: 'mesmer.instrument',
          instrument: 'Lute',
          at: 0,
          expiresAt: 10
        },
        {
          type: 'mesmer.instrument',
          instrument: 'Lute',
          at: 1,
          expiresAt: 10
        },
        {
          type: 'mesmer.instrument',
          instrument: 'Drum',
          at: 0,
          expiresAt: 10
        }
      ],
      {
        get(target, property, receiver) {
          if (typeof property === 'string' && /^\d+$/.test(property)) {
            reads += 1;
          }

          return Reflect.get(target, property, receiver);
        }
      }
    );

    return { events, reads: () => reads };
  };

  const irrelevant = countedEvents();
  const virtuoso = modifierContext({
    config: { specialization: 'Virtuoso' },
    events: irrelevant.events
  });

  mesmerRules('Virtuoso').modifyAttributes({ catalog: mesmerCatalog, ...virtuoso }, { power: 100 });
  mesmerRules('Virtuoso').modifyStrikeDamage(virtuoso, 1);
  assert.equal(irrelevant.reads(), 0);

  const relevant = countedEvents();
  const troubadour = modifierContext({
    traits: [MESMER.FORTISSIMO, MESMER.SHREDDING],
    config: { specialization: 'Troubadour' },
    events: relevant.events
  });
  const attributes = mesmerRules('Troubadour').modifyAttributes(
    { catalog: mesmerCatalog, ...troubadour },
    {
      power: 100,
      precision: 100,
      toughness: 100,
      vitality: 100,
      ferocity: 100,
      conditionDamage: 100,
      expertise: 100,
      concentration: 100,
      healingPower: 100
    }
  );
  const first = mesmerRules('Troubadour').modifyStrikeDamage(troubadour, 1);
  const second = mesmerRules('Troubadour').modifyStrikeDamage(troubadour, 1);

  for (const attribute of [
    'power',
    'precision',
    'toughness',
    'vitality',
    'ferocity',
    'conditionDamage',
    'expertise',
    'concentration',
    'healingPower'
  ]) {
    assert.equal(attributes[attribute], 108, attribute);
  }

  assert.equal(first, second);
  assert.equal(relevant.reads(), relevant.events.length);
});

test('Vicious Expression always applies its boonless-target modifier', () => {
  // Retained target-boon configuration cannot disable the fixed boonless-target bonus.
  for (const target of [undefined, { boonless: false }, { boons: ['might'], boonCount: 3 }]) {
    const context = modifierContext({ traits: [MESMER.VICIOUS_EXPRESSION], config: { target } });
    assert.ok(Math.abs(mesmerRules('Core').modifyStrikeDamage(context, 1) - 1.242) < 1e-12);
  }
});

test('Mesmer strike sigils apply to the player but not illusion sources', () => {
  const player = modifierContext({ event: { source: 'Player', actorType: 'player' } });
  const clone = modifierContext({ event: { source: 'Clone', actorType: 'summon', summonKind: 'clone' } });
  const phantasm = modifierContext({
    event: { source: 'Phantasm', actorType: 'summon', summonKind: 'phantasm' }
  });

  assert.equal(mesmerRules('Core').modifyStrikeDamage(player, 1), 1.08);
  assert.equal(mesmerRules('Core').modifyStrikeDamage(clone, 1), 1);
  assert.equal(mesmerRules('Core').modifyStrikeDamage(phantasm, 1), 1);
});
