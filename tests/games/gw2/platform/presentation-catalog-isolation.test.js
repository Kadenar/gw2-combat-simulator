import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { bindElementalistCoreUi } from '#gw2/professions/elementalist/core/presentation.js';
import { bindElementalistFamilyUi } from '#gw2/professions/elementalist/family-presentation.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { bindEngineerCoreUi } from '#gw2/professions/engineer/core/presentation.js';
import { bindHolosmithUi } from '#gw2/professions/engineer/specializations/holosmith/presentation.js';
import { bindAmalgamUi } from '#gw2/professions/engineer/specializations/amalgam/presentation.js';
import { bindScrapperUi } from '#gw2/professions/engineer/specializations/scrapper/presentation.js';
import { bindRangerCoreUi } from '#gw2/professions/ranger/core/presentation.js';
import { bindDruidUi } from '#gw2/professions/ranger/specializations/druid/presentation.js';
import { bindGaleshotUi } from '#gw2/professions/ranger/specializations/galeshot/presentation.js';
import { bindSoulbeastUi } from '#gw2/professions/ranger/specializations/soulbeast/presentation.js';
import { bindUntamedUi } from '#gw2/professions/ranger/specializations/untamed/presentation.js';
import { bindGuardianCoreUi } from '#gw2/professions/guardian/core/presentation.js';
import { bindDragonhunterUi } from '#gw2/professions/guardian/specializations/dragonhunter/presentation.js';
import { bindFirebrandUi } from '#gw2/professions/guardian/specializations/firebrand/presentation.js';
import { bindLuminaryUi } from '#gw2/professions/guardian/specializations/luminary/presentation.js';
import { bindWillbenderUi } from '#gw2/professions/guardian/specializations/willbender/presentation.js';
import { bindNecromancerCoreUi } from '#gw2/professions/necromancer/core/presentation.js';
import { bindReaperUi } from '#gw2/professions/necromancer/specializations/reaper/presentation.js';
import { bindHarbingerUi } from '#gw2/professions/necromancer/specializations/harbinger/presentation.js';
import { bindRitualistUi } from '#gw2/professions/necromancer/specializations/ritualist/presentation.js';

const skill = (id, name, fields = {}) => ({ id, name, castTimeMs: 0, effects: [], ...fields });
const catalog = (...skills) => createCanonicalCatalog({ extraSkills: skills });
const groupIds = (ui, context, id) => ui.paletteGroups(context).find((group) => group.id === id).skillIds;

// Read each instance before and after binding another, in both initialization orders.
function assertIsolated(bind, catalogs, read, expected) {
  for (const order of [
    [0, 1],
    [1, 0]
  ]) {
    const [first, second] = order;
    const a = bind(catalogs[first]);
    assert.deepEqual(read(a), expected[first]);
    const b = bind(catalogs[second]);
    assert.deepEqual(read(b), expected[second]);
    assert.deepEqual(read(a), expected[first]);
  }
}

test('Engineer Core and elite toolbelts use their own catalogs without Core binding side effects', () => {
  const catalogs = [1, 2].map((id) => catalog(skill(100, 'Heal'), skill(id, 'Toolbelt', { toolbeltParentId: 100 })));
  const context = { config: { selectedSkillIds: [100] } };
  for (const bind of [bindEngineerCoreUi, bindHolosmithUi, bindAmalgamUi, bindScrapperUi]) {
    assertIsolated(bind, catalogs, (ui) => groupIds(ui, context, 'engineer-profession')[0], [1, 2]);
  }
});

// Renaming a kit changes its label, never its bundle membership, active state, or parent relationship.
test('Engineer kit and toolbelt projections follow IDs when catalog labels change', () => {
  const equip = skill(5805, 'Renamed bundle', { kitTransition: 'equip' });
  const grenade = skill(5807, 'Renamed attack', { kitId: equip.id, slot: 'Weapon_1' });
  const toolbelt = skill(5810, 'Renamed toolbelt', { toolbeltParentId: equip.id });
  const ui = bindEngineerCoreUi(catalog(equip, grenade, toolbelt));
  const context = { config: { selectedSkillIds: [equip.id] }, professionState: { activeKit: equip.id } };
  assert.deepEqual(groupIds(ui, context, 'engineer-kit-5805'), [grenade.id]);
  assert.deepEqual(groupIds(ui, context, 'engineer-profession'), [toolbelt.id]);
  assert.equal(ui.paletteOverride(context, equip).tileActive, false);
  assert.equal(ui.paletteOverride({ professionState: { activeKit: null } }, equip).tileActive, true);
});

test('Engineer Forge and protocol controls retain their local skill lists and lookups', () => {
  const catalogs = [1, 2].map((id) =>
    catalog(
      skill(id, 'Protocol', { forgeSkill: true, specialization: 'Amalgam', categories: ['Morph'], mechanicSlot: 2 })
    )
  );
  assertIsolated(bindHolosmithUi, catalogs, (ui) => groupIds(ui, {}, 'engineer-forge'), [[1], [2]]);
  const context = { build: { selectedMorphSkillIds: [1] } };
  assertIsolated(bindAmalgamUi, catalogs, (ui) => ui.skillBarGroups(context)[0].selections[0].optionSkillIds, [
    [1],
    [2]
  ]);
});

test('all Ranger pet palettes use the catalog supplied to their own factory', () => {
  // Commandability requires a pet skill; varying only its autonomous flag isolates each factory's catalog lookup.
  const catalogs = [false, true].map((petAutonomousSkill) =>
    catalog(skill(1, 'Pet attack', { petSkill: true, petAutonomousSkill }))
  );
  const context = { professionState: { activePetSkillIds: [1], beastmodeActive: false } };
  for (const bind of [bindRangerCoreUi, bindDruidUi, bindGaleshotUi, bindSoulbeastUi, bindUntamedUi]) {
    assertIsolated(bind, catalogs, (ui) => groupIds(ui, context, 'ranger-pet').includes(1), [true, false]);
  }
});

test('Untamed and Soulbeast derived skill collections remain instance-local', () => {
  const catalogs = [true, false].map((enabled) =>
    catalog(skill(1, 'Beast attack', { unleashedPetSkill: enabled, beastmodeSkill: enabled }))
  );
  assertIsolated(bindUntamedUi, catalogs, (ui) => groupIds(ui, {}, 'ranger-untamed-profession').includes(1), [
    true,
    false
  ]);
});

test('Guardian virtue and mode helpers use each Core or elite instance catalog', () => {
  for (const [bind, id] of [
    [bindGuardianCoreUi, 9115],
    [bindDragonhunterUi, 29887],
    [bindFirebrandUi, 44364],
    [bindLuminaryUi, 78837],
    [bindWillbenderUi, 62668]
  ]) {
    const catalogs = [1, 2].map((variant) =>
      catalog(
        skill(id, `Renamed virtue ${variant}`),
        skill(variant, 'Mode action', { tome: 'justice', radiantForgeSkill: true })
      )
    );
    assertIsolated(bind, catalogs, (ui) => groupIds(ui, {}, 'profession'), [[id], [id]]);
    if (bind === bindFirebrandUi || bind === bindLuminaryUi) {
      const group = bind === bindFirebrandUi ? 'tome-justice' : 'radiant-forge';
      assertIsolated(bind, catalogs, (ui) => groupIds(ui, {}, group), [[1], [2]]);
    }
  }
});

test('Necromancer transform palettes do not depend on the last Core catalog bound', () => {
  for (const [bind, shroud] of [
    [bindNecromancerCoreUi, 'death'],
    [bindReaperUi, 'reaper'],
    [bindHarbingerUi, 'harbinger'],
    [bindRitualistUi, 'ritualist']
  ]) {
    const catalogs = [1, 2].map((id) => catalog(skill(id, 'Shroud attack', { shroud })));
    assertIsolated(bind, catalogs, (ui) => groupIds(ui, {}, 'shroud'), [[1], [2]]);
  }
});

test('Elementalist family and Core factories receive their own assembled catalog', () => {
  const skills = (icon) => [
    skill(ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Fire, 'Fire Attunement', { icon }),
    skill(1, 'Scorching Shot', { icon })
  ];
  // Family controls must work even when Core presentation has never been initialized.
  assertIsolated(
    bindElementalistFamilyUi,
    ['first', 'second'].map((icon) => catalog(...skills(icon))),
    (ui) => ui.startControls({})[0].options[0].icon,
    ['first', 'second']
  );
  const create = (icon) =>
    defineNativeProfession({
      id: 'elementalist',
      name: 'Elementalist',
      modules: [
        defineNativeModule({
          id: 'Core',
          data: { extraSkills: skills(icon) },
          state: { create: () => ({}) },
          presentation: bindElementalistCoreUi
        })
      ],
      presentation: bindElementalistFamilyUi
    });
  assertIsolated(
    create,
    ['first', 'second'],
    (profession) => {
      const ui = profession.ui;
      const bullets = ui
        .paletteGroups({ build: { weapons: ['Pistol'] } })
        .find((group) => group.id === 'elementalist-pistol-bullets');
      return [ui.startControls({})[0].options[0].icon, bullets.controls[0].icon];
    },
    [
      ['first', 'first'],
      ['second', 'second']
    ]
  );
});
