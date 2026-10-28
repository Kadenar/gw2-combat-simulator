import assert from 'node:assert/strict';
import test from 'node:test';

import { traitSkillTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import { invokeTraitSkill } from '#gw2/platform/profession-definition/trait-emission.js';
import { guardianTooltips } from '#gw2/professions/guardian/app/tooltips.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { GUARDIAN_TRAIT_IDS as G } from '#gw2/professions/guardian/data/ids.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/catalog.js';
import { NECROMANCER_SKILL_IDS as N } from '#gw2/professions/necromancer/data/ids.js';
import { rangerTooltips } from '#gw2/professions/ranger/app/tooltips.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { RANGER_SKILL_IDS as R, RANGER_TRAIT_IDS as RT } from '#gw2/professions/ranger/data/ids.js';
import { warriorTooltips } from '#gw2/professions/warrior/app/tooltips.js';
import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import { WARRIOR_SKILL_IDS as W, WARRIOR_TRAIT_IDS as WT } from '#gw2/professions/warrior/data/ids.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';

// Trait tooltips retain skill-owned timing facts while damage categories remain profession-authored.
test('invoked skill facts preserve field duration, cadence, and scoped damage bonuses', () => {
  const furious = guardianTooltips.traits[G.FURIOUS_FOCUS]({ catalog: guardianCatalog }, { id: G.FURIOUS_FOCUS });
  assert.equal(furious.facts.find((fact) => fact.name === 'Symbol field duration').detail, '4s');
  const earth = rangerTooltips.traits[RT.CHILD_OF_EARTH]({ catalog: rangerCatalog }, { id: RT.CHILD_OF_EARTH });
  assert.equal(earth.facts.find((fact) => fact.name === 'Pulse interval').detail, '2s');
  const throat = rangerTooltips.traits[RT.GO_FOR_THE_THROAT]({ catalog: rangerCatalog }, { id: RT.GO_FOR_THE_THROAT });
  assert.equal(throat.facts.filter((fact) => fact.detail.includes('%')).length, 2);
  const cartridges = warriorTooltips.skills[W.OVERCHARGED_CARTRIDGES](
    { catalog: warriorCatalog },
    { id: W.OVERCHARGED_CARTRIDGES }
  );
  const bonuses = cartridges.facts.filter((fact) => fact.detail.includes('%'));
  assert.equal(bonuses.length, 2);
  assert.ok(bonuses.every((fact) => fact.name.endsWith('explosion damage')));
  const tether = warriorTooltips.traits[WT.MAGEBANE_TETHER]({ catalog: warriorCatalog }, { id: WT.MAGEBANE_TETHER });
  assert.equal(tether.facts.find((fact) => fact.name === 'Strike damage while tethered').detail, '+15%');
});

// Patch component keys must not replace the invoked skill's visible identity or causal parent.
for (const id of [
  N.LESSER_CHILBLAINS,
  N.LESSER_MARK_OF_BLOOD,
  N.LESSER_SPINAL_SHIVERS,
  N.LESSER_SIGNET_OF_THE_LOCUST
]) {
  test(`invoked skill ${id} owns packet labels and hides zero recharge facts`, () => {
    const capture = captureEffectEmissions();
    const skill = necromancerCatalog.skillsById.get(id);
    invokeTraitSkill({ ...capture, helpers: { skillsById: necromancerCatalog.skillsById } }, 'fixture-trait', id, {
      type: 'damage',
      at: 0,
      skillId: 'fixture-parent',
      skillName: 'Triggering skill'
    });
    const strike = capture.events.find((event) => event.type === 'damage');
    assert.equal(strike.name, skill.name);
    assert.equal(strike.skillId, id);
    assert.equal(strike.parentSkillName, 'Triggering skill');
    const tooltip = traitSkillTooltip([id], 'Fixture')({ catalog: necromancerCatalog }, { id: 'fixture-trait' });
    assert.equal(
      tooltip.facts.some((fact) => fact.name.endsWith('recharge')),
      skill.cooldown > 0
    );
    assert.ok(tooltip.facts.every((fact) => !fact.detail.includes('· Strike')));

    if (id === N.LESSER_SPINAL_SHIVERS) {
      const strikeFact = tooltip.facts.find((fact) => fact.name === 'Strike damage');
      assert.ok(strikeFact.detail.endsWith('Lesser Spinal Shivers · No boons'));
      assert.equal(strikeFact.detail.includes('Lesser Spinal Shivers - No Boons'), false);
    }
  });
}

test('Clarion Bond finisher keeps a visible trait label through shared emission', () => {
  const capture = captureEffectEmissions();
  const id = R.LESSER_CALL_OF_THE_WILD;
  invokeTraitSkill({ ...capture, helpers: { skillsById: rangerCatalog.skillsById } }, 'fixture-trait', id, {
    type: 'action',
    at: 0,
    skillName: 'Pet swap'
  });
  const finisher = capture.events.find((event) => event.comboFinishers?.length);
  assert.equal(finisher.name, 'Lesser Call of the Wild — Blast Finisher');
  assert.equal(finisher.procType, 'trait');
  assert.equal(finisher.skillId, id);
});
