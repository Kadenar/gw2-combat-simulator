import assert from 'node:assert/strict';
import test from 'node:test';

import { rotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/model.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { GW2_ALACRITY_RECHARGE_RATE } from '#gw2/platform/combat/recharge.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { luminaryImpactAt } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { effectFields, effectPlanningState } from '#tests/helpers/effect-report.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';

// Run each forge scenario with its own skill patch.
function radiantSkillPatch(skills) {
  const profession = withPatchPreview(guardianProfession, {
    id: 'radiant-skills',
    label: 'Radiant skill ownership',
    professions: { guardian: { skills } }
  });
  return {
    run(rotation) {
      const result = runGuardian(rotation, { specialization: 'Luminary', patchId: 'radiant-skills' }, { profession });
      assert.deepEqual(result.warnings, []);
      return result;
    }
  };
}

test('Forge entry skill patches own expiry and the conditional exit recharge reduction', () => {
  const fixture = (rechargeReduction) =>
    radiantSkillPatch({
      [ID.ENTER_RADIANT_FORGE]: {
        fields: { rechargeReduction },
        effects: [{ type: 'buff', name: 'radiant-forge', duration: 2 }]
      }
    });
  const patched = fixture(3);
  const rotation = ['Enter Radiant Forge', 'Dazzling Hammer', { type: 'wait', durationMs: 2200 }];
  const result = patched.run(rotation);
  const baseline = fixture(0).run(rotation);
  const entered = result.events.find(
    (event) => event.type === 'weapon_set' && event.skillId === ID.ENTER_RADIANT_FORGE
  );
  const expired = result.events.find(
    (event) => event.type === 'weapon_set' && event.metadata?.guardianAutomaticForgeExit
  );
  assert.equal(expired.at - entered.at, 2);
  assert.equal(result.planningState.profession[STATE.RADIANT_FORGE], false);
  assert.equal(
    baseline.planningState.cooldownsBySkillId[ID.ENTER_RADIANT_FORGE].remainingMs -
      result.planningState.cooldownsBySkillId[ID.ENTER_RADIANT_FORGE].remainingMs,
    3000 / GW2_ALACRITY_RECHARGE_RATE
  );
});

test('Glaring Burst selects only the equipped weapon payload from its patched skill effects', () => {
  const fixture = radiantSkillPatch({
    [ID.GLARING_BURST]: {
      effects: [
        { type: 'strike', name: 'Radiant Hammer', coefficient: 2 },
        { type: 'strike', name: 'Radiant Blade', coefficient: 3 },
        { type: 'boon', name: 'regeneration', duration: 7 },
        { type: 'boon', name: 'resolution', duration: 9 },
        { type: 'condition', name: 'Vulnerability', stacks: 4 }
      ]
    }
  });
  for (const [weapon, coefficient, boon, duration] of [
    ['Dazzling Hammer', 2],
    ['Gleaming Blade', 3],
    ['Luminous Staff', undefined, 'regeneration', 7],
    ['Radiant Bulwark', undefined, 'resolution', 9],
    [undefined, undefined]
  ]) {
    const result = fixture.run(['Enter Radiant Forge', ...(weapon ? [weapon] : []), 'Glaring Burst']);
    const events = result.resolvedEvents.filter((event) => event.skillId === ID.GLARING_BURST);
    assert.equal(events.find((event) => event.type === 'damage')?.coefficient, coefficient);
    assert.equal(events.find((event) => event.type === 'buff')?.kind, boon);
    assert.equal(events.find((event) => event.type === 'buff')?.duration, duration);
    assert.equal(
      result.events.find(
        (event) =>
          event.type === 'condition' && event.skillId === ID.GLARING_BURST && event.condition === 'Vulnerability'
      )?.stacks,
      4
    );
  }
});

test('hammer empowerment reads patched skill components only after Justice is armed', () => {
  const fixture = radiantSkillPatch({
    [ID.DAZZLING_HAMMER]: {
      effects: [
        { type: 'strike', name: 'Radiant Justice Strike', coefficient: 2.5 },
        { type: 'condition', name: 'Vulnerability', stacks: 6, duration: 3 }
      ]
    }
  });
  for (const armed of [false, true]) {
    const result = fixture.run([
      ...(armed ? ['Radiant Justice'] : []),
      'Enter Radiant Forge',
      'Dazzling Hammer',
      { type: 'wait', durationMs: 1200 }
    ]);
    const strike = result.resolvedEvents.find((event) => event.name === 'Dazzling Hammer - Radiant Justice Impact');
    const vulnerability = result.events.find(
      (event) => event.type === 'condition' && event.skillId === ID.DAZZLING_HAMMER
    );
    assert.equal(strike?.coefficient, armed ? 2.5 : undefined);
    assert.equal(vulnerability?.stacks, armed ? 6 : undefined);
    assert.equal(vulnerability?.duration, armed ? 3 : undefined);
    assert.equal(result.planningState.profession[STATE.RADIANT_JUSTICE_ARMED], false);
  }
});

test('blade and staff skill payload patches remain conditional on their one-use virtues', () => {
  for (const [id, weapon, virtue, type, name, duration] of [
    [ID.GLEAMING_BLADE, 'Gleaming Blade', 'Radiant Courage', 'condition', 'Immobilized', 5],
    [ID.LUMINOUS_STAFF, 'Luminous Staff', 'Radiant Resolve', 'boon', 'regeneration', 7]
  ]) {
    const fixture = radiantSkillPatch({ [id]: { effects: [{ type, name, duration }] } });
    for (const armed of [false, true]) {
      const result = fixture.run([
        ...(armed ? [virtue] : []),
        'Enter Radiant Forge',
        weapon,
        { type: 'wait', durationMs: 1000 }
      ]);
      const grant = result.events.find(
        (event) =>
          event.skillId === id &&
          (type === 'boon'
            ? event.type === 'buff' && event.kind === name
            : event.type === 'condition' && event.condition === name)
      );
      assert.equal(grant?.duration, armed ? duration : undefined);
    }
  }
});

test('Luminary linked effects follow the selected packet anchor and scaling', () => {
  // Synthetic casts isolate timing projection from authored cast speeds and interruption thresholds.
  for (const [timingAnchor, timingScale, expected] of [
    ['castStart', 'fixed', 10.5],
    ['castEnd', 'fixed', 11.5],
    ['castStart', 'cast', 10.25],
    ['castEnd', 'cast', 11.25]
  ]) {
    for (const payload of [{ coefficient: 1, atMs: 500 }, { ticks: [{ coefficient: 1, atMs: 500 }] }]) {
      const cast = {
        start: 10,
        fullEnd: 11,
        effectiveEnd: 10.8,
        skill: { castTimeMs: 2000, effects: [{ type: 'strike', timingAnchor, timingScale, ...payload }] }
      };
      assert.equal(luminaryImpactAt(cast), gw2Time(expected));
    }
  }

  assert.equal(luminaryImpactAt({ effectiveEnd: 10.8, skill: { effects: [] } }), 10.8);
});

test('a cast-end stance impact grants its buff and detonates its aura at the packet boundary', () => {
  const profession = withPatchPreview(guardianProfession, {
    id: 'guardian-impact',
    label: 'Guardian impact',
    professions: {
      guardian: {
        skills: {
          [ID.PIERCING_STANCE]: {
            effects: [{ effectIndex: 0, atMs: 500, timingAnchor: 'castEnd', timingScale: 'fixed' }]
          }
        }
      }
    }
  });
  // A delayed packet must not consume the existing aura or grant its stance during the cast.
  const result = runGuardian(
    ['Effulgent Stance', 'Piercing Stance', { type: 'wait', durationMs: 1000 }],
    { specialization: 'Luminary', patchId: 'guardian-impact', selectedTraitIds: [TRAIT.SOVEREIGN_OF_LIGHT] },
    { initialize: () => {}, profession: profession }
  );
  assert.deepEqual(result.warnings, []);
  const strike = result.events.find((event) => event.type === 'damage' && event.skillId === ID.PIERCING_STANCE);
  const buff = result.events.find((event) => event.type === 'buff' && event.kind === 'guardian-piercing-stance');
  const detonation = result.events.find(
    (event) => event.type === 'damage' && event.skillId === ID.SOVEREIGN_OF_LIGHT_DAMAGE
  );
  assert.ok(strike);
  assert.equal(buff.at, strike.at);
  assert.equal(detonation.at, strike.at);
});

test('Guardian stack displays use the caps from the selected patch', () => {
  const profession = withPatchPreview(guardianProfession, {
    id: 'guardian-snapshot',
    label: 'Guardian snapshot',
    professions: {
      guardian: {
        balanceProfiles: {
          [TRAIT.SYMBOLIC_AVENGER]: { fields: { maximumStacks: 7 } }
        },
        skills: { [ID.EFFULGENT_STANCE]: { fields: { maximumStacks: 12 } } }
      }
    }
  });
  const events = [
    {
      type: 'buff',
      kind: 'guardian-radiant-armaments',
      at: 0,
      duration: 10,
      stacks: 1,
      resolvedAudience: {
        includesSelf: true,
        includesSummons: false,
        alliedPlayerCount: 0,
        companionIds: [],
        recipientCount: 1
      },
      metadata: { radiantWeapon: 'hammer' }
    }
  ];
  const app = {
    analysis: {
      needsPatchComparison: () => false,
      state: {
        results: {
          events,
          ...effectFields(events, 120),
          planningState: {
            ...effectPlanningState(effectFields(events, 120), 1),
            profession: {
              [STATE.SYMBOLIC_AVENGER_EXPIRATIONS]: [5, 6],
              [STATE.EFFULGENT_STACKS]: 12,
              [STATE.EFFULGENT_ACTIVE_UNTIL]: 4
            }
          }
        }
      }
    },
    build: { rotation: [] },
    profession,
    patch: profession.resolvePatch({ id: 'guardian-snapshot' }),
    adapter: { eliteSpecialization: () => 'Luminary' }
  };
  const items = new Map(rotationStateSnapshot(app).items.map((item) => [item.id, item]));
  assert.equal(items.get('guardian-symbolic-avenger').value, '2/7 · 5.0s');
  assert.equal(items.get('luminary-effulgent-stance').value, '12/12 · 3.0s');
  // Public observations are detached from the source events.
  events[0].metadata.radiantWeapon = 'staff';
  assert.equal(
    rotationStateSnapshot(app).items.some((item) => item.id === 'luminary-radiant-armaments'),
    true
  );
});
