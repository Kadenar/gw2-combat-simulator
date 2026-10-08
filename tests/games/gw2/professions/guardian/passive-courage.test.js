import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS as DH_PROFILE } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as FB_PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { runGuardian as run } from '#tests/helpers/guardian-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const owners = [
  { specialization: 'Dragonhunter', skillId: ID.SHIELD_OF_COURAGE, profileId: DH_PROFILE.passiveCourage },
  { specialization: 'Firebrand', skillId: ID.TOME_OF_COURAGE, profileId: FB_PROFILE.passiveCourage }
];

/** Short authored recharge windows expose dormancy transitions without depending on benchmark rotations. */
function fixture(owner, { cooldown = 5.3, interval = 2, removed = false, selectedTraitIds = [] } = {}) {
  const catalog = guardianProfession.catalog;
  const balanceProfiles = {
    [owner.profileId]: {
      fields: { pulseInterval: { from: catalog.balanceProfilesById.get(owner.profileId).pulseInterval, to: interval } },
      ...(removed ? { removeEffects: [{ type: 'boon', name: 'aegis' }] } : {})
    },
    [TRAIT.INDOMITABLE_COURAGE]: {
      fields: {
        pulseInterval: { from: catalog.balanceProfilesById.get(TRAIT.INDOMITABLE_COURAGE).pulseInterval, to: 4 }
      }
    }
  };
  const skills = {};
  if (owner.specialization === 'Firebrand') {
    balanceProfiles[FB_PROFILE.tomeCourage] = {
      fields: { cooldown: { from: catalog.balanceProfilesById.get(FB_PROFILE.tomeCourage).cooldown, to: cooldown } }
    };
  } else {
    skills[owner.skillId] = {
      fields: { cooldown: { from: catalog.skillsById.get(owner.skillId).cooldown, to: cooldown } }
    };
  }

  const profession = withPatchPreview(guardianProfession, {
    id: 'passive-courage-contract',
    label: 'Passive Courage contract',
    professions: { guardian: { balanceProfiles, skills } }
  });
  return (rotation) =>
    run(
      rotation,
      {
        specialization: owner.specialization,
        patchId: 'passive-courage-contract',
        selectedTraitIds,
        allies: { count: 3 }
      },
      { profession }
    );
}

function passiveEvents(result, owner) {
  const skillName = guardianProfession.catalog.skillsById.get(owner.skillId).name;
  return result.resolvedEvents.filter((event) => event.name === `${skillName} — Passive Aegis`);
}

for (const owner of owners) {
  test(`${owner.specialization} Courage skips dormancy and resumes on its original cadence with self attribution`, () => {
    const result = fixture(owner)([wait(100), owner.skillId, wait(8500)]);
    assert.deepEqual(result.warnings, []);
    const readyAt = observedRuntime(result).profession.core.virtueReadyAt.courage;
    const events = passiveEvents(result, owner);
    assert.ok(readyAt > 2, 'the scenario must suppress a scheduled wake');
    assert.ok(
      events.some((event) => event.at === 0),
      'the initial passive is available before activation'
    );
    assert.equal(
      events.some((event) => event.at > 0 && event.at < readyAt),
      false
    );
    assert.equal(events.find((event) => event.at >= readyAt)?.at, Math.ceil(readyAt / 2) * 2);
    for (const event of events) {
      assert.equal(event.source, 'guardian');
      assert.equal(event.sourceId, owner.skillId);
      assert.equal(event.skillId, owner.skillId);
      assert.equal(event.skillName, guardianProfession.catalog.skillsById.get(owner.skillId).name);
      assert.equal(event.actorType, 'player');
      assert.equal(event.kind, 'aegis');
      assert.equal(event.resolvedAudience.alliedPlayerCount, 0);
      assert.equal(event.resolvedAudience.includesSelf, true);
    }
  });

  test(`${owner.specialization} Renewed Focus restores Courage eligibility without restarting its cadence`, () => {
    const simulate = fixture(owner, { cooldown: 30 });
    const prefix = [
      wait(100),
      owner.skillId,
      ...(owner.specialization === 'Firebrand' ? [ID.STOW_TOME] : []),
      wait(2500)
    ];
    const dormant = simulate(prefix);
    const oldReadyAt = observedRuntime(dormant).profession.core.virtueReadyAt.courage;
    const result = simulate([...prefix, ID.RENEWED_FOCUS, wait(3000)]);
    assert.deepEqual(dormant.warnings, []);
    assert.deepEqual(result.warnings, []);
    const resetAt = result.events.find((event) => event.type === 'action' && event.skillId === ID.RENEWED_FOCUS).endsAt;
    const events = passiveEvents(result, owner);
    assert.ok(resetAt < oldReadyAt);
    assert.equal(
      events.some((event) => event.at > 0 && event.at < resetAt),
      false
    );
    const resumed = events.find((event) => event.at >= resetAt);
    // A same-time passive wake settles before the reset completion, so the following cadence owns the first grant.
    assert.equal(resumed?.at, (Math.floor(resetAt / 2) + 1) * 2);
    assert.ok(resumed.at < oldReadyAt, 'reset must make the passive eligible before its previous recharge deadline');
  });

  test(`${owner.specialization} removed Courage Aegis cannot deliver even with its passive trait selected`, () => {
    const result = fixture(owner, {
      removed: true,
      selectedTraitIds: [owner.specialization === 'Firebrand' ? TRAIT.STOIC_DEMEANOR : TRAIT.INDOMITABLE_COURAGE]
    })([wait(100), owner.skillId, wait(8500)]);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(passiveEvents(result, owner), []);
  });

  test(`${owner.specialization} a disabled Courage interval stops passive delivery`, () => {
    const result = fixture(owner, { interval: 0 })([wait(3000)]);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(passiveEvents(result, owner), []);
  });
}

test('Indomitable Courage selects the trait cadence when Dragonhunter recharge ends between wakes', () => {
  const owner = owners[0];
  const result = fixture(owner, { selectedTraitIds: [TRAIT.INDOMITABLE_COURAGE] })([
    wait(100),
    owner.skillId,
    wait(8500)
  ]);
  assert.deepEqual(result.warnings, []);
  const readyAt = observedRuntime(result).profession.core.virtueReadyAt.courage;
  const events = passiveEvents(result, owner);
  assert.ok(readyAt > 4 && readyAt < 6);
  assert.equal(
    events.some((event) => event.at > 0 && event.at < readyAt),
    false
  );
  assert.equal(events.find((event) => event.at >= readyAt)?.at, 8);
});

test('Stoic Demeanor keeps Firebrand Courage eligible while the tome remains dormant', () => {
  const owner = owners[1];
  for (const retained of [false, true]) {
    const result = fixture(owner, { selectedTraitIds: retained ? [TRAIT.STOIC_DEMEANOR] : [] })([
      wait(100),
      owner.skillId,
      wait(2500)
    ]);
    assert.deepEqual(result.warnings, []);
    assert.ok(observedRuntime(result).profession.core.virtueReadyAt.courage > observedRuntime(result).time);
    assert.equal(
      passiveEvents(result, owner).some((event) => event.at === 2),
      retained
    );
  }
});
