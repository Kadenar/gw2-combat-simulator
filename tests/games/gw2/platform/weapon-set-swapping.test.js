import assert from 'node:assert/strict';
import test from 'node:test';
import { professionRegistry } from '#gw2/profession-registry.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { ENGINEER_SKILL_IDS } from '#gw2/professions/engineer/data/ids.js';
import { ELEMENTALIST_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { defineProfession } from '#gw2/platform/profession-definition/compile-contract.js';
import { weaponPaletteRows, weaponSkills } from '#gw2/app/rotation/palette/model.js';

const swap = { type: 'cast', skillId: SHARED_SKILL_IDS.SWAP_WEAPONS };
const combat = { type: 'combat-start' };

// A minimal rotation covers both sides of combat entry for every Core/elite contract, without damage calibration.
test('every profession and specialization swaps precombat; the composed capability governs combat swaps', async () => {
  for (const entry of professionRegistry) {
    const profession = await entry.loadProfession();
    for (const module of profession.nativeDefinition.modules) {
      const specialization = module.id;
      const label = `${entry.id}/${specialization}`;
      const allowed = !['elementalist', 'engineer'].includes(entry.id) && specialization !== 'Bladesworn';
      const weapon = profession.createBuildDefaults().weapons[0];
      const config = { specialization, primaryWeapon: weapon, weaponSet2Primary: weapon };
      assert.equal(profession.resolveProfession(config).canSwapWeaponSetsInCombat, allowed, label);
      const result = runGw2Runtime({
        profession: profession.runtimeFor(config),
        config,
        rotation: [swap, swap, swap, combat, swap]
      });
      assert.deepEqual(
        result.steps.filter((step) => step.invalid).map((step) => step.ri),
        allowed ? [] : [4],
        label
      );
      assert.deepEqual(
        result.events.filter((event) => event.type === 'weapon_set').map((event) => event.weaponSet),
        allowed ? [2, 1, 2, 1] : [2, 1, 2],
        label
      );
      assert.equal(result.planningState.activeWeaponSet, allowed ? 1 : 2, label);
      assert.equal(result.planningState.combatActive, true, label);
      assert.equal(result.planningState.availability[swap.skillId].ready, allowed, label);
      assert.equal(result.warnings.length, allowed ? 0 : 1, label);
    }
  }
});

// Implicit combat begins on hostile impact, not the first preparation command.
test('a hostile impact locks restricted swaps while a precombat-only rotation leaves them available', async () => {
  const profession = await professionRegistry.find((entry) => entry.id === 'engineer').loadProfession();
  const config = { specialization: 'Core', primaryWeapon: 'Rifle', weaponSet2Primary: 'Rifle' };
  const prepare = runGw2Runtime({ profession: profession.runtimeFor(config), config, rotation: [swap, swap] });
  assert.deepEqual(prepare.warnings, []);
  assert.equal(prepare.planningState.combatActive, false);
  assert.equal(prepare.planningState.availability[swap.skillId].ready, true);
  const attack = profession.catalog.skillsByName.get('Blunderbuss');
  const result = runGw2Runtime({
    profession: profession.runtimeFor(config),
    config,
    rotation: [swap, { type: 'cast', skillId: attack.id }, swap]
  });
  assert.equal(result.planningState.combatActive, true);
  assert.equal(result.planningState.activeWeaponSet, 2);
  assert.match(result.warnings[0], /cannot swap weapon sets in combat/);
});

test('Engineer swap input stows a kit in either phase without changing equipped sets', async () => {
  const profession = await professionRegistry.find((entry) => entry.id === 'engineer').loadProfession();
  const config = { specialization: 'Core', primaryWeapon: 'Rifle', weaponSet2Primary: 'Rifle' };
  const equip = { type: 'cast', skillId: ENGINEER_SKILL_IDS.GRENADE_KIT };
  for (const start of [[], [combat]]) {
    const result = runGw2Runtime({
      profession: profession.runtimeFor(config),
      config,
      rotation: [...start, equip, swap]
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.activeKit, null);
    assert.equal(result.planningState.activeWeaponSet, 1);
    assert.equal(
      result.events.some((event) => event.type === 'weapon_set'),
      false
    );
    assert.equal(result.steps.at(-1).skillId, ENGINEER_SKILL_IDS.STOW_GRENADE_KIT);
    assert.equal(result.rotationApm.weaponSwapCount, 0);
  }

  const result = runGw2Runtime({
    profession: profession.runtimeFor(config),
    config,
    rotation: [equip, swap, swap, combat]
  });
  assert.equal(result.planningState.activeWeaponSet, 2);
  assert.deepEqual(result.warnings, []);
});

// Bundle exits preserve equipment and remain legal in combat; a subsequent input follows ordinary swap rules.
test('Elementalist swap input drops every conjure before considering an equipped-set change', async () => {
  const profession = await professionRegistry.find((entry) => entry.id === 'elementalist').loadProfession();
  for (const skillId of [
    ELEMENTALIST_SKILL_IDS.CONJURE_FROST_BOW,
    ELEMENTALIST_SKILL_IDS.CONJURE_LIGHTNING_HAMMER,
    ELEMENTALIST_SKILL_IDS.CONJURE_FIERY_GREATSWORD
  ]) {
    for (const startingWeaponSet of [1, 2]) {
      for (const inCombat of [false, true]) {
        const config = {
          specialization: 'Core',
          primaryWeapon: 'Scepter',
          weaponSet2Primary: 'Staff',
          startingWeaponSet
        };
        const prefix = [...(inCombat ? [combat] : []), { type: 'cast', skillId }];
        const simulate = (rotation) => runGw2Runtime({ profession: profession.runtimeFor(config), config, rotation });
        const equipped = simulate(prefix);
        assert.deepEqual(equipped.warnings, []);
        assert.ok(equipped.planningState.profession.conjureEquipped);
        assert.equal(equipped.planningState.availability[swap.skillId].ready, true);
        const dropped = simulate([...prefix, swap]);
        assert.deepEqual(dropped.warnings, []);
        assert.equal(dropped.planningState.profession.conjureEquipped, null);
        assert.equal(dropped.planningState.profession.conjureExpiresAt, 0);
        assert.equal(dropped.planningState.activeWeaponSet, startingWeaponSet);
        assert.equal(dropped.steps.at(-1).skillId, ELEMENTALIST_SKILL_IDS.DROP_BUNDLE);
        assert.equal(
          dropped.events.some((event) => event.type === 'weapon_set'),
          false
        );
        assert.equal(
          dropped.events.filter(
            (event) => event.type === 'sigil_swap' && event.sourceId === ELEMENTALIST_SKILL_IDS.DROP_BUNDLE
          ).length,
          1
        );
        assert.equal(dropped.rotationApm.weaponSwapCount, 0);
        const next = simulate([...prefix, swap, swap]);
        assert.equal(next.planningState.activeWeaponSet, inCombat ? startingWeaponSet : 3 - startingWeaponSet);
        assert.equal(next.warnings.length, inCombat ? 1 : 0);
        if (inCombat) assert.match(next.warnings[0], /cannot swap weapon sets in combat/);
      }
    }
  }

  // Dropping a bundle requires no alternate equipment, unlike a real weapon-set swap.
  const config = { specialization: 'Core', primaryWeapon: 'Scepter' };
  const result = runGw2Runtime({
    profession: profession.runtimeFor(config),
    config,
    rotation: [{ type: 'cast', skillId: ELEMENTALIST_SKILL_IDS.CONJURE_FROST_BOW }, swap]
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.conjureEquipped, null);
  assert.equal(result.planningState.activeWeaponSet, 1);
});

test('combat swap capability rejects malformed definitions', () => {
  assert.throws(
    () => defineProfession({ id: 'fixture', name: 'Fixture', canSwapWeaponSetsInCombat: 'false' }),
    /must be a boolean/
  );
});

// Palette restrictions follow the insertion boundary; isolated equipment enumeration remains independent.
test('restricted palettes expose both sets precombat and only the active set in combat', async () => {
  const adapter = await professionRegistry.find((entry) => entry.id === 'engineer').loadAppAdapter();
  const build = adapter.toApplicationBuild(adapter.profession.createBuildDefaults());
  build.weapons = ['Rifle', ''];
  build.alternateWeapons = ['Pistol', 'Shield'];
  const app = {
    adapter,
    profession: adapter.profession,
    build,
    skills: adapter.profession.catalog.skills,
    weaponData: adapter.weaponData,
    results: {
      rotationEndTime: 0,
      planningState: { atSeconds: 0, combatActive: false, activeWeaponSet: 2, profession: {}, availability: {} }
    }
  };
  assert.deepEqual(
    weaponPaletteRows(app, 2).map((row) => row.weaponSet),
    [1, 2]
  );
  app.results.planningState.combatActive = true;
  assert.deepEqual(
    weaponPaletteRows(app, 2).map((row) => row.weaponSet),
    [2]
  );
  assert.ok(weaponSkills(app, 1).length);
  assert.ok(weaponSkills(app, 2).length);
});

// Precombat permission does not bypass a replacement bar's explicit exit contract.
test('Gunsaber and Photon Forge must exit before changing the underlying equipment', async () => {
  for (const [id, specialization, enter, exit] of [
    ['warrior', 'Bladesworn', 'Unsheathe Gunsaber', 'Sheathe Gunsaber'],
    ['engineer', 'Holosmith', 'Engage Photon Forge', 'Deactivate Photon Forge']
  ]) {
    const profession = await professionRegistry.find((entry) => entry.id === id).loadProfession();
    const config = { specialization, primaryWeapon: 'Rifle', weaponSet2Primary: 'Rifle' };
    const cast = (name) => ({ type: 'cast', skillId: profession.catalog.skillsByName.get(name).id });
    const blocked = runGw2Runtime({ profession: profession.runtimeFor(config), config, rotation: [cast(enter), swap] });
    assert.equal(blocked.planningState.activeWeaponSet, 1, specialization);
    assert.equal(blocked.planningState.availability[swap.skillId].ready, false, specialization);
    assert.match(blocked.warnings.join(' '), /before swapping weapon sets/, specialization);
    const allowed = runGw2Runtime({
      profession: profession.runtimeFor(config),
      config,
      rotation: [cast(enter), cast(exit), swap]
    });
    assert.deepEqual(allowed.warnings, [], specialization);
    assert.equal(allowed.planningState.activeWeaponSet, 2, specialization);
  }
});

test('missing and explicitly empty destinations reject swaps in execution and planning', async () => {
  const profession = await professionRegistry.find((entry) => entry.id === 'guardian').loadProfession();
  for (const startingWeaponSet of [1, 2]) {
    for (const destination of [undefined, '']) {
      const config =
        startingWeaponSet === 1
          ? { primaryWeapon: 'Scepter', weaponSet2Primary: destination, startingWeaponSet }
          : { primaryWeapon: destination, weaponSet2Primary: 'Scepter', startingWeaponSet };
      const result = runGw2Runtime({ profession: profession.runtimeFor(config), config, rotation: [swap] });
      assert.equal(result.planningState.activeWeaponSet, startingWeaponSet);
      assert.equal(result.planningState.availability[swap.skillId].code, 'gw2.weapon-set-empty');
      assert.match(result.warnings.join(' '), /other weapon set is not equipped/);
      assert.equal(
        result.events.some((event) => event.type === 'weapon_set'),
        false
      );
    }
  }
});
