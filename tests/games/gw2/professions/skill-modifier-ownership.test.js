// Intrinsic bonuses share selected values with skill cards and apply only to their canonical skill owner.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createModifierReference } from '#gw2/app/modifier-reference/model.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { createModifierHooks } from '#gw2/platform/combat/modifiers.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistCoreModule } from '#gw2/professions/elementalist/core/module.js';
import { ELEMENTALIST_SKILL_IDS as ELEMENTALIST } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { engineerAppAdapter } from '#gw2/professions/engineer/app/app-definition.js';
import { ENGINEER_SKILL_IDS as ENGINEER } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { NECROMANCER_SKILL_IDS as NECROMANCER } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { rangerAppAdapter } from '#gw2/professions/ranger/app/app-definition.js';
import { rangerCoreModule } from '#gw2/professions/ranger/core/module.js';
import { RANGER_SKILL_IDS as RANGER } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { thiefAppAdapter } from '#gw2/professions/thief/app/app-definition.js';
import { THIEF_SKILL_IDS as THIEF } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { warriorAppAdapter } from '#gw2/professions/warrior/app/app-definition.js';
import { WARRIOR_SKILL_IDS as WARRIOR } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';

const preview = {
  id: 'intrinsic-owners',
  label: 'Intrinsic owners',
  professions: {
    ranger: {
      modifierRules: {
        'ranger.piercing-gales-vulnerability': { parameters: { vulnerabilityPerStack: 0.03 } },
        'ranger.pounce-defiant': { factor: 1.3 },
        'ranger.falcons-stoop-disabled': { factor: 1.4 },
        'ranger.unleashed-wild-swing-defiant': { factor: 1.5 },
        'ranger.unleashed-savage-shock-wave-defiant': { factor: 1.6 },
        'ranger.condition-count-skill-bonus': { parameters: { damagePerCondition: 0.03 } },
        'ranger.consuming-bite-condition-count': { parameters: { maximumConditions: 2, coefficientPerCondition: 0.05 } }
      }
    },
    warrior: {
      modifierRules: {
        'warrior.slicing-maelstrom-boonless': { factor: 1.8 },
        'warrior.kill-shot-threshold': { factor: 1.3 },
        'warrior.breaching-strike-boonless': { factor: 1.6 },
        'warrior.wastrels-ruin-defiant': { factor: 2.2 },
        'warrior.precise-cut-critical-damage': { factor: 1.25 },
        'warrior.focused-slash-critical-damage': { factor: 1.35 }
      }
    }
  }
};
const ranger = withPatchPreview(rangerProfession, preview);
const warrior = withPatchPreview(warriorProfession, preview);

test('Ranger intrinsic rules retain target predicates, condition formulas, and skill isolation under patches', () => {
  for (const patchId of ['current', preview.id]) {
    const patched = patchId === preview.id;
    const runtime = ranger.runtimeFor({ specialization: 'Core', patchId });
    for (const defiant of [false, true]) {
      for (const immobilized of [false, true]) {
        for (const conditions of [[], ['Bleeding', 'Burning', 'Poisoned', 'Chilled', 'Slow', 'Weakness']]) {
          const activeConditions = new Set([...conditions, ...(immobilized ? ['Immobilized'] : [])]);
          const count = activeConditions.size;
          const expected = new Map([
            [RANGER.POUNCE, defiant ? (patched ? 1.3 : 1.2) : 1],
            [RANGER.FALCONS_STOOP, defiant || immobilized ? (patched ? 1.4 : 1.2) : 1],
            [RANGER.UNLEASHED_WILD_SWING, defiant ? (patched ? 1.5 : 1.2) : 1],
            [
              RANGER.UNLEASHED_SAVAGE_SHOCK_WAVE,
              (defiant ? (patched ? 1.6 : 1.2) : 1) * (1 + count * (patched ? 0.03 : 0.02))
            ],
            [RANGER.CONSUMING_BITE, (0.45 + Math.min(count, patched ? 2 : 5) * (patched ? 0.05 : 0.025)) / 0.45],
            [RANGER.SLASH, 1],
            [RANGER.OWLS_FLIGHT, 1],
            [RANGER.WILD_SWING, 1],
            [RANGER.SAVAGE_SHOCK_WAVE, 1],
            [RANGER.FANG_GRAPPLE, 1]
          ]);
          for (const [skillId, factor] of expected) {
            const context = {
              catalog: runtime.catalog,
              time: 1,
              config: { selectedTraitIds: [], target: { defiant } },
              event: { skillId, coefficient: 0.45 },
              query: { targetHasCondition: (condition) => activeConditions.has(condition) }
            };
            assert.ok(
              Math.abs(runtime.modifyStrikeDamage(context, 100) - 100 * factor) < 1e-10,
              `${patchId}: ${skillId}`
            );
            assert.equal(runtime.modifyConditionDamage({ ...context, condition: 'Bleeding' }, 100), 100);
          }
        }
      }
    }
  }
});

test('Slicing Maelstrom owns its boonless-target factor for combat and detached skill previews', () => {
  for (const [patchId, factor] of [
    ['current', 1.5],
    [preview.id, 1.8]
  ]) {
    const runtime = warrior.runtimeFor({ specialization: 'Berserker', patchId });
    for (const skillId of [WARRIOR.SLICING_MAELSTROM, WARRIOR.KICK]) {
      for (const source of [{ event: { skillId } }, { skillId }]) {
        const context = { catalog: runtime.catalog, config: { selectedTraitIds: [] }, time: 0, ...source };
        assert.equal(
          runtime.modifyStrikeDamage(context, 100),
          100 * (skillId === WARRIOR.SLICING_MAELSTROM ? factor : 1)
        );
      }
    }
  }
});

test('intrinsic modifier references reuse skill cards and selected numeric facts without duplicate entries', () => {
  for (const patchId of ['current', preview.id]) {
    const patched = patchId === preview.id;
    for (const [family, adapter, cases] of [
      [
        ranger,
        rangerAppAdapter,
        [
          [RANGER.PIERCING_GALES, 'Additional strike damage per Vulnerability stack', patched ? '+3%' : '+2%'],
          [RANGER.POUNCE, 'Strike damage against defiant targets', patched ? '+30%' : '+20%'],
          [RANGER.FALCONS_STOOP, 'Strike damage against defiant or immobilized targets', patched ? '+40%' : '+20%'],
          [RANGER.UNLEASHED_WILD_SWING, 'Strike damage against defiant targets', patched ? '+50%' : '+20%'],
          [RANGER.UNLEASHED_SAVAGE_SHOCK_WAVE, 'Strike damage against defiant targets', patched ? '+60%' : '+20%'],
          [
            RANGER.UNLEASHED_SAVAGE_SHOCK_WAVE,
            'Additional strike damage per target condition',
            patched ? '+3%' : '+2%'
          ],
          [RANGER.CONSUMING_BITE, 'Additional coefficient per target condition', patched ? '0.05' : '0.025'],
          [RANGER.CONSUMING_BITE, 'Maximum target conditions counted', patched ? '2' : '5']
        ]
      ],
      [
        warrior,
        warriorAppAdapter,
        [
          [WARRIOR.SLICING_MAELSTROM, 'Strike damage against a boonless target', patched ? '+80%' : '+50%'],
          [WARRIOR.BREACHING_STRIKE, 'Strike damage against a boonless target', patched ? '+60%' : '+50%'],
          [WARRIOR.KILL_SHOT, 'Strike damage against a defiant or below-half-health target', patched ? '+30%' : '+20%'],
          [WARRIOR.WASTRELS_RUIN, 'Strike damage against a defiant target', patched ? '+120%' : '+100%']
        ]
      ]
    ]) {
      const patch = family.resolvePatch({ id: patchId });
      const entries = createModifierReference(adapter, patch);
      for (const [id, factName, value] of cases) {
        const skill = patch.balanceContext.catalog.skillsById.get(id);
        const tooltip = adapter.skillTooltip(skill, patch);
        assert.equal(tooltip.facts.find((fact) => fact.name === factName)?.detail, value);
        const owned = entries.filter((entry) => entry.skills.some((skill) => skill.id === id));
        assert.equal(owned.length, 1);
        assert.equal(owned[0].name, skill.name);
        assert.deepEqual(
          owned[0].skills.map((skill) => skill.id),
          [id]
        );
        // Multiple rules merge presentation metadata, but retain one copy of the skill's prose and facts.
        assert.equal(owned[0].tooltip.description, tooltip.description);
        assert.deepEqual(owned[0].tooltip.facts, tooltip.facts);

        if (id === WARRIOR.SLICING_MAELSTROM) assert.match(tooltip.description, /Spend adrenaline.*primal burst/);

        if (id === RANGER.UNLEASHED_SAVAGE_SHOCK_WAVE) assert.equal(owned[0].rules.length, 2);
      }
    }
  }
});

// Target health belongs to the encounter; changing player health is never part of these execute rules.
test('Warrior skill bonuses preserve the strict target-health boundary and remain scoped to their attack', () => {
  for (const patchId of ['current', preview.id]) {
    const patched = patchId === preview.id;
    const runtime = warrior.runtimeFor({ specialization: 'Core', patchId });
    for (const defiant of [false, true]) {
      for (const fraction of [1, 0.5, 0.499]) {
        const expected = new Map([
          [WARRIOR.KILL_SHOT, defiant || fraction < 0.5 ? (patched ? 1.3 : 1.2) : 1],
          [WARRIOR.BREACHING_STRIKE, patched ? 1.6 : 1.5],
          [WARRIOR.WASTRELS_RUIN, defiant ? (patched ? 2.2 : 2) : 1],
          [WARRIOR.KICK, 1]
        ]);
        for (const [skillId, factor] of expected) {
          for (const live of [false, true]) {
            const context = {
              catalog: runtime.catalog,
              time: 1,
              config: { selectedTraitIds: [], target: { defiant, fixedHealthFraction: live ? 1 : fraction } },
              ...(live
                ? {
                    event: { skillId },
                    runtime: {
                      encounter: {
                        remainingHealthFraction: fraction,
                        remainingHealth: 1000 * fraction,
                        maximumHealth: 1000
                      }
                    }
                  }
                : { skillId })
            };
            assert.equal(runtime.modifyStrikeDamage(context, 100), 100 * factor);
            assert.equal(runtime.modifyConditionDamage({ ...context, condition: 'Bleeding' }, 100), 100);
          }
        }
      }
    }
  }
});

test('dagger chain attacks own independent critical-only factors and selected tooltip facts', () => {
  for (const patchId of ['current', preview.id]) {
    const patched = patchId === preview.id;
    const runtime = warrior.runtimeFor({ specialization: 'Core', patchId });
    const patch = warrior.resolvePatch({ id: patchId });
    for (const [skillId, factor, fact] of [
      [WARRIOR.PRECISE_CUT, patched ? 1.25 : 1.15, patched ? '+25%' : '+15%'],
      [WARRIOR.FOCUSED_SLASH, patched ? 1.35 : 1.15, patched ? '+35%' : '+15%'],
      [WARRIOR.KEEN_STRIKE, 1, undefined],
      [WARRIOR.KICK, 1, undefined]
    ]) {
      const context = { catalog: runtime.catalog, config: { selectedTraitIds: [] }, time: 0, event: { skillId } };
      assert.equal(runtime.modifyCriticalDamage(context, 2), 2 * factor);
      assert.equal(runtime.modifyStrikeDamage(context, 100), 100);
      const skill = patch.balanceContext.catalog.skillsById.get(skillId);
      const tooltip = warriorAppAdapter.skillTooltip(skill, patch);
      assert.equal(tooltip.facts.find((entry) => entry.name === 'Critical damage')?.detail, fact);
    }
  }
});

test('Piercing Gales samples live vulnerability only for its own damage after Galeshot trait rules', () => {
  for (const patchId of ['current', preview.id]) {
    const runtime = ranger.runtimeFor({ specialization: 'Galeshot', patchId });
    const patch = ranger.resolvePatch({ id: patchId });
    assert.equal(patch.balanceContext.modifierRulesById.get('ranger.piercing-gales-vulnerability').order, 103);
    for (const skillId of [RANGER.PIERCING_GALES, RANGER.PERFECT_STORM]) {
      for (const time of [0, 1, 2]) {
        const stacks = time * 10;
        const context = {
          catalog: runtime.catalog,
          config: { selectedTraitIds: [] },
          time,
          event: { skillId },
          query: { vulnerabilityStacksAt: (at) => at * 10 }
        };
        const factor = skillId === RANGER.PIERCING_GALES ? 1 + stacks * (patchId === preview.id ? 0.03 : 0.02) : 1;
        assert.equal(runtime.modifyStrikeDamage(context, 100), 100 * factor);
        assert.equal(runtime.modifyConditionDamage({ ...context, condition: 'Bleeding' }, 100), 100);
      }
    }
  }
});

// Splitting shared IDs must make patch values independent without changing mark or captured-malice eligibility.
test('Deadeye skill-owned modifiers retain independent patch tuning and captured malice', () => {
  const family = withPatchPreview(thiefProfession, {
    id: 'deadeye-owned-rules',
    label: 'Deadeye owned rules',
    professions: {
      thief: {
        modifierRules: {
          'thief.shadow-flare-marked': { factor: 1.8 },
          'thief.malicious-backstab-malice': { parameters: { damagePerMalice: 0.2 } }
        }
      }
    }
  });
  const config = {
    specialization: 'Deadeye',
    patchId: 'deadeye-owned-rules',
    selectedTraitIds: [],
    target: { defiant: false }
  };
  const runtime = family.runtimeFor(config);
  const state = { markedTargetId: 'target', markExpiresAt: 10, malice: { value: 0 } };
  for (const [skillId, factor] of [
    [THIEF.SHADOW_FLARE, 1.8],
    [THIEF.SHADOW_SWAP, 1.5],
    [THIEF.MALICIOUS_BACKSTAB, 1.6],
    [THIEF.MALICIOUS_DEATHS_JUDGMENT, 1.3]
  ]) {
    const context = {
      catalog: runtime.catalog,
      config,
      time: 1,
      runtime: { profession: { core: {}, specialization: { kind: 'Deadeye', state } } },
      event: { skillId, actorType: 'player', deadeyeMaliceSnapshot: 3 }
    };
    assert.equal(runtime.modifyStrikeDamage(context, 100), factor * 100);
    assert.equal(runtime.modifyStrikeDamage({ ...context, time: 10 }, 100), 100);
    assert.equal(
      runtime.modifyStrikeDamage({ ...context, event: { ...context.event, actorType: 'environment' } }, 100),
      100
    );
  }
});

// One shout's balance edit cannot alter another shout, and the player-actor gate survives automatic skill scoping.
test('Reaper shouts retain independent patch tuning and exclude unrelated packets', () => {
  const family = withPatchPreview(necromancerProfession, {
    id: 'shout-owned-rules',
    label: 'Shout owned rules',
    professions: {
      necromancer: {
        modifierRules: {
          'necromancer.you-are-all-weaklings-melee': { factor: 3 }
        }
      }
    }
  });
  const config = { specialization: 'Reaper', patchId: 'shout-owned-rules', selectedTraitIds: [] };
  const runtime = family.runtimeFor(config);
  for (const skillId of [
    NECROMANCER.YOU_ARE_ALL_WEAKLINGS,
    NECROMANCER.NOTHING_CAN_SAVE_YOU,
    NECROMANCER.CHILLED_TO_THE_BONE,
    NECROMANCER.YOUR_SOUL_IS_MINE,
    NECROMANCER.SUFFER,
    NECROMANCER.RISE
  ]) {
    const context = { catalog: runtime.catalog, config, time: 1, event: { skillId, actorType: 'player' } };
    assert.equal(runtime.modifyStrikeDamage(context, 100), skillId === NECROMANCER.YOU_ARE_ALL_WEAKLINGS ? 300 : 200);
    assert.equal(
      runtime.modifyStrikeDamage(
        { ...context, event: { skillId, actorType: 'effect', ownerActorType: 'player' } },
        100
      ),
      100
    );
  }

  assert.equal(
    runtime.modifyStrikeDamage(
      {
        catalog: runtime.catalog,
        config,
        time: 1,
        event: { skillId: NECROMANCER.NECROTIC_SLASH, actorType: 'player' }
      },
      100
    ),
    100
  );
});

// Core owns the utility now, so its player buff must explicitly retain the former Soulbeast module restriction.
test('Sic Em player modifier preserves Soulbeast eligibility in live and detached queries', () => {
  const rule = rangerCoreModule.modifiers.modifierRules.find((candidate) => candidate.id === 'ranger.sic-em-player');
  for (const specialization of ['Core', 'Soulbeast', 'Untamed']) {
    const context = {
      time: 1,
      event: { skillId: RANGER.SLASH, actorType: 'player' },
      config: { specialization },
      timeline: { buffStacksAt: () => 1 }
    };
    assert.equal(rule.when(context), specialization === 'Soulbeast');
    const live = {
      ...context,
      config: { specialization: 'Core' },
      runtime: {
        profession: { specialization: { kind: specialization, state: {} } },
        buffs: new Map([
          [
            'sic-em',
            [
              {
                at: 0,
                expiresAt: 2,
                stacks: 1,
                resolvedAudience: {
                  includesSelf: true,
                  includesSummons: false,
                  alliedPlayerCount: 0,
                  companionIds: [],
                  recipientCount: 1
                }
              }
            ]
          ]
        ])
      }
    };
    assert.equal(rule.when(live), specialization === 'Soulbeast');
  }
});

// Separate targets must remain independently patchable while the granting skill owns both outgoing bonuses.
test('split buff rules retain recipient checks, expiry, and independent selected tooltip values', () => {
  for (const [profession, adapter, owner, prefix, buff, playerOnly] of [
    [
      elementalistProfession,
      elementalistAppAdapter,
      ELEMENTALIST.FLAME_WHEEL,
      'elementalist.hammer-fire-orb',
      'hammer fire orb',
      false
    ],
    [engineerProfession, engineerAppAdapter, ENGINEER.PLASMATIC_STATE, 'engineer.plasmatic-state', null, true],
    [
      thiefProfession,
      thiefAppAdapter,
      THIEF.DISTRACTING_THROW,
      'thief.distracting-throw-finisher',
      'distracting-throw',
      true
    ]
  ]) {
    const patched = withPatchPreview(profession, {
      id: 'split-buff-targets',
      label: 'Independent buff targets',
      professions: {
        [profession.id]: {
          modifierRules: {
            [`${prefix}-strike`]: { amount: 0.25 },
            [`${prefix}-condition`]: { amount: 0.4 }
          }
        }
      }
    });
    const patch = patched.resolvePatch({ id: 'split-buff-targets' });
    const rules = ['strike', 'condition'].map((target) =>
      patch.balanceContext.modifierRulesById.get(`${prefix}-${target}`)
    );
    const hooks = createModifierHooks({ rules });
    for (const rule of rules) assert.equal(rule.sourceSkillId, owner);
    // Use an unrelated attack: profession scope must preserve the buff beyond its source skill.
    for (const actor of [
      { actorType: 'player' },
      { actorType: 'summon', ownerActorType: 'player' },
      { actorType: 'summon' }
    ]) {
      for (const time of [1, 6]) {
        const context = {
          time,
          event: { skillId: -1, ...actor },
          runtime: {
            profession: { specialization: { kind: 'Amalgam', state: { plasmaticStateUntil: 5 } } },
            buffs: new Map(
              buff ? [[buff, [{ at: 0, expiresAt: 5, stacks: 1, resolvedAudience: { includesSelf: true } }]]] : []
            )
          }
        };
        const active = time < 5 && (!playerOnly || actor.actorType === 'player' || actor.ownerActorType === 'player');
        assert.equal(hooks.modifyStrikeDamage(context, 100), active ? 125 : 100);
        assert.equal(hooks.modifyConditionDamage(context, 100), active ? 140 : 100);
      }
    }

    const facts = adapter.skillTooltip(patch.balanceContext.catalog.skillsById.get(owner), patch).facts;

    assert.ok(facts.some((fact) => /Strike damage/.test(fact.name) && fact.detail === '+25%'));
    assert.ok(facts.some((fact) => /Condition damage/.test(fact.name) && fact.detail === '+40%'));
    const entries = createModifierReference(adapter, patch).filter((entry) =>
      entry.skills.some((skill) => skill.id === owner)
    );
    assert.equal(entries.length, 1);
    assert.deepEqual(
      entries[0].rules.map(({ targets, value }) => [targets, value]),
      [
        [['Strike'], '25%'],
        [['Condition'], '40%']
      ]
    );
  }
});

// Owning the declaration must not restrict state bonuses to the activation's skill ID or require a direct cast.
test('Frost Bow and Crescent Wind retain cross-skill state bonuses and stop at expiry', () => {
  const rules = ['elementalist.frost-bow-condition-duration', 'elementalist.hammer-air-orb'].map((id) =>
    elementalistCoreModule.modifiers.modifierRules.find((rule) => rule.id === id)
  );
  const hooks = createModifierHooks({ rules });
  assert.equal(rules[0].sourceSkillId, ELEMENTALIST.CONJURE_FROST_BOW);
  assert.equal(rules[1].sourceSkillId, ELEMENTALIST.CRESCENT_WIND);
  for (const time of [1, 6]) {
    const context = {
      time,
      event: { skillId: -1, actorType: 'player' },
      runtime: {
        profession: { core: { conjureEquipped: 'Frost Bow', conjureExpiresAt: 5 } },
        buffs: new Map([
          ['hammer air orb', [{ at: 0, expiresAt: 5, stacks: 1, resolvedAudience: { includesSelf: true } }]]
        ])
      }
    };
    assert.equal(hooks.modifyConditionDuration(context, 1), time < 5 ? 1.2 : 1);
    assert.equal(hooks.modifyCriticalChance(context, 0.5), time < 5 ? 0.65 : 0.5);
    context.runtime.profession.core.conjureEquipped = null;
    context.runtime.buffs.clear();
    assert.equal(hooks.modifyConditionDuration(context, 1), 1);
    assert.equal(hooks.modifyCriticalChance(context, 0.5), 0.5);
  }
});

// Health tiers select one multiplier at impact, including the exact boundaries and targets without health.
for (const [profession, specialization, skillId, ruleId, half, quarter] of [
  [necromancerProfession, 'Core', NECROMANCER.PERFORATE, 'necromancer.perforate-target-health', 1.2, 1.2],
  [necromancerProfession, 'Core', NECROMANCER.SATIATE, 'necromancer.satiate-target-health', 1.5, 1.5],
  [
    necromancerProfession,
    'Reaper',
    NECROMANCER.EXECUTIONERS_SCYTHE,
    'necromancer.executioners-scythe-target-health',
    1.5,
    2.0
  ],
  [rangerProfession, 'Core', RANGER.WARCLAWS_ENGAGE, 'ranger.warclaws-engage-target-health', 1.2, 1.2],
  [rangerProfession, 'Core', RANGER.PREDATORS_AMBUSH, 'ranger.predators-ambush-target-health', 1.2, 1.2],
  [thiefProfession, 'Core', THIEF.HEARTSEEKER, 'thief.heartseeker-target-health', 1.6, 2.22],
  [warriorProfession, 'Core', WARRIOR.ARCING_SLICE, 'warrior.arcing-slice-target-health', 1.5, 1.5],
  [warriorProfession, 'Core', WARRIOR.THROW_AXE, 'warrior.throw-axe-target-health', 1.5, 2.0],
  [
    warriorProfession,
    'Spellbreaker',
    WARRIOR.ARCING_SLICE_ID_42707,
    'warrior.arcing-slice-id-42707-target-health',
    1.5,
    1.5
  ]
]) {
  test(`${ruleId} preserves threshold selection and packet ownership`, () => {
    for (const patched of [false, true]) {
      const profile = withPatchPreview(
        profession,
        patched
          ? {
              id: 'health-tier-test',
              label: 'Health tiers',
              professions: {
                [profession.id]: {
                  modifierRules: {
                    [ruleId]: half === quarter ? { factor: 1.7 } : { parameters: { belowHalf: 1.7, belowQuarter: 2.7 } }
                  }
                }
              }
            }
          : null
      ).resolvePatch({ id: patched ? 'health-tier-test' : 'current' });
      const rule = profile.balanceContext.modifierRulesById.get(ruleId);
      const hooks = createModifierHooks({ rules: [rule] });
      const skill = profile.balanceContext.catalog.skillsById.get(skillId);
      const effectScoped = skill.effects.some((effect) =>
        effect.modifiers?.some((candidate) => candidate.id === ruleId)
      );
      for (const health of [null, 1, 0.5, 0.499, 0.25, 0.249, 0]) {
        const config = { specialization, target: health == null ? {} : { fixedHealthFraction: health } };
        const context = { config, event: { skillId, actorType: 'player', effectModifierIds: [ruleId] } };
        const factor =
          health == null || health >= 0.5
            ? 1
            : health >= 0.25
              ? patched
                ? 1.7
                : half
              : patched
                ? half === quarter
                  ? 1.7
                  : 2.7
                : quarter;
        assert.equal(hooks.modifyStrikeDamage(context, 100), 100 * factor);
        assert.equal(hooks.modifyStrikeDamage({ ...context, event: { ...context.event, skillId: -1 } }, 100), 100);

        if (effectScoped) assert.equal(hooks.modifyStrikeDamage({ ...context, event: { skillId } }, 100), 100);

        assert.equal(hooks.modifyConditionDamage({ ...context, condition: 'Bleeding' }, 100), 100);
      }
    }
  });
}
