import { rangerPetForState } from '#gw2/professions/ranger/data/pets.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { combineSkillFields } from '#gw2/platform/skills/field-specs.js';
import { ENGINEER_CORE_SKILL_FIELDS } from '#gw2/professions/engineer/core/skill-fields.js';
import { HOLOSMITH_SKILL_FIELDS } from '#gw2/professions/engineer/specializations/holosmith/skill-fields.js';
import { RANGER_CORE_SKILL_FIELDS } from '#gw2/professions/ranger/core/skill-fields.js';
import { DRUID_SKILL_FIELDS } from '#gw2/professions/ranger/specializations/druid/skill-fields.js';
import { GALESHOT_SKILL_FIELDS } from '#gw2/professions/ranger/specializations/galeshot/skill-fields.js';
import { LUMINARY_SKILL_FIELDS } from '#gw2/professions/guardian/specializations/luminary/skill-fields.js';
import { FIREBRAND_SKILL_FIELDS } from '#gw2/professions/guardian/specializations/firebrand/skill-fields.js';
import { NECROMANCER_CORE_SKILL_FIELDS } from '#gw2/professions/necromancer/core/skill-fields.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { bindElementalistCoreUi } from '#gw2/professions/elementalist/core/presentation.js';
import { bindElementalistFamilyUi } from '#gw2/professions/elementalist/family-presentation.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS, ELEMENTALIST_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { bindEngineerCoreUi } from '#gw2/professions/engineer/core/presentation.js';
import { ENGINEER_SKILL_IDS as ENGINEER_ID } from '#gw2/professions/engineer/data/ids.js';
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
// Select only the current profession's field vocabulary, matching real catalog assembly.
const catalogFor = (...tables) => {
  const skillFields = combineSkillFields(tables.map((fields, index) => ({ owner: `fixture-${index}`, fields })));
  return (...skills) => createCanonicalCatalog({ extraSkills: skills, skillFields });
};

const engineerCatalog = catalogFor(ENGINEER_CORE_SKILL_FIELDS, HOLOSMITH_SKILL_FIELDS);
const rangerCatalog = catalogFor(RANGER_CORE_SKILL_FIELDS, DRUID_SKILL_FIELDS, GALESHOT_SKILL_FIELDS);
const guardianCatalog = catalogFor(LUMINARY_SKILL_FIELDS, FIREBRAND_SKILL_FIELDS);
const necromancerCatalog = catalogFor(NECROMANCER_CORE_SKILL_FIELDS);
const elementalistCatalog = catalogFor();
const groupIds = (ui, context, id) => ui.paletteGroups(context).find((group) => group.id === id).skillIds;

// Read each instance with its selected catalog before and after binding another, in both initialization orders.
function assertIsolated(bind, catalogs, read, expected) {
  for (const order of [
    [0, 1],
    [1, 0]
  ]) {
    const [first, second] = order;
    const a = bind(catalogs[first]);
    assert.deepEqual(read(a, catalogs[first]), expected[first]);
    const b = bind(catalogs[second]);
    assert.deepEqual(read(b, catalogs[second]), expected[second]);
    assert.deepEqual(read(a, catalogs[first]), expected[first]);
  }
}

test('Engineer Core and elite toolbelts use their own catalogs without Core binding side effects', () => {
  const catalogs = [1, 2].map((id) =>
    engineerCatalog(skill(100, 'Heal'), skill(id, 'Toolbelt', { toolbeltParentId: 100 }))
  );
  const context = { config: { selectedSkillIds: [100] } };
  for (const bind of [bindEngineerCoreUi, bindHolosmithUi, bindAmalgamUi, bindScrapperUi]) {
    assertIsolated(
      bind,
      catalogs,
      (ui, catalog) => groupIds(ui, { ...context, catalog }, 'engineer-profession')[0],
      [1, 2]
    );
  }
});

// Renaming a kit changes its label, never its bundle membership, active state, or parent relationship.
test('Engineer kit and toolbelt projections follow IDs when catalog labels change', () => {
  const equip = skill(5805, 'Renamed bundle', { kitTransition: 'equip' });
  const grenade = skill(5807, 'Renamed attack', { kitId: equip.id, slot: 'Weapon_1' });
  const toolbelt = skill(5810, 'Renamed toolbelt', { toolbeltParentId: equip.id });
  const ui = bindEngineerCoreUi(engineerCatalog(equip, grenade, toolbelt));
  const context = { config: { selectedSkillIds: [equip.id] }, professionState: { activeKit: equip.id } };
  assert.deepEqual(groupIds(ui, context, 'engineer-kit-5805'), [grenade.id]);
  assert.deepEqual(groupIds(ui, context, 'engineer-profession'), [toolbelt.id]);
  assert.equal(ui.paletteOverride(context, equip).tileActive, false);
  assert.equal(ui.paletteOverride({ professionState: { activeKit: null } }, equip).tileActive, true);
});

test('Engineer Forge and protocol controls retain their local skill lists and lookups', () => {
  // Protocol eligibility uses authored identities, so vary two legal options while retaining isolated catalogs.
  const ids = [ENGINEER_ID.OFFENSIVE_PROTOCOL_SHRED_ID_77103, ENGINEER_ID.DEFENSIVE_PROTOCOL_THORNS_ID_77163];
  const catalogs = ids.map((id) =>
    engineerCatalog(
      skill(id, 'Protocol', { forgeSkill: true, specialization: 'Amalgam', categories: ['Morph'], mechanicSlot: 2 })
    )
  );
  assertIsolated(
    bindHolosmithUi,
    catalogs,
    (ui, catalog) => groupIds(ui, { catalog }, 'engineer-forge'),
    ids.map((id) => [id])
  );
  const context = { build: { selectedMorphSkillIds: [ids[0]] } };
  assertIsolated(
    bindAmalgamUi,
    catalogs,
    (ui, catalog) => ui.skillBarGroups({ ...context, catalog })[0].selections[0].optionSkillIds,
    ids.map((id) => [id])
  );
});

test('all Ranger pet palettes use the catalog supplied to their own factory', () => {
  // Commandability requires a pet skill; varying only its autonomous flag isolates each factory's catalog lookup.
  const petState = { petNames: ['Lynx', 'Pig'], activePetSlot: 1 };
  const skillId = rangerPetForState(petState).skillIds.at(-1);
  const catalogs = [false, true].map((petAutonomousSkill) =>
    rangerCatalog(skill(skillId, 'Pet attack', { petSkill: true, petAutonomousSkill }))
  );
  const context = { professionState: { ...petState, beastmodeActive: false } };
  for (const bind of [bindRangerCoreUi, bindDruidUi, bindGaleshotUi, bindSoulbeastUi, bindUntamedUi]) {
    assertIsolated(bind, catalogs, (ui) => groupIds(ui, context, 'ranger-pet').includes(skillId), [true, false]);
  }
});

test('Untamed and Soulbeast derived skill collections remain instance-local', () => {
  const catalogs = [true, false].map((enabled) =>
    rangerCatalog(skill(1, 'Beast attack', { unleashedPetSkill: enabled, beastmodeSkill: enabled }))
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
      guardianCatalog(
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
    const catalogs = [1, 2].map((id) => necromancerCatalog(skill(id, 'Shroud attack', { shroud })));
    assertIsolated(bind, catalogs, (ui) => groupIds(ui, {}, 'shroud'), [[1], [2]]);
  }
});

test('Elementalist family and Core factories receive their own assembled catalog', () => {
  const skills = (icon) => [
    skill(ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Fire, 'Fire Attunement', { icon }),
    skill(ELEMENTALIST_SKILL_IDS.SCORCHING_SHOT, 'Scorching Shot', { icon })
  ];
  // Family controls must work even when Core presentation has never been initialized.
  assertIsolated(
    bindElementalistFamilyUi,
    ['first', 'second'].map((icon) => elementalistCatalog(...skills(icon))),
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
