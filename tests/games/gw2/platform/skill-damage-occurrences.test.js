import assert from 'node:assert/strict';
import test from 'node:test';
import { damageOccurrences } from '#gw2/platform/skill-damage/list-occurrences.js';
import { evaluateSkillDamage } from '#gw2/platform/skill-damage/measure-occurrences.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { emitTraitProfile, invokeTraitSkill } from '#gw2/platform/profession-definition/trait-emission.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

const TRAIT = 991090;
const skills = [1, 2].map((duration) => ({
  id: 991000 + duration,
  name: `Trigger ${duration}`,
  castTimeMs: 0,
  duration,
  effects: [{ type: 'strike', coefficient: 1, weaponStrength: 1000 }]
}));
const occurrence = (skill) => ({
  id: String(skill.id),
  name: skill.name,
  effect: { kind: 'skill', id: skill.id },
  icon: '',
  source: 'Skill',
  unit: 'activation'
});

// A raw profile can contain mutually exclusive packets and defaults that are invalid for the triggering context.
test('trait contributions use runtime filtering, transforms, selection, and attribution for each triggering skill', () => {
  const catalog = createCanonicalCatalog({
    generated: skills,
    traits: [{ id: TRAIT, name: 'Contextual trait' }],
    balanceProfiles: [
      {
        id: TRAIT,
        name: 'Contextual trait',
        effects: [
          { type: 'condition', name: 'Burning', condition: 'Burning', stacks: 1, duration: 99 },
          { type: 'condition', name: 'Poisoned', condition: 'Poisoned', stacks: 1, duration: 99 }
        ]
      }
    ]
  });
  const profession = defineTestProfession({
    id: 'contextual-trait',
    name: 'Contextual trait fixture',
    catalog,
    hooks: {
      reactions: {
        'damage.resolved'(runtime, event) {
          if (!hasTrait(runtime, TRAIT) || event.traitId != null) return;

          const skill = runtime.helpers.skillsById.get(event.skillId);
          emitTraitProfile(runtime, TRAIT, TRAIT, event, {
            effect: { type: 'condition', name: 'Burning' },
            attribution: { source: 'Player', sourceId: skill.id, skillId: skill.id },
            transform: (packet) => ({ ...packet, duration: skill.duration })
          });
        }
      }
    }
  });
  const cache = new Map();
  for (const selectedTraitIds of [[TRAIT], [String(TRAIT)], [`0${TRAIT}`], [], [999]]) {
    const config = { selectedTraitIds };
    assert.deepEqual(damageOccurrences(profession.runtimeFor(config), config), []);
    for (const includeTraitProcs of [0, 1, 0]) {
      const result = evaluateSkillDamage(
        { config, inputs: { includeTraitProcs }, occurrences: skills.map(occurrence) },
        profession,
        cache
      );
      for (const [index, row] of result.occurrences.entries()) {
        assert.equal(row.status, 'measured');
        const expected = includeTraitProcs && Number(selectedTraitIds[0]) === TRAIT;
        const conditions = row.measurement.conditions;
        assert.deepEqual(
          conditions.map((entry) => [entry.condition, entry.attribution]),
          expected ? [['Burning', 'Contextual trait']] : []
        );

        if (expected) assert.equal(conditions[0].baseDurationSeconds, index + 1);
      }
    }
  }
});

// Matching condition formulas must not merge applications belonging to different passive traits.
test('condition rows preserve distinct trait owners with identical damage facts', () => {
  const traits = [TRAIT, TRAIT + 1].map((id) => ({ id, name: `Trait ${id}` }));
  const profession = defineTestProfession({
    id: 'condition-owners',
    name: 'Condition owners',
    catalog: createCanonicalCatalog({
      generated: skills,
      traits,
      balanceProfiles: traits.map((trait) => ({
        ...trait,
        effects: [{ type: 'condition', condition: 'Burning', stacks: 1, duration: 2 }]
      }))
    }),
    hooks: {
      reactions: {
        'damage.resolved'(runtime, event) {
          if (event.traitId != null) return;

          for (const trait of traits) {
            emitTraitProfile(runtime, trait.id, trait.id, event, {
              attribution: { source: 'Player', sourceId: event.sourceId, skillId: event.skillId }
            });
          }
        }
      }
    }
  });
  const [result] = evaluateSkillDamage(
    { config: {}, inputs: { includeTraitProcs: 1 }, occurrences: [occurrence(skills[0])] },
    profession
  ).occurrences;
  assert.equal(result.status, 'measured');
  const rows = result.measurement.conditions;
  assert.deepEqual(
    rows.map((row) => row.attribution),
    traits.map((trait) => trait.name)
  );
  assert.ok(rows.every((row) => row.stacks === 1));
  assert.equal(rows[0].damage, rows[1].damage);
  assert.equal(
    result.measurement.conditionDamage,
    rows.reduce((total, row) => total + row.damage, 0)
  );
});

// Invoked skills retain their actual transformed payload without automatically manufacturing standalone adapters.
test('invoked trait skills are measured from their emitted damage', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      ...skills,
      { id: 991003, name: 'Invoked strike', effects: [{ type: 'strike', coefficient: 9, weaponStrength: 1000 }] }
    ],
    traits: [{ id: TRAIT, name: 'Invoker' }]
  });
  const profession = defineTestProfession({
    id: 'invoked-trait',
    name: 'Invoked trait fixture',
    catalog,
    hooks: {
      reactions: {
        'damage.resolved'(runtime, event) {
          if (event.traitId != null) return;

          invokeTraitSkill(runtime, TRAIT, 991003, event, {
            transform: (packet) => ({ ...packet, coefficient: 2 })
          });
        }
      }
    }
  });
  const [off, on] = [0, 1].map(
    (includeTraitProcs) =>
      evaluateSkillDamage(
        { config: {}, inputs: { includeTraitProcs }, occurrences: [occurrence(skills[0])] },
        profession
      ).occurrences[0]
  );
  assert.equal(on.status, 'measured');
  assert.equal(on.measurement.coefficient - off.measurement.coefficient, 2);
});
