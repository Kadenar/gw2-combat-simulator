import assert from 'node:assert/strict';
import test from 'node:test';

import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { timedBuffApplicationsAt } from '#gw2/platform/combat/boons.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as REWORK } from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { grantAshes } from '#gw2/professions/guardian/specializations/firebrand/mechanics/ashes.js';
import { swiftScholarPagesGranted } from '#gw2/professions/guardian/specializations/firebrand/mechanics/trigger-points.js';
import { ashesBurningSkill } from '#gw2/professions/guardian/specializations/firebrand/skills/tome-skills.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { wait } from '#tests/helpers/commands.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

const state = (result) => observedRuntime(result).profession.specialization.state;
const burns = (result) =>
  result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just'
  );

const strike = (runtime, at) =>
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'damage',
      source: 'guardian',
      sourceId: ID.ORB_OF_WRATH,
      skillId: ID.ORB_OF_WRATH,
      actorType: 'player',
      at,
      coefficient: 1,
      weaponStrengthProfileId: 'weapon.scepter',
      activationId: `hit-${at}`
    }
  });

// The Might grant is a skill yield, independent of the separately consumed Ashes charges.
test('Ashes Might retains its granting skill and boon-generation ownership', () => {
  const result = runGuardian([ID.TOME_OF_JUSTICE, ID.ASHES_OF_THE_JUST, wait(1000)], { specialization: 'Firebrand' });
  assert.deepEqual(result.warnings, []);
  const might = result.resolvedEvents.find(
    (event) => event.kind === 'might' && event.sourceId === ID.ASHES_OF_THE_JUST
  );
  assert.ok(might?.boonGeneration?.activationId);
  assert.equal(might.boonGeneration.at, might.at);
  assert.equal(might.skillId, ID.ASHES_OF_THE_JUST);
});

// Grants mutate one charge owner; emitted history and public snapshots remain detached.
test('Ashes spending cannot mutate its delivered buff or public snapshot', () => {
  const result = runGuardian(
    [ID.TOME_OF_JUSTICE, ID.ASHES_OF_THE_JUST, wait(1000)],
    { specialization: 'Firebrand' },
    { initialize: (runtime) => strike(runtime, 1) }
  );
  const buff = result.events.find((event) => event.kind === 'ashes-of-the-just');
  assert.equal(state(result).ashes.charges, buff.stacks - 1);
  const remaining = result.planningState.profession[STATE.ASHES].charges;
  state(result).ashes.charges = 0;
  assert.equal(result.planningState.profession[STATE.ASHES].charges, remaining);
  assert.equal(buff.stacks, remaining + 1);
});

test('Ashes buff history, expiry cleanup, and planning state share the effect-clock deadline', () => {
  const result = runGuardian([wait(1), ID.TOME_OF_JUSTICE, ID.ASHES_OF_THE_JUST, wait(11000)], {
    specialization: 'Firebrand'
  });
  assert.deepEqual(result.warnings, []);
  const application = result.events.find((event) => event.kind === 'ashes-of-the-just');
  const [buff] = timedBuffApplicationsAt(result.events, 'ashes-of-the-just', application.at);
  assert.ok(buff.expiresAt >= application.at + application.duration);
  assert.equal(state(result).ashes.expiresAt, buff.expiresAt);
  assert.equal(result.planningState.profession[STATE.ASHES].expiresAt, buff.expiresAt);
  assert.equal(state(result).ashes.charges, 0);
});

// The application boundary owns the grant; cancellation before commitment never installs party charges.
test('Ashes charges require an accepted grant and canceled casts grant nothing', () => {
  for (const interruptAfterMs of [undefined, 1, 700]) {
    const result = runGuardian(
      [
        ID.TOME_OF_JUSTICE,
        { type: 'cast', skillId: ID.ASHES_OF_THE_JUST, ...(interruptAfterMs == null ? {} : { interruptAfterMs }) },
        wait(1000)
      ],
      { specialization: 'Firebrand' }
    );
    assert.deepEqual(result.warnings, []);
    const action = result.events.find((event) => event.type === 'action' && event.skillId === ID.ASHES_OF_THE_JUST);
    const grants = result.events.filter((event) => event.kind === 'ashes-of-the-just');

    if (action.cancelled) {
      assert.deepEqual(grants, []);
      assert.equal(state(result).ashes.charges, 0);
    } else {
      assert.equal(grants.length, 1);
      assert.ok(grants[0].at >= action.at);
      assert.equal(state(result).ashes.charges, grants[0].stacks);
    }
  }
});

// Requests preserve source overlap policy while the existing ChargeGrant remains the only personal store.
test('Ashes replacement resets readiness while trait refresh can shorten the live deadline', () => {
  for (const source of ['epilogue', 'fervid-conviction']) {
    let installed;
    const result = runGuardian(
      [wait(3000)],
      { specialization: 'Firebrand' },
      {
        initialize: (runtime) => runtime.schedule('test.ashes', 0.2),
        extend: (native) => ({
          tasks: {
            ...native.tasks,
            'test.ashes'(runtime) {
              runtime.profession.specialization.state.ashes = { charges: 4, expiresAt: 20, readyAt: 8 };
              grantAshes(runtime, {
                source,
                cause: { type: 'buff', at: runtime.time },
                charges: 2,
                lifetimeSeconds: 2,
                recipients: { includesSelf: true, maximumAllies: 0 }
              });
              installed = { ...runtime.profession.specialization.state.ashes };
            }
          }
        })
      }
    );
    assert.equal(installed.charges, source === 'epilogue' ? 2 : 6);
    assert.equal(installed.readyAt, source === 'epilogue' ? 0 : 8);
    assert.equal(installed.expiresAt, gw2EffectExpiresAt(0.2, 2));
    assert.equal(state(result).ashes.charges, 0);
  }
});

// Allies share the player's aligned deadline, so a strike between the raw and aligned deadlines still consumes.
test('Fervid gives allies and the player the same aligned inclusive expiry', () => {
  for (const grantAt of [0.001, 0.04]) {
    const lifetimeSeconds = 0.4;
    const raw = canonicalTime(grantAt + lifetimeSeconds);
    const aligned = gw2EffectExpiresAt(grantAt, lifetimeSeconds);
    for (const at of [raw - 0.000001, raw, (raw + aligned) / 2, aligned, aligned + 0.000001]) {
      const result = runGuardian(
        [wait((at + 0.000001) * 1000)],
        {
          specialization: 'Firebrand',
          allies: { count: 1, strikesPerSecond: 1 / at }
        },
        {
          initialize: (runtime) => runtime.schedule('test.ashes', grantAt),
          extend: (native) => ({
            tasks: {
              ...native.tasks,
              'test.ashes'(runtime) {
                grantAshes(runtime, {
                  source: 'fervid-conviction',
                  cause: { type: 'buff', at: runtime.time, activationId: 'fervid' },
                  charges: 2,
                  lifetimeSeconds,
                  recipients: { includesSelf: true, maximumAllies: 1 }
                });
                strike(runtime, at);
              }
            }
          })
        }
      );
      assert.equal(
        burns(result).some((event) => event.metadata?.triggeredByAlly),
        at <= aligned,
        `ally at ${at}`
      );
      assert.equal(
        burns(result).some((event) => !event.metadata?.triggeredByAlly),
        at <= aligned,
        `self at ${at}`
      );
    }
  }
});

test('Fervid removes components before claiming but rejects nonpositive grant numbers after claiming', () => {
  for (const mode of ['buff', 'burning', 'recipients', 'valid']) {
    const grant = {
      fields: { internalCooldown: 3 },
      ...(mode === 'buff'
        ? { removeEffects: [{ type: 'buff', name: 'ashes-of-the-just' }] }
        : {
            effects: [{ type: 'buff', name: 'ashes-of-the-just', kind: 'ashes-of-the-just', stacks: 1, duration: 10 }]
          })
    };

    if (mode === 'recipients') grant.fields.maximumTargets = 0;

    const patched = withPatchPreview(guardianProfession, {
      id: 'fervid-admission',
      label: 'Fervid admission',
      professions: {
        guardian: {
          balanceProfiles: {
            [REWORK.FERVID_CONVICTION]: grant
          },
          skills: {
            ...(mode === 'burning'
              ? { [ashesBurningSkill.id]: { removeEffects: [{ type: 'condition', name: 'Burning' }] } }
              : {})
          }
        }
      }
    });
    const result = runGuardian(
      [wait(100)],
      { specialization: 'Firebrand', patchId: 'fervid-admission', selectedTraitIds: [REWORK.FERVID_CONVICTION] },
      {
        profession: patched,
        timeline: [
          {
            at: 0.01,
            run(runtime) {
              runtime.fireTrigger(swiftScholarPagesGranted, {
                cast: { id: 'refund', skill: runtime.helpers.skillsById.get(ID.SEARING_SPELL) }
              });
            }
          }
        ]
      }
    );
    assert.equal(
      observedRuntime(result).procs.deadline('guardian.firebrand.fervid-conviction') > 0,
      !['buff', 'burning'].includes(mode),
      mode
    );
    assert.equal(state(result).ashes.charges > 0, mode === 'valid', mode);
    assert.equal(
      result.procSteps.some((step) => step.skill === 'Fervid Conviction'),
      mode === 'valid',
      mode
    );
  }
});
