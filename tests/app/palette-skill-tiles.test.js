import assert from 'node:assert/strict';
import test from 'node:test';

import { loadProfession, professionOptions } from '../../js/app/profession/registry.js';
import { displayedSkillTiles } from '../../js/app/rotation/palette/model.js';
import { paletteSkillView } from '../../js/app/rotation/palette/view.js';

function projectionApp(
  profession,
  { specialization = 'Core', professionState = {}, time = 0, cooldowns = {}, useProfessionUi = true } = {}
) {
  const build = profession.createBuildDefaults?.() || {};
  return {
    build: {
      ...build,
      rotation: build.rotation || [],
      startingWeaponSet: build.startingWeaponSet || 1
    },
    adapter: { eliteSpecialization: () => specialization },
    profession: useProfessionUi ? profession : { catalog: profession.catalog, ui: {} },
    activeCatalog: profession.catalog,
    skills: profession.catalog.skills,
    skillById: profession.catalog.skillsById,
    skillByName: profession.catalog.skillsByName,
    results: {
      endState: {
        time: time * 1000,
        activeWeaponSet: 1,
        cooldowns,
        profession: professionState
      }
    }
  };
}

function isReplacementAttack(skill) {
  return Boolean(skill.ambush || (skill.stealthAttack && skill.slot === 'Weapon_1') || skill.unleashedAmbushSkill);
}

function isSequenceLink(parent, child) {
  return (
    (parent.chainRoot != null && child.chainRoot != null && Number(parent.chainRoot) === Number(child.chainRoot)) ||
    (parent.weaponBarChainRootId != null &&
      child.weaponBarChainRootId != null &&
      Number(parent.weaponBarChainRootId) === Number(child.weaponBarChainRootId)) ||
    (parent.nextChainId === child.id && child.nextChainId !== parent.id)
  );
}

// Builds the same catalog-level family inventory that the palette consumes:
// explicit flip links plus reciprocal next-skill pairs, excluding replacements.
function catalogFlipFamilies(catalog) {
  const neighborsBySkillId = new Map();
  const order = new Map(catalog.skills.map((skill, index) => [Number(skill.id), index]));
  const register = (parent, child) => {
    if (
      !parent ||
      !child ||
      parent.paletteFlip === false ||
      child.paletteFlip === false ||
      (child.simulatorExcluded && child.type === 'Weapon') ||
      isReplacementAttack(child) ||
      isSequenceLink(parent, child)
    ) {
      return;
    }

    const parentId = Number(parent.id);
    const childId = Number(child.id);
    neighborsBySkillId.set(parentId, new Set([...(neighborsBySkillId.get(parentId) || []), childId]));
    neighborsBySkillId.set(childId, new Set([...(neighborsBySkillId.get(childId) || []), parentId]));
  };

  for (const child of catalog.skills) {
    if (child.flipParentId != null) register(catalog.skillsById.get(Number(child.flipParentId)), child);
  }

  for (const parent of catalog.skills) {
    if (parent.flipSkillId != null && parent.flipSkillId !== parent.nextChainId) {
      register(parent, catalog.skillsById.get(Number(parent.flipSkillId)));
    }
  }

  for (const skill of catalog.skills) {
    if (skill.nextChainId == null) continue;
    const linked = catalog.skillsById.get(Number(skill.nextChainId));

    if (!linked || linked.nextChainId !== skill.id) continue;

    if ((order.get(Number(skill.id)) || 0) > (order.get(Number(linked.id)) || 0)) continue;
    register(skill, linked);
  }

  const visited = new Set();
  const families = [];
  for (const skill of catalog.skills) {
    const startId = Number(skill.id);

    if (visited.has(startId) || !neighborsBySkillId.has(startId)) continue;
    const pending = [startId];
    const memberIds = [];
    while (pending.length) {
      const id = pending.pop();

      if (visited.has(id)) continue;
      visited.add(id);
      memberIds.push(id);
      for (const neighbor of neighborsBySkillId.get(id) || []) {
        if (!visited.has(neighbor)) pending.push(neighbor);
      }
    }

    memberIds.sort((left, right) => order.get(left) - order.get(right));
    families.push(memberIds.map((id) => catalog.skillsById.get(id)));
  }

  return families;
}

test('shared flip families preserve every branch from a root-only caller', () => {
  const root = { id: 1, name: 'Root', flipSkillId: 2 };
  const left = { id: 2, name: 'Left', flipParentId: 1 };
  const right = { id: 3, name: 'Right', flipParentId: 1 };
  const skills = [root, left, right];
  const catalog = {
    skills,
    skillsById: new Map(skills.map((skill) => [skill.id, skill])),
    skillsByName: new Map(skills.map((skill) => [skill.name, skill]))
  };
  const app = {
    build: { rotation: [], startingWeaponSet: 1 },
    adapter: { eliteSpecialization: () => 'Core' },
    profession: { catalog, ui: {} },
    activeCatalog: catalog,
    skills,
    results: {
      endState: {
        time: 0,
        activeWeaponSet: 1,
        cooldowns: {},
        profession: { availableFlips: { 3: true } }
      }
    }
  };

  assert.deepEqual(
    displayedSkillTiles(app, [root]).map((skill) => skill.name),
    ['Right']
  );
});

test('every profession catalog autoattack and flip family uses the shared tile projector', async () => {
  let autoattackFamilyCount = 0;
  let flipFamilyCount = 0;

  for (const option of professionOptions) {
    const profession = await loadProfession(option.id);
    const baseApp = projectionApp(profession, { useProfessionUi: false });

    for (const chain of profession.catalog.autoattackChains) {
      const skills = chain.map((skillId) => profession.catalog.skillsById.get(skillId));
      assert.equal(displayedSkillTiles(baseApp, skills)[0].id, chain[0], `${option.id}: ${skills[0].name}`);
      for (const skill of skills) {
        const app = projectionApp(profession, {
          professionState: { autoattackChains: { [chain[0]]: skill.id } },
          useProfessionUi: false
        });
        assert.deepEqual(
          displayedSkillTiles(app, skills).map((candidate) => candidate.id),
          [skill.id],
          `${option.id}: ${skills[0].name} -> ${skill.name}`
        );
      }

      autoattackFamilyCount += 1;
    }

    for (const family of catalogFlipFamilies(profession.catalog)) {
      const [root, ...descendants] = family;
      assert.deepEqual(
        displayedSkillTiles(baseApp, [root]).map((skill) => skill.id),
        [root.id],
        `${option.id}: ${root.name}`
      );
      for (const descendant of descendants) {
        const app = projectionApp(profession, {
          professionState: { availableFlips: { [descendant.id]: true } },
          useProfessionUi: false
        });
        assert.deepEqual(
          displayedSkillTiles(app, [root]).map((skill) => skill.id),
          [descendant.id],
          `${option.id}: ${root.name} -> ${descendant.name}`
        );
      }

      flipFamilyCount += 1;
    }
  }

  assert.ok(autoattackFamilyCount > 0);
  assert.ok(flipFamilyCount > 0);
});

test('UI-only tile declarations collapse through the same profession-neutral hook', async () => {
  let declaredFamilyCount = 0;

  for (const option of professionOptions) {
    const profession = await loadProfession(option.id);
    const families = new Map();
    for (const skill of profession.catalog.skills.filter((candidate) => candidate.paletteTileId != null)) {
      const tileId = String(skill.paletteTileId);
      families.set(tileId, [...(families.get(tileId) || []), skill]);
    }

    for (const [tileId, family] of families) {
      assert.ok(family.length > 1, `${option.id}: ${tileId}`);
      assert.equal(
        displayedSkillTiles(projectionApp(profession, { useProfessionUi: false }), family).length,
        1,
        `${option.id}: ${tileId}`
      );
      declaredFamilyCount += 1;
    }
  }

  assert.ok(declaredFamilyCount > 0);
});

test('stateful transforms select one live tile across professions', async () => {
  const professions = new Map(
    await Promise.all(professionOptions.map(async (option) => [option.id, await loadProfession(option.id)]))
  );
  const cases = [
    ['necromancer', 'Core', { activeShroud: '' }, ['Death Shroud', 'End Death Shroud'], 'Death Shroud'],
    ['necromancer', 'Core', { activeShroud: 'death' }, ['Death Shroud', 'End Death Shroud'], 'End Death Shroud'],
    [
      'warrior',
      'Bladesworn',
      { gunsaberActive: false },
      ['Unsheathe Gunsaber', 'Sheathe Gunsaber'],
      'Unsheathe Gunsaber'
    ],
    ['warrior', 'Bladesworn', { gunsaberActive: true }, ['Unsheathe Gunsaber', 'Sheathe Gunsaber'], 'Sheathe Gunsaber'],
    [
      'engineer',
      'Holosmith',
      { photonForgeActive: false },
      ['Engage Photon Forge', 'Deactivate Photon Forge'],
      'Engage Photon Forge'
    ],
    [
      'engineer',
      'Holosmith',
      { photonForgeActive: true },
      ['Engage Photon Forge', 'Deactivate Photon Forge'],
      'Deactivate Photon Forge'
    ],
    ['engineer', 'Mechanist', { mech: { active: false } }, ['Crash Down'], 'Crash Down'],
    ['engineer', 'Mechanist', { mech: { active: true } }, ['Crash Down'], 'Recall Mech'],
    [
      'thief',
      'Specter',
      { shadowForce: 100, shadowShroudActive: false },
      ['Enter Shadow Shroud'],
      'Enter Shadow Shroud'
    ],
    ['thief', 'Specter', { shadowForce: 100, shadowShroudActive: true }, ['Enter Shadow Shroud'], 'Exit Shadow Shroud'],
    ['ranger', 'Druid', { astralForce: 100, celestialAvatarActive: false }, ['Celestial Avatar'], 'Celestial Avatar'],
    [
      'ranger',
      'Druid',
      { astralForce: 100, celestialAvatarActive: true },
      ['Celestial Avatar'],
      'Release Celestial Avatar'
    ],
    ['ranger', 'Untamed', { rangerUnleashed: false }, ['Unleash Ranger'], 'Unleash Ranger'],
    ['ranger', 'Untamed', { rangerUnleashed: true }, ['Unleash Ranger'], 'Unleash Pet'],
    ['ranger', 'Soulbeast', { beastmodeActive: false }, ['Beastmode'], 'Beastmode'],
    ['ranger', 'Soulbeast', { beastmodeActive: true }, ['Beastmode'], 'Leave Beastmode'],
    ['ranger', 'Galeshot', { cycloneBowActive: false }, ['Summon Cyclone Bow'], 'Summon Cyclone Bow'],
    ['ranger', 'Galeshot', { cycloneBowActive: true }, ['Summon Cyclone Bow'], 'Dismiss Cyclone Bow'],
    ['elementalist', 'Core', { primaryAttunement: 'Earth', rockBarrierExpiresAt: 0 }, ['Rock Barrier'], 'Rock Barrier'],
    ['elementalist', 'Core', { primaryAttunement: 'Earth', rockBarrierExpiresAt: 30 }, ['Rock Barrier'], 'Hurl'],
    ['elementalist', 'Core', { primaryAttunement: 'Earth', activeAuras: [] }, ['Magnetic Aura'], 'Magnetic Aura'],
    [
      'elementalist',
      'Core',
      { primaryAttunement: 'Earth', activeAuras: [{ type: 'Magnetic Aura', expiresAt: 30 }] },
      ['Magnetic Aura'],
      'Transmute Earth'
    ],
    ['elementalist', 'Weaver', { perfectWeaveUntil: 0 }, ['Weave Self'], 'Weave Self'],
    ['elementalist', 'Weaver', { perfectWeaveUntil: 30 }, ['Weave Self'], 'Tailored Victory']
  ];

  for (const [professionId, specialization, state, names, expected] of cases) {
    const profession = professions.get(professionId);
    const skills = names.map((name) => profession.catalog.skillsByName.get(name));
    assert.deepEqual(
      displayedSkillTiles(projectionApp(profession, { specialization, professionState: state }), skills).map(
        (skill) => skill.name
      ),
      [expected],
      `${professionId}: ${expected}`
    );
  }
});

test('Rock Barrier tile shows the root cooldown after Hurl consumes the flip', async () => {
  const profession = await loadProfession('elementalist');
  const app = projectionApp(profession, {
    specialization: 'Core',
    professionState: { rockBarrierExpiresAt: 0 },
    time: 1,
    cooldowns: {
      'Rock Barrier': { remaining: 8000, readyAt: 9000 }
    }
  });
  const [skill] = displayedSkillTiles(app, [profession.catalog.skillsByName.get('Rock Barrier')]);
  const view = paletteSkillView(app, skill, true);

  assert.equal(skill.name, 'Rock Barrier');
  assert.equal(view.cooldownLabel, '8.0s');
  assert.equal(view.disabled, true);
});

test('Holosmith Photon Forge autos are catalog autoattack chains', async () => {
  const profession = await loadProfession('engineer');
  const names = profession.catalog.autoattackChains.map((chain) =>
    chain.map((skillId) => profession.catalog.skillsById.get(skillId).name)
  );

  assert.ok(names.some((chain) => chain.join('|') === 'Light Strike|Bright Slash|Flash Cutter'));
  assert.ok(names.some((chain) => chain.join('|') === 'Light Strike—Storm|Bright Slash—Storm|Flash Cutter—Storm'));
});

test('Herald legend-dependent True Nature variants use one shared Facet tile', async () => {
  const profession = await loadProfession('revenant');
  const project = (availableFlips) => {
    const professionState = {
      activeLegendId: 'LegendaryAssassin',
      availableFlips
    };
    const app = projectionApp(profession, {
      specialization: 'Herald',
      professionState
    });
    const group = profession.ui
      .paletteGroups({
        specialization: 'Herald',
        professionState,
        build: app.build,
        catalog: profession.catalog
      })
      .find((candidate) => candidate.id === 'revenant-profession');

    return displayedSkillTiles(
      app,
      group.skillIds.map((skillId) => profession.catalog.skillsById.get(skillId))
    ).map((skill) => skill.name);
  };

  assert.deepEqual(project({}), ['Facet of Nature']);
  assert.deepEqual(project({ 51667: true }), ['True Nature']);
});
