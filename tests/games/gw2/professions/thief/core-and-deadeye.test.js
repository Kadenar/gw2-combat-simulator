import { planningFixture } from '#tests/helpers/observed-runtime.js';
import { daredevilModule } from '#gw2/professions/thief/specializations/daredevil/module.js';
import { armSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { assumptionControlsForSpecialization } from '#gw2/platform/builds/assumptions.js';
import { weaponPaletteRows } from '#gw2/app/rotation/palette/model.js';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { resourceDisplayViews } from '#gw2/app/rotation/palette/resource-view.js';
import { createThiefBuildDefaults, migrateThiefBuild, validateThiefBuild } from '#gw2/professions/thief/build/build.js';
import { thiefCatalog, thiefProfession } from '#gw2/professions/thief/profession.js';
import { thiefWeaponSkillMatchesSet } from '#gw2/professions/thief/build/weapon-matching.js';
import { THIEF_SUPPLEMENTAL_SKILLS } from '#gw2/professions/thief/data/thief-supplemental-skills.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

import { thiefAppAdapter } from '#gw2/professions/thief/app/app-definition.js';

import { THIEF_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/thief/core/profiles.js';
import { DEADEYE_BALANCE_PROFILE_IDS } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { deadeyeCastAvailability } from '#gw2/professions/thief/specializations/deadeye/mechanics/availability.js';
import { SPECTER_BALANCE_PROFILE_IDS } from '#gw2/professions/thief/specializations/specter/profiles.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { DEADEYE_STOLEN_SKILL_IDS } from '#gw2/professions/thief/specializations/deadeye/mechanics/stolen-skills.js';
import { storeThiefStolenSkillChoices } from '#gw2/professions/thief/core/mechanics/steal.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { deadeyeCastCompleted } from '#gw2/professions/thief/specializations/deadeye/mechanics/boundaries.js';
import { antiquaryHooks } from '#gw2/professions/thief/specializations/antiquary/hooks.js';
import { thiefBonusStealthAttack } from '#gw2/professions/thief/core/mechanics/stealth.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';

const baseConfig = Object.freeze({
  selectedSkillIds: [13027, 13046, 41158, 46335, 13082],
  initialInitiative: 12,
  initialShadowForce: 0,
  primaryWeapon: 'Dagger',
  secondaryWeapon: 'Dagger',
  weaponSet2Primary: 'Pistol',
  weaponSet2Secondary: 'Pistol',
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  },
  target: {
    armor: 2597,
    defiant: true,
    conditions: { Vulnerability: 25 }
  }
});

const simulate = createObservedProfessionSimulator(thiefProfession, baseConfig);

const applyThiefPatch = (patch) => applyBalanceProfilePatch(applySkillPatch(thiefCatalog, patch), patch);

const authoringThiefProfession = withActivePatchPreview(thiefProfession);

test('Thief weapon matching keeps hand requirements behind profession variant gates', () => {
  // Minimal equipment cases cover shared matching; stance and specialization still reject otherwise valid hands.
  const context = { catalog: thiefCatalog, specialization: 'Core' };
  for (const [fields, hands, expected] of [
    [{}, ['Dagger', 'Dagger'], false],
    [{ weapon: 'Dagger', slot: 'Weapon_2' }, ['Dagger', 'Pistol'], true],
    [{ weapon: 'Pistol', slot: 'Weapon_4' }, ['Dagger', 'Pistol'], true],
    [{ weapon: 'Pistol', slot: 'Weapon_4' }, ['Pistol', 'Dagger'], false],
    [{ weapon: 'Shortbow', slot: 'Weapon_5' }, ['Shortbow', ''], true],
    [{ requiredMainHand: 'Dagger', requiredOffHand: 'Pistol' }, ['Dagger', 'Pistol'], true],
    [{ requiredMainHand: 'Dagger', requiredOffHand: 'Pistol' }, ['Dagger', 'Dagger'], false],
    [{ requiredMainHand: 'Dagger', requiredOffHand: false }, ['Dagger', ''], true],
    [{ requiredMainHand: 'Dagger', requiredOffHand: false }, ['Dagger', 'Pistol'], false],
    [{ requiredMainHand: 'Dagger', stealthAttack: true, malicious: true }, ['Dagger', ''], false]
  ]) {
    assert.equal(thiefWeaponSkillMatchesSet({ id: -1, type: 'Weapon', ...fields }, hands, context), expected);
  }

  const rifle = { id: -1, type: 'Weapon', weapon: 'Rifle', slot: 'Weapon_2', kneelSkill: true };
  for (const kneeling of [false, true]) {
    assert.equal(
      thiefWeaponSkillMatchesSet(rifle, ['Rifle', ''], { ...context, professionState: { kneeling } }),
      kneeling
    );
  }

  const spear = thiefCatalog.skillsById.get(ID.ENTANGLING_ASP);
  assert.equal(thiefWeaponSkillMatchesSet(spear, ['Spear', ''], context), true);
  for (const spearChainStage of [0, 1]) {
    const projected = { ...context, professionState: { spearChainStage } };
    assert.equal(thiefWeaponSkillMatchesSet(spear, ['Spear', ''], projected), spearChainStage === 1);
    assert.equal(thiefWeaponSkillMatchesSet(spear, ['Spear', ''], { ...projected, weaponBarPreview: true }), true);
  }
});

test('bonus stealth attacks consume only active elite charges and prefer ordinary stealth', () => {
  // A grant misplaced on Core cannot unlock attacks or absorb active-elite consumption.
  for (const specialization of ['Core', 'Daredevil', 'Deadeye', 'Specter', 'Antiquary']) {
    for (const stealthed of [false, true]) {
      for (const expiresAt of [5, 6]) {
        const ownsCharges = specialization === 'Deadeye' || specialization === 'Antiquary';
        const attack = specialization === 'Deadeye' ? 'Malicious Backstab' : 'Backstab';
        const result = runThief(
          [{ type: 'wait', durationMs: 5000 }, attack],
          { ...baseConfig, specialization },
          {
            initialize(runtime) {
              const { core, specialization: elite } = runtime.profession;
              assert.equal(Object.hasOwn(core, 'bonusStealthAttack'), false);
              Object.assign(core, {
                bonusStealthAttack: { charges: 99, expiresAt: 100 },
                stealthStartedAt: 0,
                stealthUntil: stealthed ? 6 : 0
              });
              if (ownsCharges) Object.assign(elite.state, { bonusStealthAttack: { charges: 2, expiresAt } });
            }
          }
        );
        const available = stealthed || (ownsCharges && expiresAt > 5);
        assert.equal(result.warnings.length === 0, available, `${specialization} ${stealthed} ${expiresAt}`);
        const { core, specialization: elite } = observedRuntime(result).profession;
        if (available) {
          assert.equal(core.stealthUntil, 5);
          assert.equal(core.revealedUntil, 8);
        }

        assert.equal(core.bonusStealthAttack.charges, 99);
        assert.equal(core.bonusStealthAttack.expiresAt, 100);
        assert.equal(
          elite.state.bonusStealthAttack?.charges,
          ownsCharges ? (!stealthed && available ? 1 : 2) : undefined
        );
        if (ownsCharges) {
          const projected = result.planningState.profession.bonusStealthAttack;
          assert.deepEqual(projected, elite.state.bonusStealthAttack);
          projected.charges = 99;
          assert.notEqual(elite.state.bonusStealthAttack.charges, 99, 'planning grants are detached');
        }
      }
    }
  }
});

// Both owners replace their own grant using selected tuning; availability and palette reads leave it intact.
test('Silent Scope and Guitar replace bonus stealth attacks with selected counts and lifetimes', () => {
  for (const specialization of ['Deadeye', 'Antiquary']) {
    const deadeye = specialization === 'Deadeye';
    const profile = deadeye ? TRAIT.SILENT_SCOPE : ANTIQUARY_BALANCE_PROFILE_IDS.artifactWindows;
    const patched = withPatchPreview(thiefProfession, {
      id: 'bonus-stealth-test',
      label: 'Bonus stealth test',
      professions: {
        thief: {
          balanceProfiles: {
            [profile]: { fields: deadeye ? { durationMultiplier: 7 } : { durationMultiplier: 7, resourceGain: 3 } }
          }
        }
      }
    });
    const result = runThief(
      [],
      {
        ...baseConfig,
        specialization,
        selectedTraitIds: [TRAIT.SILENT_SCOPE],
        patchId: 'bonus-stealth-test'
      },
      { profession: patched }
    );
    const runtime = observedRuntime(result);
    const state = runtime.profession.specialization.state;
    const context = runtime.mechanics;
    const grant = () => {
      if (deadeye) {
        state.malice.value = 5;
        context.fireTrigger(deadeyeCastCompleted, {
          cast: { skill: runtime.helpers.skillsById.get(SHARED_SKILL_IDS.DODGE) }
        });
      } else antiquaryHooks.sideEffectHandlers['thief.guitar'](context);
    };

    runtime.time = 1;
    grant();
    const first = state.bonusStealthAttack;
    assert.equal(first.charges, deadeye ? 1 : 3);
    assert.equal(first.expiresAt, 8);
    runtime.time = 2;
    grant();
    assert.notEqual(state.bonusStealthAttack, first);
    assert.equal(state.bonusStealthAttack.charges, deadeye ? 1 : 3);
    assert.equal(state.bonusStealthAttack.expiresAt, 9);
    const before = structuredClone(state.bonusStealthAttack);
    for (const at of [8, 9, 10]) {
      assert.equal(thiefBonusStealthAttack(context, at), at < 9);
      const skill = runtime.helpers.skillsByName.get(deadeye ? 'Malicious Backstab' : 'Backstab');
      assert.equal(
        thiefProfession.ui.paletteOverride(
          {
            specialization,
            time: at,
            professionState: { bonusStealthAttack: state.bonusStealthAttack }
          },
          skill
        ).tileActive,
        at < 9
      );
    }

    assert.deepEqual(state.bonusStealthAttack, before);
  }
});

test('Endurance Thief is Daredevil-owned and grants its patched endurance with Core steal resources', () => {
  // Only Daredevil composes the trait; a completed Steal grants Kleptomaniac initiative and the patched endurance.
  for (const specialization of ['Core', 'Daredevil', 'Deadeye', 'Specter', 'Antiquary'])
    assert.equal(
      thiefProfession.runtimeFor({ specialization }).catalog.balanceProfilesById.has(TRAIT.ENDURANCE_THIEF),
      specialization === 'Daredevil'
    );
  for (const specialization of ['Core', 'Daredevil']) {
    for (const selected of [false, true]) {
      const active = specialization === 'Daredevil';
      const result = runThief(
        ['Steal'],
        {
          ...baseConfig,
          specialization,
          initialInitiative: 3,
          initialEndurance: 10,
          selectedTraitIds: [TRAIT.KLEPTOMANIAC, ...(selected ? [TRAIT.ENDURANCE_THIEF] : [])]
        },
        {
          catalog: (catalog) =>
            active
              ? applyBalanceProfilePatch(catalog, {
                  balanceProfiles: {
                    [TRAIT.ENDURANCE_THIEF]: { fields: { resourceGain: { from: 50, to: 37 } } }
                  }
                })
              : catalog
        }
      );
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      assert.equal(runtime.resourceController.value('initiative'), 5);
      assert.equal(runtime.profession.core.endurance.value, active && selected ? 47 : 10);
      assert.equal(runtime.profession.core.storedStolenSkillCount, 1);
    }
  }
});

// The live runtime and palette must agree on the Shadow Swap flip's lifetime.
test('Deadeye live runtime and palette enforce the same flip expiry boundary', () => {
  const swap = thiefCatalog.skillsById.get(ID.SHADOW_SWAP);
  const flare = thiefCatalog.skillsById.get(ID.SHADOW_FLARE);
  for (const expiresAt of [undefined, 4, 5, 6]) {
    const core = { availableFlips: expiresAt == null ? {} : { [ID.SHADOW_SWAP]: armSkillFlip({}, 0, 0, expiresAt) } };
    const result = deadeyeCastAvailability(core.availableFlips, swap, 5);
    assert.equal(result.ready, expiresAt > 5);
    if (!result.ready) {
      assert.equal(result.code, 'thief.shadow-flare');
      assert.equal(result.retryAt, null);
    }

    assert.equal(deadeyeCastAvailability(core.availableFlips, flare, 5).ready, true);
  }
});

test('Thief catalog retains valid effect schemas and skill metadata', () => {
  assert.equal(thiefCatalog.skillsByName.get("Death's Advance").id, 40436);
  assert.equal(thiefCatalog.skillsByName.get('Canach-Coin Toss').id, 77230);
  assert.equal(thiefCatalog.skillsByName.get('Death Blossom').initiativeCost, 4);

  // Thief strike timelines stay explicit unless every hit shares one timestamp.
  for (const skill of thiefCatalog.skills) {
    for (const effect of skill.effects || []) {
      if (effect.type === 'strike') {
        if (effect.ticks) {
          for (const field of ['coefficient', 'hits', 'atMs', 'intervalMs']) {
            assert.equal(field in effect, false, `${skill.name}: ${field}`);
          }
        } else {
          assert.ok(Number(effect.coefficient) >= 0, skill.name);
          assert.ok(Number.isInteger(effect.hits) && effect.hits > 0, skill.name);
          if (effect.hits > 1) assert.ok(Number.isFinite(effect.atMs), skill.name);
        }
      } else if (effect.type === 'condition') {
        // Single impacts carry their payload directly; repeated applications retain explicit timelines.
        for (const packet of effect.ticks ?? [effect]) {
          assert.ok(packet.condition, skill.name);
          assert.ok(packet.stacks > 0 && packet.duration > 0, skill.name);
          assert.ok(packet.atMs == null || Number.isFinite(packet.atMs), skill.name);
        }
      }
    }
  }

  assert.ok(
    THIEF_SUPPLEMENTAL_SKILLS.every(
      (skill) =>
        !Object.hasOwn(skill, 'effects') && !Object.hasOwn(skill, 'cooldown') && !Object.hasOwn(skill, 'recharge')
    )
  );
  assert.match(thiefCatalog.skillsById.get(41068).icon, /Special:Redirect\/file\/Free_Action\.png$/);
  assert.ok(
    thiefCatalog.skills
      .filter((skill) => skill.type === 'Weapon')
      .every((skill) => Number.isFinite(Number(skill.initiativeCost)))
  );
  assert.ok(
    thiefCatalog.skills
      .filter((skill) => skill.artifactKind)
      .every((skill) => skill.type === 'Profession' && skill.slot === 'Profession_2')
  );
});

// Grouped payloads retain their effect indices so patches can target one packet without changing its neighbors.
test('Thief shared impacts remain independently patchable beside separate strike timelines', () => {
  const original = thiefCatalog.skillsById.get(ID.SHADOW_STRIKE);
  const baseline = structuredClone(original);
  const preview = applySkillPatch(thiefCatalog, {
    skills: {
      [ID.SHADOW_STRIKE]: {
        effects: [
          { effectIndex: 1, coefficient: 2 },
          { effectIndex: 2, duration: 8 }
        ]
      }
    }
  });
  const patched = preview.skillsById.get(ID.SHADOW_STRIKE);
  assert.deepEqual(patched.effects[0], original.effects[0]);
  assert.deepEqual(patched.effects[1], { ...original.effects[1], coefficient: 2 });
  assert.deepEqual(patched.effects[2], { ...original.effects[2], duration: 8 });
  assert.deepEqual(original, baseline);
});

test('Thief modules expose isolated balance-profile authoring', () => {
  const modules = new Map(authoringThiefProfession.patchAuthoring.modules.map((module) => [module.id, module]));

  assert.deepEqual([...modules.keys()], ['Core', 'Daredevil', 'Deadeye', 'Specter', 'Antiquary']);
  assert.equal(
    [...modules.values()].every((module) => module.balanceProfiles.length > 0),
    true
  );

  const opaqueModifierRules = [...modules.values()].flatMap((module) =>
    module.modifierRules.filter(
      (rule) =>
        (typeof rule.amount === 'function' || typeof rule.factor === 'function') &&
        Object.keys(rule.parameters).length === 0
    )
  );

  assert.deepEqual(opaqueModifierRules, []);

  // Patch isolation compares against the loaded baseline rather than a second copy of live balance data.
  const originalEffects = structuredClone(thiefCatalog.skillsById.get(ID.CALTROPS).effects);
  const originalMaximum = thiefCatalog.balanceProfilesById.get(THIEF_CORE_BALANCE_PROFILE_IDS.resources).maximumStacks;
  const preview = applyThiefPatch({
    skills: {
      [ID.CALTROPS]: {
        effects: [{ effectIndex: 0, tickIndex: 'all', duration: 12 }]
      }
    },
    balanceProfiles: {
      [THIEF_CORE_BALANCE_PROFILE_IDS.resources]: {
        fields: { maximumStacks: 13 }
      },
      [TRAIT.LOTUS_TRAINING]: {
        effects: [{ effectIndex: 0, tickIndex: 'all', coefficient: 0.2 }]
      },
      [DEADEYE_BALANCE_PROFILE_IDS.resources]: {
        fields: { maximumStacks: 6 }
      },
      [SPECTER_BALANCE_PROFILE_IDS.resources]: {
        fields: { resourceGain: 1.25 }
      },
      [ANTIQUARY_BALANCE_PROFILE_IDS.scuffle]: {
        fields: { pulseInterval: 2.5 }
      }
    }
  });

  assert.ok(preview.skillsById.get(ID.CALTROPS).effects[0].ticks.every((tick) => tick.duration === 12));
  assert.equal(preview.balanceProfilesById.get(THIEF_CORE_BALANCE_PROFILE_IDS.resources).maximumStacks, 13);
  assert.deepEqual(
    preview.balanceProfilesById.get(TRAIT.LOTUS_TRAINING).effects[0].ticks.map((tick) => tick.coefficient),
    thiefCatalog.balanceProfilesById.get(TRAIT.LOTUS_TRAINING).effects[0].ticks.map(() => 0.2)
  );
  assert.equal(preview.balanceProfilesById.get(DEADEYE_BALANCE_PROFILE_IDS.resources).maximumStacks, 6);
  assert.equal(preview.balanceProfilesById.get(SPECTER_BALANCE_PROFILE_IDS.resources).resourceGain, 1.25);
  assert.equal(preview.balanceProfilesById.get(ANTIQUARY_BALANCE_PROFILE_IDS.scuffle).pulseInterval, 2.5);

  assert.deepEqual(thiefCatalog.skillsById.get(ID.CALTROPS).effects, originalEffects);
  assert.equal(
    thiefCatalog.balanceProfilesById.get(THIEF_CORE_BALANCE_PROFILE_IDS.resources).maximumStacks,
    originalMaximum
  );
});

test('Thief defaults migrate deterministic assumptions and validate bars', () => {
  const defaults = createThiefBuildDefaults();

  assert.deepEqual(validateThiefBuild(defaults), {
    valid: true,
    errors: []
  });
  const migrated = migrateThiefBuild({
    ...defaults,
    assumptions: {
      ...defaults.assumptions,
      markedTargetChoice: 'unmarked',
      playerHealthPercent: 20,
      targetDistance: 1200,
      artifactDrawSequence: 'reverse',
      doubleEdgeOutcomeSequence: 'success',
      stolenSkillChoice: 'throw-gunk',
      deadeyeStolenSkillChoice: 'steal-time'
    }
  });

  assert.equal(Object.hasOwn(migrated.assumptions, 'playerHealthPercent'), false);
  assert.equal(Object.hasOwn(migrated.assumptions, 'targetDistance'), false);
  assert.equal(
    thiefProfession.ui.assumptionControls.some((control) => control.key === 'markedTargetChoice'),
    false
  );
  const keysFor = (specialization) =>
    new Set(
      assumptionControlsForSpecialization(thiefProfession.ui.assumptionControls, specialization).map(
        (control) => control.key
      )
    );

  for (const specialization of ['Core', 'Daredevil', 'Deadeye', 'Specter', 'Antiquary']) {
    assert.equal(keysFor(specialization).has('stolenSkillChoice'), false);
    assert.equal(keysFor(specialization).has('deadeyeStolenSkillChoice'), false);
  }

  for (const specialization of ['Core', 'Daredevil', 'Deadeye', 'Specter', 'Antiquary']) {
    assert.equal(keysFor(specialization).has('playerHealthPercent'), false);
    assert.equal(keysFor(specialization).has('targetDistance'), false);
  }

  assert.equal(
    validateThiefBuild({
      ...defaults,
      weapons: ['Sword', 'Sword']
    }).valid,
    false
  );
});

test('Thief cooldown resets survive build migration and validation', () => {
  const defaults = createThiefBuildDefaults();
  const migrated = migrateThiefBuild({ ...defaults, rotation: ['__cooldown_reset'] });

  assert.deepEqual(migrated.rotation, [{ type: 'cooldown-reset' }]);
  assert.deepEqual(validateThiefBuild(migrated), { valid: true, errors: [] });
  assert.equal(
    validateThiefBuild({
      ...migrated,
      rotation: [{ type: 'cooldown-reset', interruptAfterMs: 1 }]
    }).valid,
    false
  );
});

test('Thief resources use profession-specific initiative and malice pips', () => {
  const resourceViews = (specialization, config = {}) =>
    thiefProfession.ui.resourceViews({
      specialization,
      config: { specialization, ...config },
      // The palette renders an initialized planning state, whose pools start at their selected capacity.
      professionState: runThief([], { ...baseConfig, specialization, ...config }).planningState.profession
    });

  const coreInitiative = resourceViews('Core')[0];

  assert.equal(coreInitiative.displayMode, 'pips');
  assert.equal(coreInitiative.pipStyle, 'thief-initiative');
  assert.equal(coreInitiative.pipRows, 2);
  assert.equal(coreInitiative.maximum, 12);

  const preparedInitiative = resourceViews('Core', {
    selectedTraitIds: [TRAIT.PREPAREDNESS]
  })[0];

  assert.equal(preparedInitiative.maximum, 15);
  assert.equal(preparedInitiative.pipRows, 2);

  const antiquaryInitiative = resourceViews('Antiquary')[0];

  assert.equal(antiquaryInitiative.pipStyle, 'thief-initiative');
  assert.equal(antiquaryInitiative.pipRows, 3);

  const projectedAntiquaryState = simulate('Antiquary', []).planningState.profession;
  const projectedAntiquaryInitiative = resourceDisplayViews(thiefProfession, {
    specialization: 'Antiquary',
    professionState: projectedAntiquaryState
  })[0];

  assert.equal(projectedAntiquaryInitiative.pipRows, 3);

  const deadeyeMalice = resourceViews('Deadeye').find((view) => view.id === 'malice');

  assert.equal(deadeyeMalice.displayMode, 'pips');
  assert.equal(deadeyeMalice.pipStyle, 'thief-malice');

  const coreEndurance = resourceViews('Core').find((view) => view.id === 'endurance');

  assert.equal(coreEndurance.maximum, 100);
  assert.equal(coreEndurance.value, 100);
  assert.equal(coreEndurance.displayMode, 'bar');
  assert.equal(coreEndurance.pipStyle, 'endurance');
  assert.equal(coreEndurance.canStart, false);

  const daredevilEndurance = resourceViews('Daredevil').find((view) => view.id === 'endurance');

  assert.equal(daredevilEndurance.maximum, 150);
  assert.equal(daredevilEndurance.value, 150);

  const displayedInitiative = resourceDisplayViews(thiefProfession, {
    specialization: 'Core',
    professionState: {
      initiative: { value: 4.9, maximum: 12, updatedAt: 0, rate: 1 }
    }
  })[0];

  assert.equal(displayedInitiative.value, 4);
});

test('Thief Dodge waits for endurance and Vigor accelerates the queue', () => {
  const withoutVigor = simulate('Core', ['Dodge', 'Dodge', 'Dodge'], {
    boons: { vigor: false }
  });
  const withVigor = simulate('Core', ['Dodge', 'Dodge', 'Dodge'], {
    boons: { vigor: true }
  });

  assert.deepEqual(withoutVigor.warnings, []);
  assert.deepEqual(
    withoutVigor.steps.map((step) => step.start),
    [0, 800, 10000]
  );
  assert.deepEqual(withVigor.warnings, []);
  assert.deepEqual(
    withVigor.steps.map((step) => step.start),
    [0, 800, 6680]
  );
});

test('every legal one-hand combination resolves one exact opening slot 3', () => {
  const expected = new Map([
    ['Dagger/Dagger', 'Death Blossom'],
    ['Dagger/Pistol', 'Shadow Shot'],
    ['Dagger/', 'Twisting Fangs'],
    ['Pistol/Dagger', 'Shadow Strike'],
    ['Pistol/Pistol', 'Unload'],
    ['Pistol/', 'Repeater'],
    ['Sword/Dagger', 'Flanking Strike'],
    ['Sword/Pistol', 'Flawless Execution'],
    ['Sword/', 'Stab'],
    ['Scepter/Dagger', 'Twilight Combo'],
    ['Scepter/Pistol', 'Measured Shot'],
    ['Scepter/', 'Triple Threat'],
    ['Axe/Dagger', 'Harrowing Storm'],
    ['Axe/Pistol', 'Orchestrated Assault'],
    ['Axe/', 'Recall Axes']
  ]);

  for (const [key, name] of expected) {
    const pair = key.split('/');
    const roots = thiefCatalog.skills.filter(
      (skill) =>
        skill.type === 'Weapon' &&
        skill.slot === 'Weapon_3' &&
        skill.flipParentId == null &&
        thiefWeaponSkillMatchesSet(skill, pair, {
          catalog: thiefCatalog
        })
    );

    assert.deepEqual(
      roots.map((skill) => skill.name),
      [name],
      key
    );
  }

  assert.equal(
    thiefCatalog.skills.some(
      (skill) =>
        skill.type === 'Weapon' &&
        skill.slot === 'Weapon_3' &&
        thiefWeaponSkillMatchesSet(skill, ['Sword', 'Sword'], {
          catalog: thiefCatalog
        })
    ),
    false
  );
});

test('dual-wield follow-ups require and consume their opening skill', () => {
  const denied = simulate('Core', ['Larcenous Strike'], {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Dagger'
  });

  assert.match(denied.warnings[0], /opening dual-wield skill/);
  const result = simulate('Core', ['Flanking Strike', 'Larcenous Strike'], {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Dagger'
  });

  assert.equal(result.warnings.length, 0);
  assert.ok(result.totalDamage > 0);
  assert.equal(result.planningState.profession.availableFlips[13007], undefined);
});

test('every terrestrial main hand exposes its normal stealth attack', () => {
  const expected = new Map([
    ['Dagger', 'Backstab'],
    ['Pistol', 'Sneak Attack'],
    ['Sword', 'Tactical Strike'],
    ['Shortbow', 'Surprise Shot'],
    ['Staff', 'Hook Strike'],
    ['Rifle', "Death's Judgment"],
    ['Scepter', 'Shadowsquall'],
    ['Axe', 'Cunning Salvo'],
    ['Spear', 'Ashen Assault']
  ]);

  for (const [weapon, name] of expected) {
    assert.ok(
      thiefCatalog.skills.some(
        (skill) => skill.name === name && skill.stealthAttack && !skill.malicious && skill.requiredMainHand === weapon
      ),
      weapon
    );
  }
});

test('initiative regenerates at exact boundaries and ignores Alacrity', () => {
  const boundary = simulate('Core', ['Death Blossom'], {
    initialInitiative: 3
  });

  assert.equal(boundary.warnings.length, 0);
  assert.equal(boundary.steps[0].start, 1000);
  assert.equal(
    boundary.planningState.profession.initiative.value,
    (boundary.steps[0].end - boundary.steps[0].start) / 1000
  );

  for (const alacrity of [false, true]) {
    const result = simulate('Core', [{ type: 'wait', durationMs: 5000 }], {
      initialInitiative: 0,
      boons: { alacrity }
    });

    assert.equal(result.planningState.profession.initiative.value, 5);
  }

  const kneeling = simulate('Deadeye', ['Kneel', { type: 'wait', durationMs: 3000 }], {
    initialInitiative: 1,
    primaryWeapon: 'Rifle',
    secondaryWeapon: ''
  });

  assert.equal(kneeling.warnings.length, 0);
  // Kneel spends the starting initiative; the kneeling rate applies from Kneel's completion onward.
  const kneeled = kneeling.steps[0].end / 1000;
  assert.ok(
    Math.abs(
      kneeling.planningState.profession.initiative.value -
        (kneeled + ((kneeling.planningState.atSeconds - kneeled) * 4) / 3)
    ) < 1e-9
  );
});

test('Unload refunds 2 initiative on completion but not cancellation', () => {
  const config = { initialInitiative: 3, primaryWeapon: 'Pistol', secondaryWeapon: 'Pistol' };
  const cost = thiefCatalog.skillsByName.get('Unload').initiativeCost;
  // Regeneration of one initiative per second through the cast isolates the refund.
  const initiative = (result) => observedRuntime(result).resourceController.value('initiative');
  const completed = simulate('Core', ['Unload'], config);

  assert.deepEqual(completed.warnings, []);
  assert.equal(completed.steps[0].interrupted, false);
  assert.ok(Math.abs(initiative(completed) - (3 - cost + completed.rotationEndTime + 2)) < 1e-9);

  const interrupted = simulate('Core', [{ name: 'Unload', interruptMs: 1 }], config);

  assert.deepEqual(interrupted.warnings, []);
  assert.equal(interrupted.events.find((event) => event.type === 'action').cancelled, true);
  assert.equal(
    interrupted.events.some((event) => event.type === 'damage' && event.skillName === 'Unload'),
    false
  );
  assert.ok(Math.abs(initiative(interrupted) - (3 - cost + interrupted.rotationEndTime)) < 1e-9);
});

// Commitment alone cannot refund Unload: the authored final bullet must have fired, even on shortened channels.
test('Unload refunds initiative only after its final packet on a committed channel', () => {
  for (const [interruptAfterMs, refund] of [
    [400, 0],
    [800, 2],
    [undefined, 2]
  ]) {
    const result = runThief(
      [{ type: 'cast', skillId: ID.UNLOAD, interruptAfterMs }],
      { initialInitiative: 3, primaryWeapon: 'Pistol', secondaryWeapon: 'Pistol' },
      {
        catalog: (catalog) =>
          withSkill(catalog, ID.UNLOAD, {
            castTimeMs: 1000,
            interruptMode: 'per-packet',
            effects: [
              {
                type: 'strike',
                name: 'Unload',
                timingAnchor: 'castStart',
                timingScale: 'fixed',
                ticks: [
                  { atMs: 200, coefficient: 1 },
                  { atMs: 800, coefficient: 1 }
                ]
              }
            ]
          })
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.events.find((event) => event.type === 'action').cancelled, false);
    assert.ok(
      Math.abs(observedRuntime(result).resourceController.value('initiative') - result.rotationEndTime - refund) < 1e-9
    );
  }
});

test('weapon swap preserves shared initiative', () => {
  const result = simulate('Core', ['Death Blossom', 'Swap Weapons', 'Unload']);

  assert.equal(result.warnings.length, 0);
  assert.equal(result.planningState.activeWeaponSet, 2);
  assert.ok(Math.abs(result.planningState.profession.initiative.value - (7 + result.planningState.atSeconds)) < 1e-9);
  assert.ok(result.events.some((event) => event.type === 'weapon_set'));

  const resetChain = simulate('Core', ['Double Strike', 'Swap Weapons', 'Double Strike'], {
    weaponSet2Primary: 'Dagger',
    weaponSet2Secondary: 'Dagger'
  });

  assert.deepEqual(resetChain.warnings, []);
  assert.equal(resetChain.steps.filter((step) => step.skill === 'Double Strike').length, 2);
});

test('a pre-commit cancellation does not advance the Thief autoattack chain', () => {
  const result = simulate('Core', [{ name: 'Double Strike', interruptMs: 1 }, 'Double Strike'], {
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Dagger'
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.events.find((event) => event.type === 'action').cancelled, true);
  assert.equal(result.planningState.profession.autoattackChains[ID.DOUBLE_STRIKE], ID.WILD_STRIKE);
});

test('stealth attacks remove stealth, apply Revealed, and block replacement', () => {
  const result = simulate('Core', ['Cloak and Dagger', 'Backstab', 'Cloak and Dagger', 'Backstab']);

  assert.match(result.warnings.at(-1), /requires stealth/);
  assert.ok(result.planningState.profession.revealedUntil > 0);
  assert.equal(result.planningState.profession.stealthUntil <= result.rotationEndTime, true);
});

test('non-stealth strike skills remove stealth and restore the normal autoattack', () => {
  const result = simulate('Core', ['Hide in Shadows', 'Heartseeker', 'Double Strike']);

  assert.deepEqual(result.warnings, []);
  assert.ok(result.planningState.profession.revealedUntil > 0);
  assert.equal(result.planningState.profession.stealthUntil <= result.rotationEndTime, true);
  assert.ok(result.events.some((event) => event.type === 'damage' && event.skillName === 'Double Strike'));
});

test('delayed strikes break stealth on impact without blocking a same-time stealth attack', () => {
  const config = {
    primaryWeapon: 'Rifle',
    secondaryWeapon: '',
    selectedSkillIds: [45508, 41158]
  };
  const rotation = ['Kneel', 'Shadow Meld', 'Shadow Flare', { type: 'wait', durationMs: 1 }];
  const flareDamage = simulate('Deadeye', rotation, config).events.find(
    (event) => event.type === 'damage' && event.skillName === 'Shadow Flare'
  );
  // The landed strike, not the cast, ends stealth at its own impact instant.
  const observed = [];
  runThief(
    rotation,
    { ...baseConfig, ...config, specialization: 'Deadeye' },
    {
      probes: [
        [
          flareDamage.at,
          (runtime) => observed.push(runtime.profession.core.strikeBrokeStealthAt, runtime.profession.core.stealthUntil)
        ]
      ]
    }
  );

  assert.deepEqual(observed, [flareDamage.at, flareDamage.at]);
  const sameTimeAttack = simulate(
    'Deadeye',
    ['Kneel', 'Shadow Meld', 'Shadow Flare', "Malicious Death's Judgment"],
    config
  );
  const flare = sameTimeAttack.events.find((event) => event.type === 'damage' && event.skillName === 'Shadow Flare');
  const deathJudgment = sameTimeAttack.steps.find((step) => step.skill === "Malicious Death's Judgment");

  assert.deepEqual(sameTimeAttack.warnings, []);
  assert.ok(Math.abs(deathJudgment.start / 1000 - flare.at) < 1e-9);
});

// A field impact and a stealth-granting hit can quantize to one tick; queue insertion order must not change the bar.
test('concurrent unrelated strikes reveal newly granted stealth in either queue order', () => {
  const baseline = runThief(['Cloak and Dagger']);
  const hitAt = baseline.events.find((event) => event.type === 'damage' && event.skillId === ID.CLOAK_AND_DAGGER).at;
  for (const priority of [-10, 10]) {
    const result = runThief(
      ['Cloak and Dagger', 'Double Strike'],
      {},
      {
        timeline: [
          {
            at: hitAt,
            priority,
            run(runtime) {
              runtime.effects.emit({ kind: 'packet', event: thiefHit(hitAt) });
            }
          }
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.ok(observedRuntime(result).profession.core.revealedUntil > result.rotationEndTime);
    assert.ok(result.steps.some((step) => step.skillId === ID.DOUBLE_STRIKE && !step.invalid));
  }
});

test('stealth replaces weapon skill 1 without a separate palette group', () => {
  const context = {
    specialization: 'Core',
    time: 1,
    activeWeaponSet: 1,
    build: {
      weapons: ['Dagger', 'Dagger'],
      alternateWeapons: ['Pistol', 'Pistol']
    },
    professionState: {
      stealthUntil: 4,
      revealedUntil: 0
    }
  };
  const groups = thiefProfession.ui.paletteGroups(context);

  assert.equal(
    groups.some((group) => group.id === 'thief-stealth-attacks'),
    false
  );

  const build = {
    ...createThiefBuildDefaults(),
    weapons: ['Dagger', 'Dagger'],
    alternateWeapons: ['', ''],
    specializations: []
  };
  const app = {
    build,
    adapter: thiefAppAdapter,
    profession: thiefProfession,
    skills: thiefCatalog.skills,
    skillById: thiefCatalog.skillsById,
    skillByName: thiefCatalog.skillsByName,
    weaponData: thiefAppAdapter.weaponData,
    results: null
  };
  const paletteNamesAfter = (rotation) => {
    app.results = simulate('Core', rotation, {
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Dagger',
      weaponSet2Primary: '',
      weaponSet2Secondary: ''
    });

    return weaponPaletteRows(app, 1)[0].skills.map((skill) => skill.name);
  };

  const ordinary = paletteNamesAfter([]);

  assert.ok(ordinary.includes('Double Strike'));
  assert.equal(ordinary.includes('Backstab'), false);

  const stealthed = paletteNamesAfter(['Cloak and Dagger']);

  assert.ok(stealthed.includes('Backstab'));
  assert.equal(stealthed.includes('Double Strike'), false);
});

// Stolen skills share the PvE formula even when their API entries also contain a competitive damage fact.
test('Deadeye stolen skills use the PvE damage formula and apply One in the Chamber once', () => {
  for (const skillId of DEADEYE_STOLEN_SKILL_IDS) {
    const strike = (selectedTraitIds) =>
      runThief([ID.DEADEYES_MARK, skillId], {
        specialization: 'Deadeye',
        selectedTraitIds,
        stats: { power: 2000, precision: 1000, ferocity: 0, criticalChanceBonus: -100 },
        target: { armor: 1000, conditions: {} }
      }).resolvedEvents.find((event) => event.type === 'damage' && event.skillId === skillId);
    const base = strike([]);
    const traited = strike([TRAIT.ONE_IN_THE_CHAMBER]);
    assert.equal(base.coefficient, 1);
    assertFlooredDamageMultiplier(traited.damage, base.damage, 1.25);
  }
});

test('Deadeye palette uses malicious stealth attacks and one stateful rifle bar', () => {
  const deadeyesMark = thiefCatalog.skillsByName.get("Deadeye's Mark");
  const deadeyeStolenSkillIds = [
    ID.STEAL_TIME,
    ID.STEAL_WARMTH,
    ID.STEAL_RESISTANCE,
    ID.STEAL_PRECISION,
    ID.STEAL_HEALTH,
    ID.STEAL_STRENGTH,
    ID.STEAL_DURABILITY,
    ID.STEAL_DEFENSES,
    ID.STEAL_MOBILITY
  ];

  assert.equal(deadeyesMark.flipParentId, null);

  const matchingNames = (pair, kneeling) =>
    thiefCatalog.skills
      .filter(
        (skill) =>
          skill.type === 'Weapon' &&
          thiefWeaponSkillMatchesSet(skill, pair, {
            catalog: thiefCatalog,
            specialization: 'Deadeye',
            professionState: { kneeling }
          })
      )
      .map((skill) => skill.name);

  const dagger = matchingNames(['Dagger', 'Dagger'], false);

  assert.ok(dagger.includes('Malicious Backstab'));
  assert.equal(dagger.includes('Backstab'), false);

  const standing = matchingNames(['Rifle', ''], false);

  assert.ok(standing.includes('Brutal Aim'));
  assert.ok(standing.includes('Double Tap'));
  assert.ok(standing.includes("Skirmisher's Shot"));
  assert.ok(standing.includes('Kneel'));
  assert.ok(standing.includes("Malicious Death's Judgment"));
  assert.equal(standing.includes('Deadly Aim'), false);
  assert.equal(standing.includes('Three Round Burst'), false);
  assert.equal(standing.includes("Spotter's Shot"), false);
  assert.equal(standing.includes('Free Action'), false);
  assert.equal(standing.includes("Death's Judgment"), false);

  const kneeling = matchingNames(['Rifle', ''], true);

  assert.ok(kneeling.includes('Deadly Aim'));
  assert.ok(kneeling.includes('Three Round Burst'));
  assert.ok(kneeling.includes("Spotter's Shot"));
  assert.ok(kneeling.includes('Free Action'));
  assert.equal(kneeling.includes('Brutal Aim'), false);
  assert.equal(kneeling.includes('Double Tap'), false);
  assert.equal(kneeling.includes("Skirmisher's Shot"), false);
  assert.equal(kneeling.includes('Kneel'), false);

  const paletteGroups = thiefProfession.ui.paletteGroups({
    specialization: 'Deadeye',
    build: { weapons: ['Rifle', ''], alternateWeapons: ['Dagger', 'Dagger'] },
    activeWeaponSet: 1,
    professionState: { kneeling: false }
  });

  assert.equal(
    paletteGroups.some((group) => group.id === 'thief-rifle-stance'),
    false
  );

  const professionGroup = paletteGroups.find((group) => group.id === 'thief-profession');
  const alwaysVisibleStolenGroup = paletteGroups.find((group) => group.id === 'deadeye-stolen-skills');

  assert.deepEqual(professionGroup.skillIds, [ID.DEADEYES_MARK]);
  assert.deepEqual(alwaysVisibleStolenGroup.skillIds, deadeyeStolenSkillIds);
  assert.equal(professionGroup.stackId, 'deadeye-stolen-skills');
  assert.equal(alwaysVisibleStolenGroup.stackId, professionGroup.stackId);
  assert.equal(simulate('Deadeye', []).planningState.availability[ID.STEAL_TIME].ready, false);

  const storedStolenSkillState = {
    storedStolenSkillId: ID.STEAL_TIME,
    storedStolenSkillIds: [ID.STEAL_TIME],
    storedStolenSkillCount: 1
  };
  const stolenGroup = thiefProfession.ui
    .paletteGroups({
      specialization: 'Deadeye',
      professionState: storedStolenSkillState
    })
    .find((group) => group.id === 'deadeye-stolen-skills');

  assert.deepEqual(stolenGroup.skillIds, deadeyeStolenSkillIds);
  assert.equal(stolenGroup.className, 'deadeye-stolen-skills-grid');
  assert.equal(
    planningFixture(thiefProfession, { specialization: 'Deadeye' }, (runtime) =>
      Object.assign(runtime.profession.core, storedStolenSkillState)
    ).availability[ID.STEAL_TIME].ready,
    true
  );
  assert.equal(
    planningFixture(thiefProfession, { specialization: 'Deadeye' }, (runtime) =>
      Object.assign(runtime.profession.core, storedStolenSkillState)
    ).availability[ID.STEAL_DEFENSES].ready,
    false
  );
});

test('Thief weapon chains and follow-ups occupy one live palette tile', () => {
  const paletteAfter = (specialization, weapons, rotation) => {
    const defaults = createThiefBuildDefaults();
    const specializations = [
      { name: 'Deadly Arts', traits: '1-1-1' },
      { name: 'Critical Strikes', traits: '1-1-1' },
      { name: specialization === 'Core' ? 'Shadow Arts' : specialization, traits: '1-1-1' }
    ];
    const app = {
      build: {
        ...defaults,
        weapons,
        alternateWeapons: ['', ''],
        specializations
      },
      adapter: thiefAppAdapter,
      profession: thiefProfession,
      skills: thiefCatalog.skills,
      skillById: thiefCatalog.skillsById,
      skillByName: thiefCatalog.skillsByName,
      weaponData: thiefAppAdapter.weaponData,
      results: simulate(specialization, rotation, {
        primaryWeapon: weapons[0],
        secondaryWeapon: weapons[1],
        weaponSet2Primary: '',
        weaponSet2Secondary: ''
      })
    };

    return weaponPaletteRows(app, 1)[0].skills;
  };

  const paletteNamesAfter = (...args) => paletteAfter(...args).map((skill) => skill.name);

  assert.ok(paletteNamesAfter('Specter', ['Scepter', 'Pistol'], []).includes('Shadow Bolt'));
  assert.ok(paletteNamesAfter('Specter', ['Scepter', 'Pistol'], ['Shadow Bolt']).includes('Double Bolt'));
  assert.ok(
    paletteNamesAfter('Specter', ['Scepter', 'Pistol'], ['Shadow Bolt', 'Double Bolt']).includes('Triple Bolt')
  );

  const sword = paletteNamesAfter('Core', ['Sword', 'Pistol'], ["Infiltrator's Strike"]);

  assert.ok(sword.includes("Infiltrator's Return"));
  assert.equal(sword.includes("Infiltrator's Strike"), false);

  const shortbow = paletteNamesAfter('Core', ['Shortbow', ''], ['Cluster Bomb']);

  assert.ok(shortbow.includes('Detonate Cluster'));
  assert.equal(shortbow.includes('Cluster Bomb'), false);

  const staff = paletteNamesAfter('Daredevil', ['Staff', ''], ['Debilitating Arc']);

  assert.ok(staff.includes('Helmet Breaker'));
  assert.equal(staff.includes('Debilitating Arc'), false);

  const standingRifle = paletteNamesAfter('Deadeye', ['Rifle', ''], []);

  assert.ok(standingRifle.includes("Death's Retreat"));
  assert.equal(standingRifle.includes("Sniper's Cover"), false);

  const kneelingRifleSkills = paletteAfter('Deadeye', ['Rifle', ''], ['Kneel', "Sniper's Cover"]);
  const kneelingRifle = kneelingRifleSkills.map((skill) => skill.name);

  assert.ok(kneelingRifle.includes("Death's Advance"));
  assert.equal(kneelingRifle.includes("Sniper's Cover"), false);
  assert.equal(
    kneelingRifleSkills.some((skill) => skill.id === 40436),
    true
  );
  assert.equal(
    kneelingRifleSkills.some((skill) => skill.id === 80278),
    false
  );
});

test('Steal exposes a choice pool and consumes whichever stolen skill is selected', () => {
  const stolenSkillIds = [ID.DETONATE_PLASMA, ID.THROW_MAGNETIC_BOMB, ID.SOUL_STONE_VENOM];
  const initialGroups = thiefProfession.ui.paletteGroups({ specialization: 'Core' });
  const initialProfessionGroup = initialGroups.find((group) => group.id === 'thief-profession');
  const initialStolenGroup = initialGroups.find((group) => group.id === 'thief-stolen-skills');

  assert.deepEqual(initialProfessionGroup.skillIds, [ID.STEAL]);
  assert.deepEqual(initialStolenGroup.skillIds, stolenSkillIds);
  assert.equal(initialProfessionGroup.stackId, initialStolenGroup.stackId);
  assert.equal(simulate('Core', []).planningState.availability[ID.DETONATE_PLASMA].ready, false);

  const stored = simulate('Core', ['Steal']);

  assert.equal(stored.planningState.profession.storedStolenSkillId, null);
  assert.deepEqual(stored.planningState.profession.storedStolenSkillIds, stolenSkillIds);
  const storedGroups = thiefProfession.ui.paletteGroups({
    specialization: 'Core',
    professionState: stored.planningState.profession
  });

  assert.deepEqual(storedGroups.find((group) => group.id === 'thief-stolen-skills').skillIds, stolenSkillIds);
  assert.equal(stored.planningState.availability[ID.DETONATE_PLASMA].ready, true);
  const used = simulate('Core', ['Steal', 'Detonate Plasma']);

  assert.equal(used.warnings.length, 0);
  assert.equal(used.planningState.profession.storedStolenSkillId, null);
  assert.deepEqual(used.planningState.profession.storedStolenSkillIds, []);
  assert.deepEqual(
    thiefProfession.ui
      .paletteGroups({ specialization: 'Daredevil', professionState: used.planningState.profession })
      .find((group) => group.id === 'thief-stolen-skills').skillIds,
    stolenSkillIds
  );

  // Both users of the base pool must gate each choice and consume it once, with Improvisation locking the reuse.
  for (const specialization of ['Core', 'Daredevil']) {
    const runtime = thiefProfession.runtimeFor({ specialization });
    assert.deepEqual(
      runtime.catalog.skills
        .filter((skill) => skill.slot === 'Profession_2')
        .map((skill) => skill.id)
        .sort(),
      [...stolenSkillIds].sort()
    );
    for (const id of stolenSkillIds) {
      const name = thiefCatalog.skillsById.get(id).name;
      const unavailable = simulate(specialization, [name]);
      assert.ok(
        unavailable.warnings.some((warning) => /steal this skill/i.test(warning)),
        name
      );
      const consumed = simulate(specialization, ['Steal', name]);
      assert.deepEqual(consumed.warnings, [], name);
      assert.equal(consumed.planningState.profession.storedStolenSkillCount, 0, name);
      assert.deepEqual(consumed.planningState.profession.storedStolenSkillIds, [], name);
      assert.ok(
        consumed.events.some((event) => event.type === 'damage' && event.skillId === id),
        name
      );

      const config = { selectedTraitIds: [TRAIT.IMPROVISATION] };
      const retained = simulate(specialization, ['Steal', name], config);
      assert.deepEqual(retained.warnings, [], name);
      assert.equal(retained.planningState.profession.storedStolenSkillCount, 1, name);
      assert.deepEqual(retained.planningState.profession.storedStolenSkillIds, [id], name);
      const reused = simulate(specialization, ['Steal', name, name], config);
      assert.deepEqual(reused.warnings, [], name);
      assert.equal(reused.planningState.profession.storedStolenSkillCount, 0, name);
    }
  }
});

test('Daredevil capacity and every dodge replacement resolve explicitly', () => {
  const expectations = new Map([
    ['Lotus Training', 'condition'],
    ['Bounding Dodger', 'damage'],
    ['Unhindered Combatant', 'buff']
  ]);

  for (const [selectedDodge, eventType] of expectations) {
    const traitId = TRAIT[selectedDodge.toUpperCase().replace(/[^A-Z0-9]+/g, '_')];
    const result = simulate('Daredevil', ['Dodge'], {
      selectedDodge,
      selectedTraitIds: [traitId]
    });

    assert.equal(result.planningState.profession.endurance.maximum, 150);
    assert.ok(result.events.some((event) => event.type === eventType));

    if (selectedDodge === 'Bounding Dodger') {
      // The window opens after the dodge's own landing strike resolves, so Bound does not benefit from it.
      const windowAtBound = [];
      const bound = result.events.find((event) => event.type === 'damage' && event.name === 'Bound');
      runThief(
        ['Dodge'],
        { ...baseConfig, specialization: 'Daredevil', selectedDodge, selectedTraitIds: [traitId] },
        {
          extend: (native) => ({
            reactions: {
              ...native.reactions,
              'damage.resolving'(runtime, event, details) {
                if (event.name === 'Bound')
                  windowAtBound.push(runtime.combat.activeBuffStacks('bounding-dodger', runtime.time, 1));
                return native.reactions['damage.resolving'](runtime, event, details);
              }
            }
          }),
          probes: [
            [
              bound.at,
              (runtime) => windowAtBound.push(runtime.combat.activeBuffStacks('bounding-dodger', runtime.time, 1))
            ]
          ]
        }
      );
      assert.equal(windowAtBound.length, 2);
      assert.equal(windowAtBound[0], 0);
      assert.equal(windowAtBound[1], 1);
    }
  }

  const impalingLotus = simulate('Daredevil', ['Dodge'], {
    selectedDodge: 'Lotus Training',
    selectedTraitIds: [TRAIT.LOTUS_TRAINING]
  });

  // Pin the dagger artwork so a loadable but incorrect API icon cannot pass this check.
  assert.equal(
    skillBreakdownRows(impalingLotus).find((row) => row.name === 'Impaling Lotus')?.icon,
    'https://render.guildwars2.com/file/E5724D46CEE62333E00CE26905C5FDD5439F6667/1058552.png'
  );
});

test('Exposed Weakness multiplies separately from additive strike bonuses', () => {
  const config = {
    selectedTraitIds: [TRAIT.EXPOSED_WEAKNESS],
    sigilSets: [
      { names: ['Test'], strike: 1.08, strikeAdd: 0.08 },
      { names: [], strike: 1, strikeAdd: 0 }
    ],
    target: {
      conditions: { Vulnerability: 25, Weakness: true }
    }
  };
  const exposed = simulate('Core', ['Double Strike'], config);
  const baseline = simulate('Core', ['Double Strike'], {
    ...config,
    selectedTraitIds: []
  });
  const damage = (result) => result.breakdown.find((entry) => entry.name === 'Double Strike').damage;

  assertFlooredDamageMultiplier(damage(exposed), damage(baseline), 1.04);
});

test('Critical Strikes applies runtime Fury, No Quarter, and multiplicative modifiers', () => {
  const criticalConfig = {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    selectedSkillIds: [],
    stats: { power: 2000, precision: 5000, ferocity: 0 },
    target: { armor: 2597, defiant: true, health: 1_000_000 },
    boons: { fury: false }
  };
  const flawlessHits = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Flawless Execution');
  const unrelenting = simulate('Daredevil', ['Flawless Execution'], {
    ...criticalConfig,
    selectedTraitIds: [TRAIT.UNRELENTING_STRIKES]
  });
  const withNoQuarter = simulate('Daredevil', ['Flawless Execution', { type: 'wait', durationMs: 3700 }, 'Slice'], {
    ...criticalConfig,
    selectedTraitIds: [TRAIT.UNRELENTING_STRIKES, TRAIT.NO_QUARTER]
  });
  const firstFlawless = flawlessHits(withNoQuarter);

  assert.equal(firstFlawless[0].criticalDamage, 1.5);
  assert.equal(firstFlawless[1].criticalDamage, 1.5 + 250 / 1500);
  const extendedFurySlice = withNoQuarter.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Slice'
  );

  assert.equal(extendedFurySlice.criticalDamage, 1.5 + 250 / 1500);
  assert.equal(observedRuntime(withNoQuarter).procs.snapshot()[TRAIT.UNRELENTING_STRIKES], firstFlawless[0].at + 8);
  assert.equal(observedRuntime(withNoQuarter).procs.snapshot()[TRAIT.NO_QUARTER], extendedFurySlice.at + 2);

  const withAssassinsFury = simulate('Daredevil', ['Flawless Execution'], {
    ...criticalConfig,
    selectedTraitIds: [TRAIT.UNRELENTING_STRIKES, TRAIT.ASSASSINS_FURY]
  });

  assertFlooredDamageMultiplier(
    flawlessHits(withAssassinsFury)[1].damage,
    flawlessHits(unrelenting)[1].damage,
    2090 / 2000
  );
  assert.equal(
    observedRuntime(withAssassinsFury).procs.snapshot()[TRAIT.ASSASSINS_FURY],
    flawlessHits(withAssassinsFury)[0].at + 2
  );

  const modifierConfig = {
    stats: { power: 2000, precision: 1000, ferocity: 0 },
    target: { armor: 2597, defiant: true, health: 1_000_000 }
  };
  const strike = (selectedTraitIds, target = modifierConfig.target) =>
    simulate('Daredevil', ['Slice'], {
      ...modifierConfig,
      target,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Pistol',
      selectedTraitIds
    }).resolvedEvents.find((event) => event.type === 'damage');

  assert.equal(strike([TRAIT.KEEN_OBSERVER]).criticalChance, 0.2);
  assert.ok(Math.abs(strike([TRAIT.TWIN_FANGS]).criticalChance - 0.12) < 1e-12);
  assert.ok(
    Math.abs(
      strike([TRAIT.TWIN_FANGS], {
        ...modifierConfig.target,
        defiant: false
      }).criticalChance - 0.05
    ) < 1e-12
  );
  assert.ok(Math.abs(strike([TRAIT.TWIN_FANGS, TRAIT.FEROCIOUS_STRIKES]).criticalDamage - 1.5 * 1.07 * 1.1) < 1e-12);
});

test('Thief modifiers follow stable skill and packet IDs after display labels change', () => {
  // The siphon's live Vulnerability bonus follows its packet ID after renaming.
  const vampiric = runThief(
    ['Unsuspecting Strike', 'Vampiric Slash'],
    { primaryWeapon: 'Spear', stats: { power: 2000 }, target: { conditions: { Vulnerability: 1 } } },
    {
      catalog: (catalog) =>
        withSkill(catalog, ID.VAMPIRIC_SLASH, {
          effects: catalog.skillsById
            .get(ID.VAMPIRIC_SLASH)
            .effects.map((effect) =>
              effect.damageKind === 'life-steal' ? { ...effect, name: 'Renamed life-siphon packet' } : effect
            )
        })
    }
  );
  assert.deepEqual(vampiric.warnings, []);
  assert.equal(vampiric.resolvedEvents.find((event) => event.name === 'Renamed life-siphon packet').damage, 2715);

  // The intrinsic factor now transforms the accepted packet, independently of its display label.
  const result = runThief(
    [ID.FLANKING_STRIKE, ID.LARCENOUS_STRIKE],
    { primaryWeapon: 'Sword' },
    {
      catalog: (catalog) =>
        withSkill(catalog, ID.LARCENOUS_STRIKE, {
          name: 'Renamed skill',
          effects: [{ type: 'strike', name: 'Renamed packet', coefficient: 2 }]
        })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.resolvedEvents.find((event) => event.skillId === ID.LARCENOUS_STRIKE && event.type === 'damage').coefficient,
    2.4
  );
});

test('Daredevil follow-ups, delayed impacts, and endurance traits resolve', () => {
  // Equip the parent so these assertions isolate its hit-gated follow-up window.
  const directPalm = simulate('Daredevil', ['Palm Strike'], { selectedSkillIds: [30868] });

  assert.match(directPalm.warnings[0], /Fist Flurry must connect/i);

  const result = simulate('Daredevil', ['Dodge', 'Fist Flurry', 'Palm Strike', { name: '__wait', waitMs: 2100 }], {
    selectedSkillIds: [30868],
    selectedDodge: 'Bounding Dodger',
    selectedTraitIds: [TRAIT.WEAKENING_STRIKES, TRAIT.BOUNDING_DODGER]
  });

  assert.deepEqual(result.warnings, []);
  assert.ok(
    result.resolvedEvents.some(
      (event) =>
        event.type === 'condition' && event.condition === 'Weakness' && event.sourceId === TRAIT.WEAKENING_STRIKES
    )
  );
  const pulmonary = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Pulmonary Impact'
  );

  assert.equal(pulmonary.length, 2);
  assert.ok(pulmonary.length > 0);
  assert.ok(pulmonary.every((event) => event.canCrit === false));

  const withoutSteal = simulate('Daredevil', ['Dodge', 'Dodge', 'Steal']);
  const withSteal = simulate('Daredevil', ['Dodge', 'Dodge', 'Steal'], {
    selectedTraitIds: [TRAIT.ENDURANCE_THIEF]
  });

  assert.ok(
    Math.abs(
      withSteal.planningState.profession.endurance.value - withoutSteal.planningState.profession.endurance.value - 50
    ) < 1e-9
  );

  const havoc = daredevilModule.modifiers.modifierRules.find((rule) => rule.id === 'thief.havoc-specialist');
  const weakening = daredevilModule.modifiers.modifierRules.find((rule) => rule.id === 'thief.weakening-strikes');

  assert.equal(havoc.operation, 'multiply');
  assert.equal(thiefCatalog.balanceProfilesById.get(TRAIT.HAVOC_SPECIALIST).damageMultiplier, 1.15);
  assert.equal(weakening.operation, 'multiply');
  assert.equal(thiefCatalog.balanceProfilesById.get(TRAIT.WEAKENING_STRIKES).damageMultiplier, 1.1);
});

test('Deadeye cantrips, malice, stolen skills, and traits are stateful', () => {
  const deadeyeTraits = [TRAIT.MALICIOUS_INTENT, TRAIT.ONE_IN_THE_CHAMBER, TRAIT.FIRE_FOR_EFFECT];
  const result = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom'], {
    selectedTraitIds: deadeyeTraits,
    stats: { precision: 5000 }
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.planningState.profession.markedTargetId, 'primary-target');
  assert.equal(result.planningState.profession.storedStolenSkillId, ID.STEAL_TIME);
  assert.equal(result.planningState.profession.storedStolenSkillCount, 1);
  assert.equal(result.planningState.profession.malice.value, 4);
  assert.ok(
    result.resolvedEvents.filter((event) => event.skillName === 'Death Blossom' && event.type === 'damage').length > 1
  );

  const consumed = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', 'Cloak and Dagger', 'Malicious Backstab'], {
    selectedTraitIds: [TRAIT.MALICIOUS_INTENT],
    stats: { precision: 5000 }
  });

  assert.equal(consumed.warnings.length, 0);
  assert.equal(consumed.planningState.profession.malice.value, 2);

  const selectableStolenSkills = simulate('Deadeye', ["Deadeye's Mark"]);
  const selectableStolenGroup = thiefProfession.ui
    .paletteGroups({ specialization: 'Deadeye', professionState: selectableStolenSkills.planningState.profession })
    .find((group) => group.id === 'deadeye-stolen-skills');

  assert.equal(selectableStolenGroup.skillIds.length, 9);
  assert.equal(selectableStolenGroup.className, 'deadeye-stolen-skills-grid');

  const noMaliceStealth = simulate('Deadeye', ["Deadeye's Mark", 'Steal Defenses']);

  assert.equal(noMaliceStealth.warnings.length, 0);
  assert.equal(noMaliceStealth.planningState.profession.storedStolenSkillId, null);
  assert.equal(noMaliceStealth.planningState.profession.stealthUntil, 0);

  const stolen = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', 'Steal Time'], {
    selectedTraitIds: deadeyeTraits,
    stats: { precision: 5000 }
  });

  assert.equal(stolen.warnings.length, 0);
  assert.ok(stolen.planningState.profession.stealthUntil > stolen.rotationEndTime);
  assert.ok(stolen.events.some((event) => event.name?.includes('Fire for Effect') && event.boon === 'Might'));

  const improvised = simulate('Deadeye', ["Deadeye's Mark", 'Steal Time', 'Steal Time'], {
    selectedTraitIds: [TRAIT.IMPROVISATION]
  });

  assert.equal(improvised.warnings.length, 0);
  assert.equal(improvised.planningState.profession.storedStolenSkillId, null);
  assert.equal(improvised.planningState.profession.storedStolenSkillCount, 0);

  const lockedImprovisation = simulate('Deadeye', ["Deadeye's Mark", 'Steal Defenses', 'Steal Time'], {
    selectedTraitIds: [TRAIT.IMPROVISATION]
  });

  assert.equal(lockedImprovisation.warnings.length, 1);
  assert.equal(lockedImprovisation.planningState.profession.storedStolenSkillId, ID.STEAL_DEFENSES);
  assert.deepEqual(lockedImprovisation.planningState.profession.storedStolenSkillIds, [ID.STEAL_DEFENSES]);

  const mercy = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', 'Mercy', "Deadeye's Mark"], {
    selectedTraitIds: deadeyeTraits,
    selectedSkillIds: [41372],
    stats: { precision: 5000 }
  });

  assert.equal(mercy.warnings.length, 0);
  assert.equal(mercy.planningState.profession.markGeneration, 2);
  assert.equal(mercy.planningState.profession.malice.value, 2);

  const chamber = simulate('Deadeye', ['Shadow Flare'], {
    selectedTraitIds: [TRAIT.ONE_IN_THE_CHAMBER],
    selectedSkillIds: [41158]
  });

  assert.equal(chamber.planningState.profession.storedStolenSkillId, null);
  assert.deepEqual(chamber.planningState.profession.storedStolenSkillIds, [
    ID.STEAL_TIME,
    ID.STEAL_WARMTH,
    ID.STEAL_RESISTANCE,
    ID.STEAL_PRECISION,
    ID.STEAL_HEALTH,
    ID.STEAL_STRENGTH,
    ID.STEAL_DURABILITY,
    ID.STEAL_DEFENSES,
    ID.STEAL_MOBILITY
  ]);

  const fireForEffectRestriction = simulate('Deadeye', ["Deadeye's Mark", 'Steal Defenses'], {
    selectedTraitIds: [TRAIT.FIRE_FOR_EFFECT]
  });

  assert.equal(fireForEffectRestriction.warnings.length, 1);
  assert.equal(fireForEffectRestriction.planningState.profession.storedStolenSkillId, ID.STEAL_TIME);
  assert.deepEqual(fireForEffectRestriction.planningState.profession.storedStolenSkillIds, [ID.STEAL_TIME]);
  assert.deepEqual(
    thiefProfession.ui
      .paletteGroups({
        specialization: 'Deadeye',
        config: { specialization: 'Deadeye', selectedTraitIds: [TRAIT.FIRE_FOR_EFFECT] },
        professionState: fireForEffectRestriction.planningState.profession
      })
      .find((group) => group.id === 'deadeye-stolen-skills').skillIds,
    [ID.STEAL_TIME]
  );

  const expired = simulate('Deadeye', ["Deadeye's Mark", { type: 'wait', durationMs: 30_001 }], {
    selectedTraitIds: [TRAIT.MALICIOUS_INTENT]
  });

  assert.equal(expired.planningState.profession.markedTargetId, null);
  assert.equal(expired.planningState.profession.malice.value, 0);
});

test('Malicious Intent grants malice after a stealth attack consumes its existing stacks', () => {
  // Six stacks must empower the attack without the post-consumption grant triggering Maleficent Seven.
  const rotation = ["Deadeye's Mark", 'Death Blossom', 'Cloak and Dagger', 'Malicious Backstab'];
  const config = {
    ...baseConfig,
    specialization: 'Deadeye',
    selectedTraitIds: [TRAIT.MALICIOUS_INTENT, TRAIT.MALEFICENT_SEVEN],
    stats: { ...baseConfig.stats, precision: 5000 }
  };
  const hit = runThief(rotation, config).resolvedEvents.find(
    (event) => event.skillName === 'Malicious Backstab' && event.type === 'damage'
  );
  // Malice is held through the attack and replaced at its impact by the spend and the Malicious Intent grant.
  const malice = [];
  const result = runThief(rotation, config, {
    probes: [hit.at - 0.001, hit.at].map((at) => [
      at,
      (runtime) => malice.push(runtime.profession.specialization.state.malice.value)
    ])
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(hit.deadeyeMaliceSnapshot, 6);
  assert.deepEqual(malice, [6, 2]);
  assert.equal(result.planningState.profession.malice.value, 2);
  assert.equal(result.planningState.profession.maleficentSevenTriggered, false);
  assert.equal(
    result.events.some((event) => event.name?.includes('Maleficent Seven')),
    false
  );
});

test('Deadeye malice resolves on the first hit and malicious impact', () => {
  const criticalConfig = {
    selectedTraitIds: [TRAIT.MALICIOUS_INTENT],
    stats: { precision: 5000 },
    randomness: { mode: 'stochastic', seed: 1 }
  };
  const criticalBurst = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom'], criticalConfig);
  const burstHits = criticalBurst.resolvedEvents.filter(
    (event) => event.skillName === 'Death Blossom' && event.type === 'damage'
  );

  assert.ok(burstHits.length > 0);
  assert.ok(burstHits.every((event) => event.didCrit === true));
  assert.equal(criticalBurst.planningState.profession.malice.value, 4);

  const noncriticalBurst = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom'], {
    stats: { precision: 0 },
    randomness: { mode: 'stochastic', seed: 1 }
  });

  assert.equal(noncriticalBurst.planningState.profession.malice.value, 1);

  const earlyMercyRotation = ["Deadeye's Mark", 'Kneel', 'Three Round Burst', { name: 'Mercy', offset: 100 }];
  const earlyMercyConfig = {
    ...baseConfig,
    ...criticalConfig,
    specialization: 'Deadeye',
    initialInitiative: 4,
    primaryWeapon: 'Rifle',
    secondaryWeapon: '',
    selectedSkillIds: [41372]
  };
  const earlyMercy = runThief(earlyMercyRotation, earlyMercyConfig);
  const mercyAt = earlyMercy.steps.find((step) => step.skill === 'Mercy').end / 1000;
  // Observe half a millisecond either side of the instant Mercy, removing that interval's regeneration.
  const around = [];
  runThief(earlyMercyRotation, earlyMercyConfig, {
    probes: [mercyAt - 0.0005, mercyAt + 0.0005].map((at) => [
      at,
      (runtime) =>
        around.push([runtime.resourceController.value('initiative'), runtime.profession.core.initiative.rate])
    ])
  });
  // Two malice stacks refund five initiative independently of the preceding regeneration wait.
  assert.ok(Math.abs(around[1][0] - around[0][0] - around[0][1] * 0.001 - 5) < 1e-9);
  assert.equal(earlyMercy.planningState.profession.malice.value, 2);

  const rifleRotation = ["Deadeye's Mark", 'Kneel', 'Three Round Burst', 'Shadow Meld', "Malicious Death's Judgment"];
  const rifleConfig = {
    ...criticalConfig,
    primaryWeapon: 'Rifle',
    secondaryWeapon: '',
    selectedSkillIds: [41372, 45508]
  };
  const ordinaryShot = simulate('Deadeye', rifleRotation, rifleConfig);
  const mercyRotation = [...rifleRotation, { name: 'Mercy', offset: 100 }];
  const mercyShot = simulate('Deadeye', mercyRotation, rifleConfig);
  const maliciousEvent = (result) =>
    result.resolvedEvents.find((event) => event.skillName === "Malicious Death's Judgment" && event.type === 'damage');
  const ordinaryEvent = maliciousEvent(ordinaryShot);
  const mercyEvent = maliciousEvent(mercyShot);
  const mercyStep = mercyShot.steps.find((step) => step.skill === 'Mercy');

  // A Mercy cast during the attack cannot change the malice the attack snapshotted at its start.
  assert.ok(mercyStep.start / 1000 < mercyEvent.at);
  assert.equal(mercyEvent.deadeyeMaliceSnapshot, 4);
  assert.equal(mercyEvent.damage, ordinaryEvent.damage);
  // The attack's impact then grants Malicious Intent's malice.
  const afterImpact = [];
  runThief(
    mercyRotation,
    { ...baseConfig, ...rifleConfig, specialization: 'Deadeye' },
    {
      probes: [[mercyEvent.at, (runtime) => afterImpact.push(runtime.profession.specialization.state.malice.value)]]
    }
  );
  assert.deepEqual(afterImpact, [2]);

  const remarked = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', "Deadeye's Mark"], {
    stats: { precision: 5000 },
    randomness: { mode: 'stochastic', seed: 1 }
  });

  assert.equal(remarked.planningState.profession.malice.value, 2);
});

test('Deadeye strike modifiers, grandmasters, and stealth attacks use supplied values', () => {
  const skillDamage = (result, name) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && (event.skillName === name || event.name === name))
      .damage;
  const assertMultiplier = (withEffect, withoutEffect, skill, multiplier) =>
    assertFlooredDamageMultiplier(skillDamage(withEffect, skill), skillDamage(withoutEffect, skill), multiplier);
  const fullCrit = { stats: { precision: 5000 } };

  const plainFlare = simulate('Deadeye', ['Shadow Flare'], {
    ...fullCrit,
    selectedSkillIds: [41158]
  });
  const markedFlare = simulate('Deadeye', ["Deadeye's Mark", 'Shadow Flare'], {
    ...fullCrit,
    selectedSkillIds: [41158]
  });

  assertMultiplier(markedFlare, plainFlare, 'Shadow Flare', 1.5);
  assert.ok(
    markedFlare.planningState.profession.availableFlips[ID.SHADOW_SWAP]?.expiresAt > markedFlare.rotationEndTime
  );

  const plainStolen = simulate('Deadeye', ["Deadeye's Mark", 'Steal Time'], fullCrit);
  const plainStealTimeEvent = plainStolen.resolvedEvents.find(
    (event) => event.skillName === 'Steal Time' && event.type === 'damage'
  );

  assert.equal(plainStealTimeEvent.weaponStrengthProfileId, 'nonweapon.profession-mechanic');
  assert.equal(plainStealTimeEvent.resolvedWeaponStrength, 1100);
  const chamberStolen = simulate('Deadeye', ["Deadeye's Mark", 'Steal Time'], {
    ...fullCrit,
    selectedTraitIds: [TRAIT.ONE_IN_THE_CHAMBER]
  });

  assertMultiplier(chamberStolen, plainStolen, 'Steal Time', 1.25);

  const markedSword = simulate('Deadeye', ["Deadeye's Mark", 'Slice'], {
    ...fullCrit,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol'
  });
  const ironSight = simulate('Deadeye', ["Deadeye's Mark", 'Slice'], {
    ...fullCrit,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    selectedTraitIds: [TRAIT.IRON_SIGHT]
  });

  assertMultiplier(ironSight, markedSword, 'Slice', 1.1);

  const plainCantrip = simulate('Deadeye', ['Mercy', 'Slice'], {
    ...fullCrit,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    selectedSkillIds: [41372]
  });
  const relicCantrip = simulate('Deadeye', ['Mercy', 'Slice'], {
    ...fullCrit,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    selectedSkillIds: [41372],
    relic: 'Deadeye'
  });

  assertMultiplier(relicCantrip, plainCantrip, 'Slice', 1.1);

  const boonConfig = {
    ...fullCrit,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    boons: { fury: true, quickness: true, vigor: true }
  };
  const plainBoonStrike = simulate('Deadeye', ['Slice'], boonConfig);
  const premeditated = simulate('Deadeye', ['Slice'], {
    ...boonConfig,
    selectedTraitIds: [TRAIT.PREMEDITATION]
  });
  assertMultiplier(premeditated, plainBoonStrike, 'Slice', 1.03);

  const quickKiller = simulate('Deadeye', ['Slice'], {
    ...boonConfig,
    selectedTraitIds: [TRAIT.BE_QUICK_OR_BE_KILLED]
  });
  assertMultiplier(quickKiller, plainBoonStrike, 'Slice', 2380 / 2180);
  const markedKiller = simulate('Deadeye', ["Deadeye's Mark"], {
    selectedTraitIds: [TRAIT.BE_QUICK_OR_BE_KILLED]
  });

  assert.ok(markedKiller.events.some((event) => event.boon === 'Quickness' && event.duration === 4));

  const seven = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', 'Death Blossom', 'Death Blossom'], {
    ...fullCrit,
    selectedTraitIds: [TRAIT.MALICIOUS_INTENT, TRAIT.MALEFICENT_SEVEN]
  });

  assert.equal(seven.warnings.length, 0);
  assert.equal(seven.planningState.profession.malice.maximum, 7);
  assert.equal(seven.planningState.profession.malice.value, 7);
  assert.ok(seven.events.some((event) => event.name?.includes('Maleficent Seven')));

  const silent = simulate(
    'Deadeye',
    ["Deadeye's Mark", 'Death Blossom', 'Death Blossom', 'Dodge', 'Malicious Backstab'],
    { ...fullCrit, selectedTraitIds: [TRAIT.SILENT_SCOPE] }
  );

  assert.equal(silent.warnings.length, 0);
  assert.equal(silent.planningState.profession.bonusStealthAttack.charges, 0);

  const maliciousSneak = simulate('Deadeye', ["Deadeye's Mark", 'Unload', 'Steal Time', 'Malicious Sneak Attack'], {
    ...fullCrit,
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Pistol',
    selectedTraitIds: [TRAIT.MALICIOUS_INTENT]
  });

  assert.equal(maliciousSneak.warnings.length, 0);
  // Multiple hits consume malice only once, leaving the trait's grant for the next attack.
  assert.equal(maliciousSneak.planningState.profession.malice.value, 2);
  assert.equal(
    maliciousSneak.events.find((event) => event.skillName === 'Malicious Sneak Attack' && event.condition === 'Torment')
      .duration,
    9
  );
});

test('Kneel replaces the rifle bar until Free Action or weapon swap', () => {
  const result = simulate('Deadeye', ['Kneel', 'Three Round Burst', 'Free Action', 'Double Tap'], {
    primaryWeapon: 'Rifle',
    secondaryWeapon: ''
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.planningState.profession.kneeling, false);
  assert.ok(result.totalDamage > 0);
});

test('Deadeye rifle stance rejects every inactive replacement', () => {
  const rifle = {
    primaryWeapon: 'Rifle',
    secondaryWeapon: ''
  };

  for (const skill of ['Deadly Aim', 'Three Round Burst', "Spotter's Shot", 'Free Action']) {
    const result = simulate('Deadeye', [skill], rifle);

    assert.match(result.warnings[0], /kneel/i, skill);
  }

  for (const skill of ['Brutal Aim', 'Double Tap', "Skirmisher's Shot", 'Kneel']) {
    const result = simulate('Deadeye', ['Kneel', skill], rifle);

    assert.match(result.warnings[0], /kneel|rifle skill/i, skill);
  }
});

// A fractional observation must not bypass the recovery threshold's detection tick.
test('initiative-funded casts retain readiness across intermediate observations', () => {
  const catalog = (live) => withSkill(live, ID.DOUBLE_STRIKE, { initiativeCost: 0.1 });
  for (const waits of [[100], [50, 50]]) {
    const result = runThief(
      [...waits.map((durationMs) => ({ type: 'wait', durationMs })), 'Double Strike'],
      { ...baseConfig, initialInitiative: 0 },
      { catalog }
    );
    assert.deepEqual(result.warnings, []);
    // One tenth of an initiative accrues at 0.1 s and is detected on the next 40 ms tick.
    assert.equal(result.steps.find((step) => step.skillId != null).start, 120);
  }
});

// Initiative follows shared admission priority: permanent costs win, but retryable costs allow state denials.
test('initiative uses shared warning codes and cost-gate priority', () => {
  for (const [rate, expected] of [
    [0, 'gw2.insufficient-initiative'],
    [1, 'thief.rifle-stance']
  ]) {
    const codes = [];
    const result = runThief(
      ["Sniper's Cover"],
      {
        specialization: 'Deadeye',
        primaryWeapon: 'Rifle',
        secondaryWeapon: '',
        initialInitiative: 0
      },
      {
        catalog: (live) => withProfile(live, THIEF_CORE_BALANCE_PROFILE_IDS.resources, { resourceGain: rate }),
        extend: (native) => ({
          availability(runtime, skill, command) {
            const result = native.availability(runtime, skill, command);
            if (!result.ready && skill.id === ID.SNIPERS_COVER) codes.push(result.code);
            return result;
          }
        })
      }
    );
    assert.deepEqual([...new Set(codes)], [expected]);
    assert.equal(result.warnings.length, 1);
  }
});

// Known signet pulses remain affordability boundaries when ordinary recovery is disabled.
test('initiative availability waits for a signet grant with zero regeneration', () => {
  const result = runThief(
    ['Double Strike'],
    { ...baseConfig, initialInitiative: 0, selectedSkillIds: [13064] },
    {
      catalog: (live) =>
        withProfile(
          withSkill(live, ID.DOUBLE_STRIKE, { initiativeCost: 1 }),
          THIEF_CORE_BALANCE_PROFILE_IDS.resources,
          {
            resourceGain: 0
          }
        )
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps[0].start, 10000);
});

// Every stolen skill snapshots eligibility before malice changes; party packets do not replace canonical stealth entry.
test('Deadeye stolen effects capture malice and preserve party audience and Revealed gating', () => {
  for (const skillId of DEADEYE_STOLEN_SKILL_IDS) {
    for (const malice of [2, 3]) {
      for (const revealed of [false, true]) {
        const result = runThief(
          [{ type: 'cast', skillId }],
          { specialization: 'Deadeye' },
          {
            initialize(runtime) {
              storeThiefStolenSkillChoices(runtime, [skillId]);
              runtime.resourceController.replace('malice', malice);
              runtime.profession.core.revealedUntil = revealed ? 10 : 0;
            },
            probes: [
              [
                0.05,
                (runtime) => {
                  runtime.resourceController.replace('malice', malice === 3 ? 0 : 3);
                }
              ]
            ]
          }
        );
        assert.deepEqual(result.warnings, []);
        const packets = result.events.filter((event) => event.skillId === skillId);
        assert.equal(
          packets.some((event) => event.type === 'buff' && event.kind === 'stealth'),
          malice === 3 && !revealed
        );
        assert.equal(result.planningState.profession.stealthUntil > 0, malice === 3 && !revealed);
        assert.equal(result.planningState.profession.storedStolenSkillCount, 0);
        const authored = thiefCatalog.skillsById.get(skillId).effects.filter((effect) => effect.type === 'boon');
        for (const effect of authored) {
          const boon = packets.find((event) => event.type === 'buff' && event.kind === effect.boon.toLowerCase());
          assert.ok(boon);
          assert.deepEqual(boon.audience, { recipients: 'party', maximumRecipients: 5 });
        }
      }
    }
  }
});
