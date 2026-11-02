// Intrinsic bonuses share selected values with skill cards and apply only to their canonical skill owner.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createModifierReference } from '#gw2/app/modifier-reference/model.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { rangerAppAdapter } from '#gw2/professions/ranger/app/app-definition.js';
import { RANGER_SKILL_IDS as RANGER } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { warriorAppAdapter } from '#gw2/professions/warrior/app/app-definition.js';
import { WARRIOR_SKILL_IDS as WARRIOR } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';

const preview = {
  id: 'intrinsic-owners',
  label: 'Intrinsic owners',
  professions: {
    ranger: {
      modifierRules: {
        'ranger.pounce-defiant': { factor: 1.3 },
        'ranger.falcons-stoop-disabled': { factor: 1.4 },
        'ranger.unleashed-wild-swing-defiant': { factor: 1.5 },
        'ranger.unleashed-savage-shock-wave-defiant': { factor: 1.6 },
        'ranger.condition-count-skill-bonus': { parameters: { damagePerCondition: 0.03 } },
        'ranger.consuming-bite-condition-count': { parameters: { maximumConditions: 2, coefficientPerCondition: 0.05 } }
      }
    },
    warrior: { modifierRules: { 'warrior.slicing-maelstrom-boonless': { factor: 1.8 } } }
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
        [[WARRIOR.SLICING_MAELSTROM, 'Strike damage against a boonless target', patched ? '+80%' : '+50%']]
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
