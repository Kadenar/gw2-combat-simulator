// Exercise live rework ownership and resource consumption with minimal combat scenarios.
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { wait } from '#tests/helpers/commands.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';

test('Malicious Deaths Judgment retains full damage without spending malice on an unmarked target', () => {
  const results = [false, true].map((marked) =>
    runThief(
      [ID.MALICIOUS_DEATHS_JUDGMENT],
      { specialization: 'Deadeye', primaryWeapon: 'Rifle', secondaryWeapon: '' },
      {
        initialize(runtime) {
          runtime.profession.core.stealthUntil = 10;
          runtime.resourceController.replace('malice', 5);
          Object.assign(runtime.profession.specialization.state, {
            markedTargetId: marked ? 'primary-target' : null,
            markExpiresAt: 30
          });
        }
      }
    )
  );
  for (const result of results) assert.deepEqual(result.warnings, []);
  assert.ok(results[0].totalDamage > 0);
  assert.equal(results[0].totalDamage, results[1].totalDamage);
  assert.equal(observedRuntime(results[0]).resourceController.value('malice'), 5);
  assert.equal(observedRuntime(results[1]).resourceController.value('malice'), 0);
});

test('Deft Initiation consumes its combat-entry reward once across multiple strikes', () => {
  const result = runThief([ID.DOUBLE_STRIKE, ID.WILD_STRIKE], { selectedTraitIds: [TRAIT.DEFT_INITIATION] });
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.resolvedEvents.filter((event) => event.sourceId === TRAIT.DEFT_INITIATION && event.kind === 'might').length,
    1
  );
  assert.equal(observedRuntime(result).profession.core.deftInitiationArmed, false);
});

// Base tooltip durations scale once through the ordinary boon and condition resolvers.
test('Acrobatics grants self boons and target conditions with attribute-scaled durations', () => {
  for (const bonus of [0, 750]) {
    const result = runThief([ID.STEAL, ID.DOUBLE_STRIKE, wait(100)], {
      selectedTraitIds: [TRAIT.DEFT_INITIATION, TRAIT.OPPORTUNE_OPENING, TRAIT.FELINE_GRACE, TRAIT.HARD_TO_CATCH],
      attributeInputs: baseAttributeInputs({ concentration: bonus, expertise: bonus })
    });
    assert.deepEqual(result.warnings, []);
    for (const [trait, kind, stacks, duration] of [
      [TRAIT.DEFT_INITIATION, 'might', 2, 10],
      [TRAIT.DEFT_INITIATION, 'Vulnerability', 3, 8],
      [TRAIT.OPPORTUNE_OPENING, 'Crippled', 1, 3],
      [TRAIT.FELINE_GRACE, 'swiftness', 1, 5],
      [TRAIT.HARD_TO_CATCH, 'resistance', 1, 4]
    ]) {
      const events = result.resolvedEvents.filter(
        (event) => event.sourceId === trait && (event.kind === kind || event.condition === kind)
      );
      const event = events[0];
      assert.ok(event, `${trait} ${kind}`);
      assert.equal(
        events.reduce((sum, event) => sum + event.stacks, 0),
        stacks
      );
      for (const event of events)
        assert.equal(event.effectiveDuration ?? event.duration, duration * (1 + bonus / 1500));

      if (event.type === 'buff') assert.equal(event.resolvedAudience.includesSelf, true);
    }
  }
});

test('Dont Stop grants endurance from Feline Grace but not permanent Swiftness assumptions', () => {
  for (const initialEndurance of [0, 96]) {
    const config = {
      initialEndurance,
      selectedTraitIds: [TRAIT.FELINE_GRACE, TRAIT.DONT_STOP],
      boons: { swiftness: true }
    };
    const idle = runThief([wait(1)], config);
    const moving = runThief([ID.STEAL, wait(1)], config);
    for (const result of [idle, moving]) assert.deepEqual(result.warnings, []);
    const endurance = (result) => observedRuntime(result).profession.core.endurance.value;
    assert.equal(endurance(moving) - endurance(idle), Math.min(8, 100 - endurance(idle)));
  }
});

// Each player well grants mobility rewards once, regardless of its pulses or overlapping skill flags.
test('Every Specter well grants Feline Grace once and triggers Dont Stop', () => {
  for (const skillId of [
    ID.WELL_OF_GLOOM,
    ID.WELL_OF_SILENCE,
    ID.WELL_OF_SORROW,
    ID.WELL_OF_TEARS,
    ID.WELL_OF_BOUNTY,
    ID.SHADOWFALL
  ]) {
    const results = [[], [TRAIT.DONT_STOP]].map((traits) =>
      runThief([skillId, wait(6000)], {
        specialization: 'Specter',
        selectedTraitIds: [TRAIT.FELINE_GRACE, ...traits],
        selectedSkillIds: [skillId],
        initialEndurance: 0
      })
    );
    for (const result of results) {
      assert.deepEqual(result.warnings, []);
      const grants = result.resolvedEvents.filter(
        (event) => event.sourceId === TRAIT.FELINE_GRACE && event.kind === 'swiftness'
      );
      assert.equal(grants.length, 1, `Feline Grace for ${skillId}`);
      assert.equal(grants[0].duration, 5);
    }

    const gainedEndurance =
      observedRuntime(results[1]).profession.core.endurance.value -
      observedRuntime(results[0]).profession.core.endurance.value;
    assert.ok(Math.abs(gainedEndurance - 8) < 1e-10, `Dont Stop for ${skillId}`);
  }
});

test('Upper Hand grants initiative on consecutive dodges within the successful-evade interval', () => {
  const results = [[], [TRAIT.UPPER_HAND]].map((selectedTraitIds) =>
    runThief(
      ['Dodge', 'Dodge'],
      { selectedTraitIds },
      {
        // Free dodges isolate initiative from endurance availability.
        catalog: (catalog) =>
          withSkill(catalog, SHARED_SKILL_IDS.DODGE, { cost: { resource: 'endurance', amount: 0 } }),
        initialize(runtime) {
          runtime.resourceController.replace('initiative', 0);
        }
      }
    )
  );
  for (const result of results) assert.deepEqual(result.warnings, []);
  assert.equal(
    observedRuntime(results[1]).resourceController.value('initiative') -
      observedRuntime(results[0]).resourceController.value('initiative'),
    2
  );
});

test('Opportune Opening applies one damage bonus for any number of impairing conditions', () => {
  const profession = thiefProfession.resolveProfession({ specialization: 'Core' });
  for (const conditions of [
    {},
    { Crippled: true },
    { Chilled: true },
    { Immobilized: true },
    { Crippled: true, Chilled: true, Immobilized: true }
  ]) {
    const context = {
      catalog: thiefProfession.catalog,
      traits: new Set([TRAIT.OPPORTUNE_OPENING]),
      time: 1,
      event: { actorType: 'player' },
      config: { target: { conditions } },
      runtime: { profession: { core: {} }, buffs: new Map(), conditionState: new Map() },
      damageInputs: {}
    };
    assert.equal(profession.calculations.modifyStrikeDamage(context, 1), Object.keys(conditions).length ? 1.05 : 1);
  }
});

test('Sharp Initiation emits one player-owned nonweapon strike without rearming itself', () => {
  const result = runThief([ID.DOUBLE_STRIKE, ID.WILD_STRIKE], {
    selectedTraitIds: [TRAIT.DEFT_INITIATION, TRAIT.SHARP_INITIATION]
  });
  assert.deepEqual(result.warnings, []);
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.SHARP_INITIATION
  );
  assert.equal(strikes.length, 1);
  assert.equal(strikes[0].coefficient, 1.25);
  assert.equal(strikes[0].weaponStrengthProfileId, 'nonweapon.unequipped');
  assert.equal(strikes[0].ownerActorType, 'player');
  assert.equal(observedRuntime(result).profession.core.deftInitiationArmed, false);
});

// Trait windows use fixed durations, independent of Concentration, and expire after the latest qualifying hit.
test('Twin Fangs refreshes its eight-second window only from qualifying hits', () => {
  for (const defiant of [false, true]) {
    const active = [];
    const result = runThief(
      [wait(14000)],
      {
        selectedTraitIds: [TRAIT.TWIN_FANGS],
        attributeInputs: baseAttributeInputs({ concentration: 1500 }),
        target: { armor: 2597, defiant, conditions: {} }
      },
      {
        initialize(runtime) {
          for (const at of [1, 5]) runtime.effects.emit({ kind: 'packet', event: thiefHit(at) });
          runtime.effects.emit({ kind: 'packet', event: thiefHit(10, { actorType: 'summon' }) });
        },
        probes: [0.5, 1, 5, 9.1, 13].map((at) => [
          at,
          (runtime) => active.push(buffActive({ runtime, time: runtime.time }, 'twin-fangs'))
        ])
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(active, [false, defiant, defiant, defiant, false]);
  }
});
