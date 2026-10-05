import assert from 'node:assert/strict';
import test from 'node:test';
import { effectStateValue } from '#gw2/platform/combat/effect-state.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { ELEMENTALIST_TRAIT_IDS as ELEMENTALIST } from '#gw2/professions/elementalist/data/ids.js';
import { MESMER_TRAIT_IDS as MESMER } from '#gw2/professions/mesmer/data/ids.js';
import {
  createObservedProfessionSimulator,
  observeGw2Runtime,
  observedRuntime
} from '#tests/helpers/observed-runtime.js';

/** Empty native runs exercise selected hook composition without depending on a rotation or damage formula. */
function initialized(family, specialization, patchId = 'current') {
  const config = { specialization, patchId };
  const profession = family.runtimeFor(config);
  const result = observeGw2Runtime({ profession, config, rotation: [] });
  assert.deepEqual(result.warnings, []);
  return { profession, context: observedRuntime(result).mechanics };
}

const owners = [
  {
    name: 'Elementalist',
    family: elementalistProfession,
    core: ['shattering stone', 'persisting flames', 'hammer fire orb', 'fire aura'],
    observations: { Catalyst: ['elemental empowerment'] },
    elites: {
      Tempest: ['transcendent-tempest', 'tempestuous aria'],
      Weaver: [
        'perfect weave',
        'weave self air',
        'weave self fire',
        'weave self water',
        'weave self earth',
        'elements of rage'
      ],
      Catalyst: ['relentless fire', 'shattering ice', 'elemental empowerment', 'empowering auras'],
      Evoker: ['zap buff', 'hare enchantment', 'lightning blitz enchantment', 'familiars-prowess']
    }
  },
  {
    name: 'Necromancer',
    family: necromancerProfession,
    core: ['necromancer-soul-barbs', 'extirpation', 'taste-for-blood'],
    observations: { Scourge: ['active-shade'], Harbinger: ['harbinger-blight', 'harbinger-shroud', 'meltdown'] },
    elites: {
      Reaper: [],
      Scourge: ['active-shade'],
      Harbinger: ['meltdown', 'implacable-foe', 'harbinger-shroud', 'harbinger-blight'],
      Ritualist: ['necromancer-painful-bond', 'nightmare-weapon', 'splinter-weapon', 'resilient-weapon']
    }
  },
  {
    name: 'Mesmer',
    family: mesmerProfession,
    core: ['clarity', 'illusionary-membrane', 'distortion', 'compounding', 'fencer'],
    elites: {
      Chronomancer: ['danger-time'],
      Mirage: ['mirage-mirror', 'mirage-cloak', 'phantom-pain'],
      Virtuoso: ['deadly-blades'],
      Troubadour: ['altered-chord']
    }
  },
  {
    name: 'Ranger',
    family: rangerProfession,
    core: ['sic-em', 'paralyzing-venom', 'strength-of-the-pack', 'light-on-your-feet'],
    elites: {
      Druid: ['natural-balance'],
      Soulbeast: ['one-wolf-pack', 'vulture-stance', 'twice-as-vicious'],
      Untamed: [],
      Galeshot: ['gale-force']
    }
  },
  {
    name: 'Thief',
    family: thiefProfession,
    core: ['spider-venom', 'skale-venom', 'devourer-venom', 'lead-attacks'],
    elites: {
      Daredevil: ['lotus-training', 'weakening-strikes'],
      Deadeye: [],
      Specter: ['barrier', 'rot-wallow-venom'],
      Antiquary: []
    }
  }
];

test('Zap emits the canonical buff consumed by its policy and damage modifier', () => {
  // Removing just the Zap window isolates its 3% follow-up modifier from familiar strikes and charge spending.
  const preview = withPatchPreview(elementalistProfession, {
    id: 'without-zap-window',
    label: 'Without Zap window',
    professions: {
      elementalist: {
        balanceProfiles: {
          'elementalist.evoker.familiar-utility': { removeEffects: [{ type: 'buff', name: 'Zap Window' }] }
        }
      }
    }
  });
  const simulate = createObservedProfessionSimulator(preview, {
    stats: { power: 2000, precision: 1000 },
    target: { armor: 2597, health: 1_000_000 },
    startAttunement: 'Air',
    evokerElement: 'Air',
    initialEvokerCharges: 6,
    selectedTraitIds: [],
    primaryWeapon: 'Sword'
  });
  const rotation = ['Zap', 'Charged Strike'].map((name) => ({
    type: 'cast',
    skillId: elementalistProfession.catalog.skillsByName.get(name).id
  }));
  const live = simulate('Evoker', rotation, { patchId: 'current' });
  const removed = simulate('Evoker', rotation, { patchId: 'without-zap-window' });
  assert.deepEqual(live.warnings, []);
  assert.deepEqual(removed.warnings, []);
  assert.ok(live.resolvedEvents.some((event) => event.type === 'buff' && event.kind === 'zap buff'));
  assert.ok(!removed.resolvedEvents.some((event) => event.type === 'buff' && event.kind === 'zap buff'));
  const followup = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Charged Strike').damage;
  // Each resolved hit rounds independently, so compare the formula within that rounding allowance.
  assert.ok(Math.abs(followup(live) - followup(removed) * 1.03) <= 1.1);
  const { profession, context } = initialized(elementalistProfession, 'Evoker');
  assert.ok(!profession.buffPolicies(context).some(({ kind }) => kind === 'zap-buff'));
});

for (const { name, family, core, elites, observations = {} } of owners) {
  for (const specialization of ['Core', ...Object.keys(elites)]) {
    test(`${name} ${specialization} installs each applicable effect owner exactly once`, () => {
      const { profession, context } = initialized(family, specialization);
      const policies = profession.buffPolicies(context).map(({ kind }) => kind);
      const effects = profession.observeEffects(context.queries).map(({ kind }) => kind);
      assert.equal(new Set(policies).size, policies.length);
      assert.equal(new Set(effects).size, effects.length);
      for (const kind of core) assert.ok(policies.includes(kind), kind);
      for (const [owner, kinds] of Object.entries(elites)) {
        for (const kind of kinds) {
          assert.equal(policies.includes(kind), specialization === owner, kind);
          if (specialization !== owner) assert.ok(!effects.includes(kind), kind);
        }
      }

      for (const [owner, kinds] of Object.entries(observations)) {
        for (const kind of kinds) assert.equal(effects.includes(kind), specialization === owner, kind);
      }
    });
  }
}

for (const [family, familyId, specialization, traitId, kind, field] of [
  [
    elementalistProfession,
    'elementalist',
    'Catalyst',
    ELEMENTALIST.ELEMENTAL_EMPOWERMENT,
    'elemental empowerment',
    'maximumStacks'
  ],
  [
    elementalistProfession,
    'elementalist',
    'Catalyst',
    ELEMENTALIST.EMPOWERING_AURAS,
    'empowering auras',
    'maximumStacks'
  ],
  [
    elementalistProfession,
    'elementalist',
    'Tempest',
    ELEMENTALIST.TEMPESTUOUS_ARIA,
    'tempestuous aria',
    'maximumDuration'
  ],
  [
    elementalistProfession,
    'elementalist',
    'Evoker',
    ELEMENTALIST.FAMILIARS_PROWESS,
    'familiars-prowess',
    'maximumDuration'
  ],
  [mesmerProfession, 'mesmer', 'Mirage', MESMER.PHANTOM_PAIN, 'phantom-pain', 'maximumStacks']
]) {
  test(`${specialization} ${kind} policy uses its selected profile without leaking preview tuning`, () => {
    const preview = withPatchPreview(family, {
      id: 'effect-ownership',
      label: 'Effect ownership',
      professions: { [familyId]: { balanceProfiles: { [traitId]: { fields: { maximumStacks: 2 } } } } }
    });
    const liveCap = family.catalog.balanceProfilesById.get(traitId).maximumStacks;
    for (const patchId of ['current', 'effect-ownership', 'current']) {
      const { profession, context } = initialized(preview, specialization, patchId);
      const expected = patchId === 'current' ? liveCap : 2;
      const policy = profession.buffPolicies(context).find((entry) => entry.kind === kind);
      assert.equal(policy[field], expected);
      if (field === 'maximumDuration') assert.equal(policy.maximumStacks, 1);
      if (kind === 'elemental empowerment') {
        const observation = profession.observeEffects(context.queries).find((entry) => entry.kind === kind);
        assert.equal(observation.countLimit, expected);
      }
    }
  });
}

// Owner snapshots must track replacement while retaining detached windows and the exact expiry boundary.
for (const [family, specialization, field, kind] of [
  [elementalistProfession, 'Catalyst', 'elementalEmpowermentExpiries', 'elemental empowerment'],
  [necromancerProfession, 'Scourge', 'shades', 'active-shade']
]) {
  test(`${specialization} observation follows its live owner and expires at the stored deadline`, () => {
    const { profession, context } = initialized(family, specialization);
    const state = context.profession.specialization.state;
    state[field] = [1, 2];
    const snapshot = profession.observeEffects(context.queries).find((entry) => entry.kind === kind);
    assert.equal(effectStateValue(snapshot, 0).count, 2);
    assert.equal(effectStateValue(snapshot, 1).count, 1);
    assert.equal(effectStateValue(snapshot, 2).count, 0);
    state[field] = [0.5];
    const replaced = profession.observeEffects(context.queries).find((entry) => entry.kind === kind);
    assert.equal(effectStateValue(replaced, 0).count, 1);
    assert.equal(effectStateValue(replaced, 0.5).count, 0);
    assert.equal(effectStateValue(snapshot, 0).count, 2);
  });
}
