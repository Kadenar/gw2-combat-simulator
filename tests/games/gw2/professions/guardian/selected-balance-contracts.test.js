import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { GW2_ALACRITY_RECHARGE_RATE } from '#gw2/platform/combat/recharge.js';
import { effectFields, effectPlanningState } from '#tests/helpers/effect-report.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { luminaryImpactAt } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { guardianTooltips } from '#gw2/professions/guardian/app/tooltips.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { rotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/model.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';

// Skill patches must feed both execution and facts after moving conditional payloads out of profiles.
function radiantSkillPatch(skills) {
  const profession = withPatchPreview(guardianProfession, {
    id: 'radiant-skills',
    label: 'Radiant skill ownership',
    professions: { guardian: { skills } }
  });
  const context = profession.resolvePatch({ id: 'radiant-skills' }).balanceContext;
  return {
    facts: (id) => guardianTooltips.skills[id](context, context.catalog.skillsById.get(id)).facts,
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
  const expired = result.events.find((event) => event.type === 'weapon_set' && event.automatic);
  assert.equal(expired.at - entered.at, 2);
  assert.equal(result.planningState.profession[STATE.RADIANT_FORGE], false);
  assert.equal(
    baseline.planningState.cooldowns[ID.ENTER_RADIANT_FORGE].remaining -
      result.planningState.cooldowns[ID.ENTER_RADIANT_FORGE].remaining,
    3000 / GW2_ALACRITY_RECHARGE_RATE
  );
  assert.equal(
    patched
      .facts(ID.ENTER_RADIANT_FORGE)
      .find((fact) => fact.name === 'Base recharge reduction with at most one weapon').detail,
    '3s'
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

  const facts = fixture.facts(ID.GLARING_BURST);
  assert.ok(
    facts.some((fact) => fact.detail.includes('with hammer; alternative') && fact.detail.includes('2 coefficient'))
  );
  assert.ok(
    facts.some((fact) => fact.detail.includes('with sword; alternative') && fact.detail.includes('3 coefficient'))
  );
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
    const strike = result.resolvedEvents.find((event) => event.name === 'Dazzling Hammer — Radiant Justice Impact');
    const vulnerability = result.events.find(
      (event) => event.type === 'condition' && event.skillId === ID.DAZZLING_HAMMER
    );
    assert.equal(strike?.coefficient, armed ? 2.5 : undefined);
    assert.equal(vulnerability?.stacks, armed ? 6 : undefined);
    assert.equal(vulnerability?.duration, armed ? 3 : undefined);
    assert.equal(result.planningState.profession[STATE.RADIANT_JUSTICE_ARMED], false);
  }

  const facts = fixture.facts(ID.DAZZLING_HAMMER);
  assert.ok(
    facts.some(
      (fact) =>
        fact.detail.includes('additional when Radiant Justice is armed') && fact.detail.includes('2.5 coefficient')
    )
  );
  assert.equal(
    facts.some((fact) => !fact.detail.includes('additional') && fact.detail.includes('2.5 coefficient')),
    false
  );
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

    assert.ok(
      fixture
        .facts(id)
        .some(
          (fact) => fact.detail.includes(`additional when ${virtue} is armed`) && fact.detail.includes(`${duration}s`)
        )
    );
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
      assert.equal(luminaryImpactAt(cast), expected);
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

test('Guardian snapshots display selected caps and modifier bonuses', () => {
  const profession = withPatchPreview(guardianProfession, {
    id: 'guardian-snapshot',
    label: 'Guardian snapshot',
    professions: {
      guardian: {
        balanceProfiles: {
          [TRAIT.SYMBOLIC_AVENGER]: { fields: { maximumStacks: 7 } },
          [TRAIT.RADIANT_ARMAMENTS]: { fields: { damageIncrease: 0.09 } }
        },
        skills: { [ID.EFFULGENT_STANCE]: { fields: { maximumStacks: 12 } } },
        modifierRules: {
          'guardian.piercing-stance': { amount: 0.125 },
          'guardian.daring-advance': { factor: 1.2 }
        }
      }
    }
  });
  const events = ['radiant-armaments', 'piercing-stance', 'daring-advance'].map((kind) => ({
    type: 'buff',
    kind: `guardian-${kind}`,
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
  }));
  // Both caps and bonuses must come from the selected balance context without a separate app catalog.
  const app = {
    build: { rotation: [] },
    profession,
    patch: profession.resolvePatch({ id: 'guardian-snapshot' }),
    adapter: { eliteSpecialization: () => 'Luminary' },
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
  };
  const items = new Map(rotationStateSnapshot(app).items.map((item) => [item.id, item]));
  assert.equal(items.get('guardian-symbolic-avenger').value, '2/7 · 5.0s');
  assert.equal(items.get('luminary-effulgent-stance').value, '12/12 · 3.0s');
  assert.equal(items.get('luminary-radiant-armaments').title, 'Dazzling Hammer: +9% strike damage');
  assert.equal(items.get('luminary-piercing-stance').title, 'Piercing Stance: +12.5% strike damage');
  assert.equal(items.get('luminary-daring-advance').title, 'Daring Advance: +20% strike damage');
  // Public observations are detached from the source events.
  events[0].metadata.radiantWeapon = 'staff';
  assert.equal(
    rotationStateSnapshot(app).items.some((item) => item.id === 'luminary-radiant-armaments'),
    true
  );
});

// The same selected grant feeds the self charge owner, allied delivery, and its announcement.
test('Quickfire grants selected charges to self or the eligible ally', async () => {
  const { quickfire } = await import('#gw2/professions/guardian/specializations/firebrand/traits/index.js');
  const { captureEffectEmissions } = await import('#tests/helpers/effect-emission.js');
  const { withProfile } = await import('#tests/helpers/catalog-overrides.js');
  const catalog = guardianProfession.catalog;
  const profile = catalog.balanceProfilesById.get(TRAIT.QUICKFIRE);
  const helpers = withProfile(catalog, TRAIT.QUICKFIRE, {
    effects: profile.effects.map((effect) => ({ ...effect, stacks: 3, duration: 4 }))
  });
  for (const alliedPlayerCount of [0, 1]) {
    const { effects, announcements } = captureEffectEmissions();
    const state = { ashes: { charges: 0, expiresAt: 0, readyAt: 0 }, alliedAshes: {} };
    const recipients = [];
    const scheduled = [];
    const runtime = {
      time: 2,
      helpers,
      effects,
      profession: { specialization: { kind: 'Firebrand', state } },
      procs: { claim: () => true },
      schedule: (...args) => scheduled.push(args),
      alliedStrikes: { registerRecipients: (create, options) => recipients.push([create(1), options]) }
    };
    quickfire.triggers[0].run(runtime, {
      cause: { skillName: 'Quickness source', resolvedAudience: { alliedPlayerCount } }
    });
    assert.equal(announcements[0].announcement.detail, '+3 Ashes of the Just');

    if (alliedPlayerCount) {
      assert.equal(state.alliedAshes[1].charges, 3);
      assert.equal(state.alliedAshes[1].expiresAt, 6);
      // The ally's native grant, not the registration, owns its inclusive expiry.
      assert.equal(recipients[0][0].isActive(6), true);
      assert.equal(recipients[0][0].isActive(6.001), false);
      assert.equal(recipients[0][1].maximumAllies, 1);
      assert.equal(state.ashes.charges, 0);
    } else {
      assert.equal(state.ashes.charges, 3);
      assert.equal(state.ashes.expiresAt, 6);
      assert.equal(scheduled[0][1], 6);
    }
  }
});
