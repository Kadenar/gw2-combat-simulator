import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { GUARDIAN_SKILL_IDS as G } from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { MESMER_SKILL_IDS as M } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as R } from '#gw2/professions/revenant/data/ids.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { THIEF_SKILL_IDS as T } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { WARRIOR_SKILL_IDS as W } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });

// Explicit skill IDs keep eligibility regressions visible; setups unlock native flips and profession states.
const groups = [
  {
    profession: guardianProfession,
    config: { specialization: 'Willbender', primaryWeapon: 'Sword', secondaryWeapon: 'Sword' },
    cases: [
      [G.SYMBOL_OF_BLADES],
      [G.ADVANCING_STRIKE],
      [G.CRASHING_COURAGE],
      [G.FLASH_COMBO],
      // Let Flash Combo's relic cooldown expire while Repose remains available.
      [G.REPOSE, {}, [G.FLASH_COMBO, wait(4500)]],
      [G.HEAVENS_PALM],
      [G.JUDGES_INTERVENTION]
    ]
  },
  {
    profession: mesmerProfession,
    config: { specialization: 'Mirage', primaryWeapon: 'Axe', secondaryWeapon: 'Torch', initialResource: 0 },
    cases: [
      [M.PHASE_RETREAT, { primaryWeapon: 'Staff', secondaryWeapon: '' }],
      [M.FALSE_OASIS],
      [M.CRYSTAL_SANDS],
      [M.MIRAGE_ADVANCE],
      [M.SAND_THROUGH_GLASS],
      [M.AXES_OF_SYMMETRY],
      [M.ILLUSIONARY_AMBUSH],
      [M.JAUNT],
      [M.AXES_OF_SYMMETRY_NON_MIRAGE, { specialization: 'Core' }],
      [M.MENTAL_COLLAPSE, { primaryWeapon: 'Spear', secondaryWeapon: '' }]
    ]
  },
  {
    profession: revenantProfession,
    config: {
      specialization: 'Conduit',
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword',
      selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ENTITY,
      initialEnergy: 100
    },
    cases: [
      [R.UNRELENTING_ASSAULT],
      [R.DEATHSTRIKE],
      [R.PHASE_SMASH, { primaryWeapon: 'Hammer', secondaryWeapon: '' }],
      [R.BEGUILING_HAZE]
    ]
  },
  {
    profession: thiefProfession,
    config: { specialization: 'Core', primaryWeapon: 'Dagger', secondaryWeapon: 'Dagger' },
    cases: [
      [T.STEAL],
      [T.SHADOW_STRIKE, { primaryWeapon: 'Pistol' }],
      [T.INFILTRATORS_ARROW, { primaryWeapon: 'Shortbow', secondaryWeapon: '' }],
      [T.HIDE_IN_SHADOWS],
      [T.SHADOW_SHOT, { secondaryWeapon: 'Pistol' }],
      [T.BLINDING_POWDER],
      [T.INFILTRATORS_SIGNET],
      [T.THIEVES_GUILD],
      [T.DEATHS_RETREAT, { specialization: 'Deadeye', primaryWeapon: 'Rifle', secondaryWeapon: '' }],
      [T.MEASURED_SHOT, { specialization: 'Specter', primaryWeapon: 'Scepter', secondaryWeapon: 'Pistol' }],
      [T.WELL_OF_SORROW, { specialization: 'Specter' }],
      [T.WELL_OF_TEARS, { specialization: 'Specter' }],
      [T.WELL_OF_BOUNTY, { specialization: 'Specter' }],
      [T.HARROWING_STORM, { primaryWeapon: 'Axe' }],
      [T.INFILTRATORS_RETURN, { primaryWeapon: 'Sword' }, [T.INFILTRATORS_STRIKE]]
    ]
  },
  {
    profession: warriorProfession,
    config: { specialization: 'Bladesworn', initialResource: 100 },
    cases: [[W.FLICKER_STEP, {}, [W.DRAGON_TRIGGER]]]
  }
];

for (const { profession, config, cases } of groups) {
  const run = createProfessionSimulator(profession, () => ({
    attributeInputs: baseAttributeInputs({ power: 2000, conditionDamage: 1000 }),
    selectedTraitIds: [],
    target: { armor: 2597 },
    relic: 'Peitha',
    ...config
  }));

  test(`${profession.id} Peitha cases cover every currently eligible catalog skill`, () => {
    const eligible = profession.catalog.skills
      .filter((skill) => skill.shadowstepSkill || skill.categories?.includes('Deception'))
      .map((skill) => skill.id);
    assert.deepEqual(new Set(cases.map(([skillId]) => skillId)), new Set(eligible));
  });

  // Each native activation owns one relic proc and both payloads, including non-damaging Deceptions and returns.
  for (const [skillId, overrides = {}, setup = []] of cases) {
    const skill = profession.catalog.skillsById.get(skillId);
    test(`${profession.id}: ${skill.name} (${skillId}) owns its Peitha buff and Torment`, () => {
      const result = run([...setup, skillId, wait(1500)], overrides, { combatStartTime: 0 });
      assert.deepEqual(result.warnings, []);
      const cast = result.events.find((event) => event.type === 'action' && event.skillId === skillId);
      assert.ok(cast);
      const buffs = result.events.filter(
        (event) => event.type === 'buff' && event.kind === 'relic-peitha' && event.activationId === cast.activationId
      );
      const torment = result.resolvedEvents.filter(
        (event) =>
          event.type === 'condition' &&
          event.skillName === 'Relic of Peitha' &&
          event.condition === 'Torment' &&
          event.activationId === cast.activationId
      );
      assert.equal(buffs.length, 1);
      assert.equal(buffs[0].triggeredBy, skill.name);
      assert.equal(
        torment.reduce((sum, event) => sum + event.stacks, 0),
        2
      );
      assert.equal(torment[0].at, buffs[0].at);
      assert.equal(torment[0].parentEventOrder, buffs[0].parentEventOrder);
    });
  }
}
