import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { planningFixture } from '#tests/helpers/observed-runtime.js';
import { daredevilModule } from '#gw2/professions/thief/specializations/daredevil/module.js';
import { armSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { weaponPaletteRows } from '#gw2/app/rotation/palette/model.js';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { resourceDisplayViews } from '#gw2/app/rotation/palette/resource-view.js';
import { createThiefBuildDefaults } from '#gw2/professions/thief/build/build.js';
import { thiefCatalog, thiefProfession } from '#gw2/professions/thief/profession.js';
import { thiefWeaponSkillMatchesSet } from '#gw2/professions/thief/build/weapon-matching.js';
import { THIEF_SUPPLEMENTAL_SKILLS } from '#gw2/professions/thief/data/thief-supplemental-skills.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

import { thiefAppAdapter } from '#gw2/professions/thief/app/app-definition.js';

import { deadeyeCastAvailability } from '#gw2/professions/thief/specializations/deadeye/mechanics/availability.js';
import { ANTIQUARY_ARTIFACT_WINDOWS } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifact-windows.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { DEADEYE_STOLEN_SKILL_IDS } from '#gw2/professions/thief/specializations/deadeye/skills/stolen-skills.js';
import { storeThiefStolenSkillChoices } from '#gw2/professions/thief/core/mechanics/steal.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { deadeyeCastCompleted } from '#gw2/professions/thief/specializations/deadeye/mechanics/trigger-points.js';
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
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  }),
  target: {
    armor: 2597,
    defiant: true,
    conditions: { Vulnerability: 25 }
  }
});

const simulate = createObservedProfessionSimulator(thiefProfession, baseConfig);

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
    const profile = deadeye ? TRAIT.SILENT_SCOPE : ANTIQUARY_ARTIFACT_WINDOWS.id;
    const patched = withPatchPreview(thiefProfession, {
      id: 'bonus-stealth-test',
      label: 'Bonus stealth test',
      professions: {
        thief: {
          balanceProfiles: {
            [profile]: { fields: { duration: 7 } }
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
      } else
        antiquaryHooks.sideEffectHandlers['thief.guitar'](context, {
          skill: runtime.helpers.skillsById.get(ID.METAL_LEGION_GUITAR)
        });
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
      // Runtime admission and the palette must agree before, at, and after the charge expires.
      runtime.time = at;
      assert.equal(thiefBonusStealthAttack(context), at < 9);
      const skill = runtime.helpers.skills.find(
        (candidate) => candidate.name === (deadeye ? 'Malicious Backstab' : 'Backstab')
      );
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
        [{ type: 'cast', skillId: 13014 }],
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
  assert.equal(thiefCatalog.skillsById.get(40436).id, 40436);
  assert.equal(thiefCatalog.skillsById.get(77230).id, 77230);
  assert.equal(thiefCatalog.skillsById.get(13006).initiativeCost, 4);

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

  assert.match(denied.warnings[0].message, /opening dual-wield skill/);
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
  const cost = thiefCatalog.skillsById.get(13011).initiativeCost;
  // Regeneration of one initiative per second through the cast isolates the refund.
  const initiative = (result) => observedRuntime(result).resourceController.value('initiative');
  const completed = simulate('Core', ['Unload'], config);

  assert.deepEqual(completed.warnings, []);
  assert.equal(completed.steps[0].interrupted, false);
  assert.ok(Math.abs(initiative(completed) - (3 - cost + completed.rotationEndTime + 2)) < 1e-9);

  const interrupted = simulate('Core', [{ name: 'Unload', interruptMs: 1 }], config);

  assert.deepEqual(interrupted.warnings, []);
  // An interrupted per-packet channel still spends initiative without earning the volley refund.
  assert.equal(interrupted.steps[0].interrupted, true);
  assert.equal(
    interrupted.events.some((event) => event.type === 'damage' && event.skillName === 'Unload'),
    false
  );
  assert.ok(Math.abs(initiative(interrupted) - (3 - cost + interrupted.rotationEndTime)) < 1e-9);
});

// Synthetic volleys isolate landed-hit and resource ownership without asserting the native bullet schedule.
test('Unload refunds initiative only when every bullet in its activation lands', () => {
  for (const { command = {}, missed = false, casts = 1, refund } of [
    { command: { interruptAfterMs: 400 }, refund: 0 },
    { command: { interruptAfterMs: 800 }, refund: 4 },
    { refund: 4 },
    { missed: true, refund: 0 },
    { command: { offTarget: true }, refund: 0 },
    { command: { impactDelayMs: 1200 }, refund: 4 },
    { command: { interruptAfterMs: 800, impactDelayMs: 1200 }, refund: 4 },
    { command: { interruptAfterMs: 400, impactDelayMs: 1200 }, refund: 0 },
    { command: { impactDelayMs: 1200 }, casts: 2, missed: true, refund: 0 },
    { command: { impactDelayMs: 1200 }, casts: 2, refund: 8 }
  ]) {
    const result = runThief(
      Array.from({ length: casts }, () => ({ type: 'cast', skillId: ID.UNLOAD, ...command })),
      { initialInitiative: 3 * casts, primaryWeapon: 'Pistol', secondaryWeapon: 'Pistol' },
      {
        observation: { kind: 'tail', durationMs: 1200 },
        // Completion cannot award the refund while the final projectile is still in flight.
        probes:
          command.impactDelayMs && !command.interruptAfterMs && casts === 1
            ? [
                [
                  1.5,
                  (runtime) => assert.ok(Math.abs(runtime.resourceController.value('initiative') - runtime.time) < 1e-9)
                ]
              ]
            : [],
        catalog: (catalog) =>
          withSkill(catalog, ID.UNLOAD, {
            initiativeRefund: 4,
            castTimeMs: 1000,
            effects: [
              {
                type: 'strike',
                name: 'First bullet',
                timingAnchor: 'castStart',
                timingScale: 'fixed',
                atMs: 200,
                coefficient: 1
              },
              {
                type: 'strike',
                name: 'Final bullet',
                timingAnchor: 'castStart',
                timingScale: 'fixed',
                atMs: 800,
                coefficient: 1
              }
            ]
          }),
        extend: (native) => ({
          prepareEvent(runtime, event) {
            const prepared = native.prepareEvent?.(runtime, event) ?? event;
            return missed && prepared.name === 'First bullet' ? { ...prepared, offTarget: true } : prepared;
          }
        })
      }
    );
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    // Only landed bullets add a refund above the fixed regeneration accrued during the observation.
    assert.ok(
      Math.abs(runtime.resourceController.value('initiative') - runtime.time - refund) < 1e-9,
      JSON.stringify({ command, missed, casts })
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

  assert.match(result.warnings.at(-1).message, /requires stealth/);
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
    patch: thiefAppAdapter.profession.resolvePatch(),
    build,
    adapter: thiefAppAdapter,
    profession: thiefProfession,
    activeCatalog: thiefCatalog,
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

test('Deadeye palette uses malicious stealth attacks and one stateful rifle bar', () => {
  const deadeyesMark = thiefCatalog.skillsById.get(43390);
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
      patch: thiefAppAdapter.profession.resolvePatch(),
      build: {
        ...defaults,
        weapons,
        alternateWeapons: ['', ''],
        specializations
      },
      adapter: thiefAppAdapter,
      profession: thiefProfession,
      activeCatalog: thiefCatalog,
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

  const stored = simulate('Core', [{ type: 'cast', skillId: 13014 }]);

  assert.equal(stored.planningState.profession.storedStolenSkillCount, 1);
  assert.deepEqual(stored.planningState.profession.storedStolenSkillIds, stolenSkillIds);
  const storedGroups = thiefProfession.ui.paletteGroups({
    specialization: 'Core',
    professionState: stored.planningState.profession
  });

  assert.deepEqual(storedGroups.find((group) => group.id === 'thief-stolen-skills').skillIds, stolenSkillIds);
  assert.equal(stored.planningState.availability[ID.DETONATE_PLASMA].ready, true);
  const used = simulate('Core', [{ type: 'cast', skillId: 13014 }, 'Detonate Plasma']);

  assert.equal(used.warnings.length, 0);
  assert.equal(used.planningState.profession.storedStolenSkillCount, 0);
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
        unavailable.warnings.some(({ message: warning }) => /steal this skill/i.test(warning)),
        name
      );
      const consumed = simulate(specialization, [{ type: 'cast', skillId: 13014 }, name]);
      assert.deepEqual(consumed.warnings, [], name);
      assert.equal(consumed.planningState.profession.storedStolenSkillCount, 0, name);
      assert.deepEqual(consumed.planningState.profession.storedStolenSkillIds, [], name);
      assert.ok(
        consumed.events.some((event) => event.type === 'damage' && event.skillId === id),
        name
      );

      const config = { selectedTraitIds: [TRAIT.IMPROVISATION] };
      const retained = simulate(specialization, [{ type: 'cast', skillId: 13014 }, name], config);
      assert.deepEqual(retained.warnings, [], name);
      assert.equal(retained.planningState.profession.storedStolenSkillCount, 1, name);
      assert.deepEqual(retained.planningState.profession.storedStolenSkillIds, [id], name);
      const reused = simulate(specialization, [{ type: 'cast', skillId: 13014 }, name, name], config);
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

  // Damage reporting must use the skill's configured artwork, independent of its image host.
  assert.equal(
    skillBreakdownRows(impalingLotus).find((row) => row.name === 'Impaling Lotus')?.icon,
    thiefCatalog.skillsById.get(31267).icon
  );
});

test('Daredevil follow-ups, delayed impacts, and endurance traits resolve', () => {
  // Equip the parent so these assertions isolate its hit-gated follow-up window.
  const directPalm = simulate('Daredevil', ['Palm Strike'], { selectedSkillIds: [30868] });

  assert.match(directPalm.warnings[0].message, /Fist Flurry must connect/i);

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

  const withoutSteal = simulate('Daredevil', ['Dodge', 'Dodge', { type: 'cast', skillId: 13014 }]);
  const withSteal = simulate('Daredevil', ['Dodge', 'Dodge', { type: 'cast', skillId: 13014 }], {
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
    attributeInputs: baseAttributeInputs({ precision: 5000 })
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.planningState.profession.markedTargetId, 'primary-target');
  assert.deepEqual(result.planningState.profession.storedStolenSkillIds, [ID.STEAL_TIME]);
  assert.equal(result.planningState.profession.storedStolenSkillCount, 1);
  assert.equal(result.planningState.profession.malice.value, 4);
  assert.ok(
    result.resolvedEvents.filter((event) => event.skillName === 'Death Blossom' && event.type === 'damage').length > 1
  );

  const consumed = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', 'Cloak and Dagger', 'Malicious Backstab'], {
    selectedTraitIds: [TRAIT.MALICIOUS_INTENT],
    attributeInputs: baseAttributeInputs({ precision: 5000 })
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
  assert.deepEqual(noMaliceStealth.planningState.profession.storedStolenSkillIds, []);
  assert.equal(noMaliceStealth.planningState.profession.storedStolenSkillCount, 0);
  assert.equal(noMaliceStealth.planningState.profession.stealthUntil, 0);

  const stolen = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', 'Steal Time'], {
    selectedTraitIds: deadeyeTraits,
    attributeInputs: baseAttributeInputs({ precision: 5000 })
  });

  assert.equal(stolen.warnings.length, 0);
  assert.ok(stolen.planningState.profession.stealthUntil > stolen.rotationEndTime);
  assert.ok(stolen.events.some((event) => event.name?.includes('Fire for Effect') && event.boon === 'Might'));

  const improvised = simulate('Deadeye', ["Deadeye's Mark", 'Steal Time', 'Steal Time'], {
    selectedTraitIds: [TRAIT.IMPROVISATION]
  });

  assert.equal(improvised.warnings.length, 0);
  assert.deepEqual(improvised.planningState.profession.storedStolenSkillIds, []);
  assert.equal(improvised.planningState.profession.storedStolenSkillCount, 0);

  const lockedImprovisation = simulate('Deadeye', ["Deadeye's Mark", 'Steal Defenses', 'Steal Time'], {
    selectedTraitIds: [TRAIT.IMPROVISATION]
  });

  assert.equal(lockedImprovisation.warnings.length, 1);
  assert.equal(lockedImprovisation.planningState.profession.storedStolenSkillCount, 1);
  assert.deepEqual(lockedImprovisation.planningState.profession.storedStolenSkillIds, [ID.STEAL_DEFENSES]);

  const mercy = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', 'Mercy', "Deadeye's Mark"], {
    selectedTraitIds: deadeyeTraits,
    selectedSkillIds: [41372],
    attributeInputs: baseAttributeInputs({ precision: 5000 })
  });

  assert.equal(mercy.warnings.length, 0);
  assert.equal(mercy.planningState.profession.markGeneration, 2);
  assert.equal(mercy.planningState.profession.malice.value, 2);

  const chamber = simulate('Deadeye', ['Shadow Flare'], {
    selectedTraitIds: [TRAIT.ONE_IN_THE_CHAMBER],
    selectedSkillIds: [41158]
  });

  assert.equal(chamber.planningState.profession.storedStolenSkillCount, 1);
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
  assert.equal(fireForEffectRestriction.planningState.profession.storedStolenSkillCount, 1);
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
    attributeInputs: baseAttributeInputs({ ...baseConfig.attributeInputs.weaponSets[0].commonTotals, precision: 5000 })
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
    attributeInputs: baseAttributeInputs({ precision: 5000 }),
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
    attributeInputs: baseAttributeInputs({ precision: 0 }),
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
    attributeInputs: baseAttributeInputs({ precision: 5000 }),
    randomness: { mode: 'stochastic', seed: 1 }
  });

  assert.equal(remarked.planningState.profession.malice.value, 2);
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

    assert.match(result.warnings[0].message, /kneel/i, skill);
  }

  for (const skill of ['Brutal Aim', 'Double Tap', "Skirmisher's Shot", 'Kneel']) {
    const result = simulate('Deadeye', ['Kneel', skill], rifle);

    assert.match(result.warnings[0].message, /kneel|rifle skill/i, skill);
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
  for (const [initiativeCost, expected] of [
    [13, 'gw2.insufficient-initiative'],
    [4, 'thief.rifle-stance']
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
        catalog: (live) => withSkill(live, ID.SNIPERS_COVER, { initiativeCost }),
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

// The signet grant must make the cast affordable before ordinary recovery alone would do so.
test('initiative availability includes signet grants alongside ordinary recovery', () => {
  const result = runThief(
    ['Double Strike'],
    { ...baseConfig, initialInitiative: 0, selectedSkillIds: [13064] },
    {
      catalog: (live) => withSkill(live, ID.DOUBLE_STRIKE, { initiativeCost: 11 })
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
