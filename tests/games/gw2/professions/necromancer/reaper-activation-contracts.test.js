import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

const damageTraits = [TRAIT.CHILLING_NOVA, TRAIT.CHILLING_VICTORY, TRAIT.REAPERS_ONSLAUGHT];
const novaDeadline = 'necromancer.reaper.chillingNova';
const victoryDeadline = 'necromancer.reaper.chillingVictory';
const strike = (at = 1, fields = {}) => ({
  type: 'damage',
  at,
  source: 'fixture',
  sourceId: ID.LIFE_REAP,
  skillId: ID.LIFE_REAP,
  skillName: 'Life Reap',
  actorType: 'player',
  coefficient: 1,
  skillWeapon: 'Unequipped',
  ...fields
});
const condition = (name) => ({
  type: 'condition',
  at: 1,
  source: 'fixture',
  sourceId: 'fixture',
  actorType: 'player',
  skillName: 'Condition fixture',
  condition: name,
  stacks: 1,
  duration: 2
});

/** Inject minimal accepted inputs through the real resolver while choosing producer registration independently. */
function run(
  events,
  { traitTriggers = true, ...overrides } = {},
  { balanceProfiles = {}, initialize = () => {} } = {}
) {
  const config = {
    specialization: 'Reaper',
    initialResource: 10,
    selectedTraitIds: [],
    attributeInputs: baseAttributeInputs({ power: 1000, precision: 3100, vitality: 1000, ferocity: 0 }),
    target: { armor: 2597, health: 0, conditions: {} },
    randomness: { mode: 'deterministic', seed: 1729 },
    ...overrides
  };
  const native = necromancerProfession.runtimeFor(config, { traitTriggers });
  const result = observeGw2Runtime({
    profession: { ...native, catalog: applyBalanceProfilePatch(native.catalog, { balanceProfiles }) },
    config,
    rotation: [{ type: 'wait', durationMs: (Math.max(1, ...events.map((event) => event.at)) + 0.1) * 1000 }],
    engineInitialize(runtime) {
      initialize(runtime);
      for (const event of events) runtime.effects.emit({ kind: 'packet', event });
    }
  });
  assert.deepEqual(result.warnings, []);
  return { result, runtime: observedRuntime(result) };
}

// Selection and isolation must gate both the direct Chill producer and Fear's chained Chill/Bleeding rewards.
for (const input of ['Chilled', 'Fear']) {
  test(`Reaper ${input} reactions respect selection and isolation with causal trait attribution`, () => {
    for (const selected of [false, true]) {
      for (const traitTriggers of [false, true]) {
        const { result } = run([condition(input)], {
          selectedTraitIds: selected ? [TRAIT.DEATHLY_CHILL, TRAIT.SHIVERS_OF_DREAD] : [],
          traitTriggers
        });
        const rewards = result.resolvedEvents.filter((event) =>
          [TRAIT.DEATHLY_CHILL, TRAIT.SHIVERS_OF_DREAD].includes(event.sourceId)
        );
        assert.deepEqual(
          [...new Set(rewards.map((event) => event.condition))],
          selected && traitTriggers ? (input === 'Fear' ? ['Chilled', 'Bleeding'] : ['Bleeding']) : []
        );
        if (rewards.length) {
          assert.equal(
            rewards.filter((event) => event.condition === 'Bleeding').reduce((sum, event) => sum + event.stacks, 0),
            4
          );
          const bleed = rewards.at(-1);
          assert.equal(bleed.sourceId, TRAIT.DEATHLY_CHILL);
          assert.equal(bleed.ownerActorType, 'player');
          assert.equal(bleed.triggeredBy, input === 'Fear' ? 'Shivers of Dread' : 'Condition fixture');
          assert.ok(
            result.resolvedEvents.indexOf(bleed) > result.resolvedEvents.findIndex((event) => event.condition === input)
          );
        }
      }
    }
  });
}

test('Reaper damage producers gate cooldown claims, life force and shroud recharge reductions together', () => {
  for (const selected of [false, true]) {
    for (const traitTriggers of [false, true]) {
      const startingDeadlines = new Map();
      const { result, runtime } = run(
        [strike()],
        {
          traitTriggers,
          selectedTraitIds: selected ? damageTraits : [],
          target: { conditions: { Chilled: true } }
        },
        {
          initialize(runtime) {
            for (const id of [ID.DEATHS_CHARGE, ID.WELL_OF_SUFFERING]) {
              runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(id), 0, 10);
              startingDeadlines.set(id, runtime.cooldownController.readyAt(id));
            }
          }
        }
      );
      const active = selected && traitTriggers;
      assert.equal(
        result.resolvedEvents.some((event) => event.sourceId === TRAIT.CHILLING_NOVA),
        active
      );
      assert.equal(runtime.resourceController.value('lifeForce'), active ? 11 : 10);
      const rechargeRate = runtime.cooldownController.rate(runtime.helpers.skillsById.get(ID.DEATHS_CHARGE), 1);
      assert.equal(
        runtime.cooldownController.readyAt(ID.DEATHS_CHARGE),
        startingDeadlines.get(ID.DEATHS_CHARGE) - Number(active) / rechargeRate
      );
      assert.equal(
        runtime.cooldownController.readyAt(ID.WELL_OF_SUFFERING),
        startingDeadlines.get(ID.WELL_OF_SUFFERING)
      );
      assert.deepEqual(
        Object.keys(runtime.procs.snapshot()).sort(),
        active ? [novaDeadline, victoryDeadline].sort() : []
      );
    }
  }
});

test('Nova uses the resolved critical outcome in both damage modes and only eligible player hits reward life force', () => {
  for (const criticalDamageMode of ['averaged', 'rolled']) {
    for (const fields of [{}, { canCrit: false }, { actorType: 'effect' }, { coefficient: 0 }, { offTarget: true }]) {
      const { result, runtime } = run([strike(1, fields)], {
        criticalDamageMode,
        selectedTraitIds: [TRAIT.CHILLING_NOVA, TRAIT.CHILLING_VICTORY],
        target: { conditions: { Chilled: true } }
      });
      const eligible = !fields.actorType && fields.coefficient !== 0 && !fields.offTarget;
      const nova = eligible && fields.canCrit !== false;
      assert.equal(
        result.resolvedEvents.some((event) => event.sourceId === TRAIT.CHILLING_NOVA),
        nova
      );
      assert.equal(runtime.resourceController.value('lifeForce'), eligible ? 11 : 10);
      assert.equal(runtime.procs.deadline(novaDeadline), nova ? 4 : 0);
    }
  }

  const { result, runtime } = run([strike()], { selectedTraitIds: [TRAIT.CHILLING_NOVA, TRAIT.CHILLING_VICTORY] });
  assert.equal(
    result.resolvedEvents.some((event) => event.sourceId === TRAIT.CHILLING_NOVA),
    false
  );
  assert.equal(runtime.resourceController.value('lifeForce'), 10);
  assert.deepEqual(runtime.procs.snapshot(), {});
});

test('Nova and Chilling Victory retain patched cooldowns with an exclusive deadline', () => {
  const { result, runtime } = run(
    [strike(1), strike(3), strike(3.25)],
    {
      selectedTraitIds: [TRAIT.CHILLING_NOVA, TRAIT.CHILLING_VICTORY],
      target: { conditions: { Chilled: true } }
    },
    {
      balanceProfiles: {
        [TRAIT.CHILLING_NOVA]: { fields: { cooldown: 2 } },
        [TRAIT.CHILLING_VICTORY]: { fields: { cooldown: 2, lifeForceGain: 2 } }
      }
    }
  );
  assert.equal(runtime.resourceController.value('lifeForce'), 14);
  assert.equal(runtime.procs.deadline(novaDeadline), 5.25);
  assert.equal(runtime.procs.deadline(victoryDeadline), 5.25);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.sourceId === TRAIT.CHILLING_NOVA).length,
    2
  );
});

test('an admitted Nova strike completes Chill with producers disabled or unselected', () => {
  for (const selected of [false, true]) {
    for (const traitTriggers of [false, true]) {
      for (const removeChill of [false, true]) {
        const { result, runtime } = run(
          [
            strike(1, {
              source: 'Trait',
              sourceId: TRAIT.CHILLING_NOVA,
              skillId: undefined,
              skillName: 'Chilling Nova',
              actorType: 'effect',
              canCrit: false
            })
          ],
          { traitTriggers, selectedTraitIds: selected ? [TRAIT.CHILLING_NOVA, TRAIT.DEATHLY_CHILL] : [] },
          {
            balanceProfiles: removeChill
              ? { [TRAIT.CHILLING_NOVA]: { removeEffects: [{ type: 'condition', name: 'Chilled' }] } }
              : {}
          }
        );
        const novaStrike = result.resolvedEvents.findIndex((event) => event.type === 'damage');
        const chill = result.resolvedEvents.findIndex((event) => event.condition === 'Chilled');
        assert.equal(chill >= 0, !removeChill);
        if (!removeChill) assert.ok(chill > novaStrike, 'The admitted strike resolves before its Chill');
        assert.equal(
          result.resolvedEvents.some((event) => event.sourceId === TRAIT.DEATHLY_CHILL),
          selected && traitTriggers && !removeChill
        );
        assert.equal(
          runtime.procs.deadline(novaDeadline),
          0,
          'Completing an admitted payload does not claim a new proc'
        );
      }
    }
  }
});

test('Nova effect removal preserves its remaining payload and admitted cooldown', () => {
  for (const removed of [[], ['strike'], ['condition'], ['strike', 'condition']]) {
    const { result, runtime } = run(
      [strike()],
      {
        selectedTraitIds: [TRAIT.CHILLING_NOVA],
        target: { conditions: { Chilled: true } }
      },
      {
        balanceProfiles: {
          [TRAIT.CHILLING_NOVA]: {
            removeEffects: removed.map((type) => ({ type, name: type === 'strike' ? 'Strike' : 'Chilled' }))
          }
        }
      }
    );
    const rewards = result.resolvedEvents.filter((event) => event.sourceId === TRAIT.CHILLING_NOVA);
    assert.equal(
      rewards.some((event) => event.type === 'damage'),
      !removed.includes('strike')
    );
    assert.equal(
      rewards.some((event) => event.condition === 'Chilled'),
      !removed.includes('condition')
    );
    assert.equal(runtime.procs.deadline(novaDeadline), 4);
  }
});

test("Blighter's Boon requires selected enabled producers and a standard boon delivered to self", () => {
  for (const selected of [false, true]) {
    for (const traitTriggers of [false, true]) {
      for (const kind of ['might', 'necromancer-soul-barbs']) {
        for (const affectsSelf of [false, true]) {
          const { runtime } = run(
            [
              {
                type: 'buff',
                at: 1,
                source: 'fixture',
                sourceId: 'fixture',
                actorType: 'player',
                kind,
                stacks: 5,
                duration: 2,
                audience: { recipients: 'party', affectsSelf }
              }
            ],
            {
              traitTriggers,
              selectedTraitIds: selected ? [TRAIT.BLIGHTERS_BOON] : [],
              allies: { count: 2, strikesPerSecond: 0 }
            }
          );
          assert.equal(
            runtime.resourceController.value('lifeForce'),
            selected && traitTriggers && kind === 'might' && affectsSelf ? 11 : 10
          );
        }
      }
    }
  }
});

test("Reaper's Onslaught passive ferocity survives trigger isolation and still requires selection and shroud", () => {
  for (const selected of [false, true]) {
    const config = { specialization: 'Reaper', selectedTraitIds: selected ? [TRAIT.REAPERS_ONSLAUGHT] : [] };
    const native = necromancerProfession.runtimeFor(config, { traitTriggers: false });
    for (const activeShroud of ['', 'reaper']) {
      const seed = {
        power: 1000,
        precision: 1000,
        vitality: 1000,
        conditionDamage: 0,
        expertise: 0,
        ferocity: 100,
        concentration: 0
      };
      const attributes = native.modifyAttributes(
        {
          catalog: native.catalog,
          config,
          time: 0,
          runtime: { profession: { core: { activeShroud } } }
        },
        seed
      );
      assert.equal(attributes.ferocity, selected && activeShroud === 'reaper' ? 400 : 100);
    }
  }
});
