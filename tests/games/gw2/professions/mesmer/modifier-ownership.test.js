// Selected owner tuning must agree across compiled combat rules, skill cards, and the modifier reference.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createModifierReference } from '#gw2/app/modifier-reference/model.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';

const family = withPatchPreview(mesmerProfession, {
  id: 'modifier-owners',
  label: 'Modifier owners',
  professions: {
    mesmer: {
      balanceProfiles: {
        [TRAIT.SYMPHONIC_RESONANCE]: { fields: { damageIncrease: 0.2 } },
        [TRAIT.QUIET_INTENSITY]: { fields: { phantasmCriticalChance: 0.2 } }
      },
      modifierRules: { 'mesmer.mind-stab-vulnerability': { parameters: { damagePerStack: 0.02 } } }
    }
  }
});

test('Symphonic Resonance owns intrinsic Lute tuning, expiry, and personal additive damage', () => {
  for (const [patchId, bonus] of [
    ['current', 0.1],
    ['modifier-owners', 0.2]
  ]) {
    for (const specialization of ['Core', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour']) {
      const runtime = family.runtimeFor({ specialization, patchId });
      for (const selectedTraitIds of [[], [TRAIT.SYMPHONIC_RESONANCE]]) {
        for (const summonKind of [undefined, 'clone', 'phantasm', 'afterimage']) {
          for (const time of [1, 2]) {
            const context = {
              catalog: runtime.catalog,
              time,
              config: { specialization, selectedTraitIds },
              event: { actorType: summonKind ? 'summon' : 'player', summonKind },
              events: [{ type: 'mesmer.instrument', instrument: 'Lute', at: 0, expiresAt: 2 }],
              damageInputs: { equipmentBonus: 0.05 }
            };
            const expected = 1.05 + (specialization === 'Troubadour' && !summonKind && time < 2 ? bonus : 0);
            assert.ok(Math.abs(runtime.calculations.modifyStrikeDamage(context, 1) - expected) < 1e-12);
            assert.ok(
              Math.abs(
                runtime.calculations.modifyConditionDamage({ ...context, condition: 'Bleeding' }, 1) - expected
              ) < 1e-12
            );
          }
        }
      }
    }
  }
});

test('trait reference and Quiet Intensity facts read the selected trait balance', () => {
  for (const [patchId, luteBonus, phantasmBonus] of [
    ['current', '+10%', '+15%'],
    ['modifier-owners', '+20%', '+20%']
  ]) {
    const patch = family.resolvePatch({ id: patchId });
    const entries = createModifierReference(mesmerAppAdapter, patch);
    const resonance = entries.find((entry) => entry.name === 'Symphonic Resonance');
    assert.equal(resonance.source, 'trait');
    assert.equal(
      resonance.tooltip.facts.find((fact) => fact.name === 'Personal strike and condition damage with Lute').detail,
      luteBonus
    );
    assert.ok(!entries.some((entry) => entry.name.startsWith('Lute Playing')));
    const trait = patch.balanceContext.catalog.traits.find((entry) => entry.id === TRAIT.QUIET_INTENSITY);
    const tooltip = mesmerAppAdapter.traitTooltip(trait, patch, 'Virtuoso');
    assert.equal(
      tooltip.facts.find((fact) => fact.name === 'Additional phantasm critical chance with Phantasmal Fury').detail,
      phantasmBonus
    );
  }
});

test('Mind Stab shares patched vulnerability tuning between its skill, combat rule, and reference', () => {
  for (const [patchId, perStack, detail] of [
    ['current', 0.01, '+1%'],
    ['modifier-owners', 0.02, '+2%']
  ]) {
    const runtime = family.runtimeFor({ specialization: 'Core', patchId });
    const patch = family.resolvePatch({ id: patchId });
    const skill = patch.balanceContext.catalog.skillsById.get(ID.MIND_STAB);
    const tooltip = mesmerAppAdapter.skillTooltip(skill, patch);
    assert.equal(
      tooltip.facts.find((fact) => fact.name === 'Additional strike damage per Vulnerability stack').detail,
      detail
    );
    const entry = createModifierReference(mesmerAppAdapter, patch).find((entry) => entry.name === 'Mind Stab');
    assert.equal(entry.source, 'weapon');
    assert.deepEqual(
      entry.skills.map((owner) => owner.id),
      [ID.MIND_STAB]
    );
    assert.deepEqual(entry.tooltip, tooltip);
    for (const skillId of [ID.MIND_STAB, ID.SPATIAL_SURGE]) {
      for (const stacks of [0, 10, 25]) {
        const context = {
          catalog: runtime.catalog,
          config: { selectedTraitIds: [] },
          time: 0,
          event: { actorType: 'player', skillId },
          query: { vulnerabilityStacksAt: () => stacks }
        };
        assert.equal(
          runtime.calculations.modifyStrikeDamage(context, 100),
          100 * (1 + (skillId === ID.MIND_STAB ? stacks * perStack : 0))
        );
      }
    }
  }
});
