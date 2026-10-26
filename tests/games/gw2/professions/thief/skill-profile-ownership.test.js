import assert from 'node:assert/strict';
import test from 'node:test';
import { applySkillPatch, applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Intrinsic minors supply selected resource policy without requiring an explicit trait selection.
for (const [specialization, trait, resource, maximum] of [
  ['Daredevil', TRAIT.PHYSICAL_SUPREMACY, 'endurance', 175],
  ['Deadeye', TRAIT.DEADEYES_GAZE, 'malice', 9],
  ['Specter', TRAIT.SPECTER, 'shadowForce', 125]
]) {
  test(`${specialization} minor owns resource capacity without optional trait selection`, () => {
    const result = runThief(
      [],
      { specialization, selectedTraitIds: [] },
      {
        catalog: (catalog) =>
          applyBalanceProfilePatch(catalog, {
            balanceProfiles: { [trait]: { fields: { maximumStacks: maximum } } }
          })
      }
    );
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);

    if (resource === 'endurance') assert.equal(result.planningState.profession.endurance.maximum, maximum);
    else {
      runtime.resourceController.replace(resource, 999);
      assert.equal(runtime.resourceController.value(resource), maximum);
    }
  });
}

test('Trinket Collector supplies starting artifact uses independently of optional traits', () => {
  const result = runThief(
    [],
    { specialization: 'Antiquary', initialPreSteal: 1, selectedTraitIds: [] },
    {
      catalog: (catalog) =>
        applyBalanceProfilePatch(catalog, {
          balanceProfiles: { [TRAIT.TRINKET_COLLECTOR]: { fields: { maximumStacks: 3 } } }
        })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).profession.specialization.state.artifactUsesRemaining, 3);
});

// A missing condition spends an armed charge, while a missing grant never arms player or ally recipients.
for (const removal of ['grant', 'payload']) {
  test(`Spider Venom ${removal} removal preserves independent recipient settlement`, () => {
    const result = runThief(
      [ID.SPIDER_VENOM, ID.HEARTSEEKER],
      {
        selectedSkillIds: [ID.SPIDER_VENOM],
        allies: { count: 1, strikesPerSecond: 0.001 }
      },
      {
        catalog: (catalog) =>
          applySkillPatch(catalog, {
            skills: {
              [ID.SPIDER_VENOM]:
                removal === 'grant'
                  ? { removeEffects: [{ type: 'buff', name: 'spider-venom' }] }
                  : { sideEffects: { venom: { removeEffects: [{ type: 'condition', name: 'Poisoned' }] } } }
            }
          })
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.some((event) => event.type === 'condition' && event.skillId === ID.SPIDER_VENOM),
      false
    );
    const state = observedRuntime(result).profession.core;
    const charges = (batches) => (batches ?? []).reduce((sum, batch) => sum + batch.charges, 0);
    assert.equal(charges(state.venomChargeBatches[ID.SPIDER_VENOM]), removal === 'grant' ? 0 : 5);
    assert.equal(
      Object.values(state.alliedVenomChargeBatches).reduce((sum, batches) => sum + charges(batches), 0),
      removal === 'grant' ? 0 : 6
    );
  });
}

// Finisher removal cannot delete an independently authored condition or prevent the surviving channel's refund.
test('Malicious Ashen Torment survives final-strike removal and still spends accepted malice', () => {
  const result = runThief(
    [ID.MALICIOUS_ASHEN_ASSAULT],
    {
      specialization: 'Deadeye',
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      initialInitiative: 0
    },
    {
      initialize(runtime) {
        runtime.profession.core.stealthUntil = 10;
        runtime.resourceController.replace('malice', 5);
        Object.assign(runtime.profession.specialization.state, { markedTargetId: 'primary-target', markExpiresAt: 10 });
      },
      catalog: (catalog) =>
        applySkillPatch(catalog, {
          skills: {
            [ID.MALICIOUS_ASHEN_ASSAULT]: {
              removeEffects: [{ type: 'strike', name: 'Malicious Ashen Assault — Final Strike' }]
            }
          }
        })
    }
  );
  assert.deepEqual(result.warnings, []);
  const torment = result.events.find(
    (event) =>
      event.type === 'condition' && event.skillId === ID.MALICIOUS_ASHEN_ASSAULT && event.condition === 'Torment'
  );
  assert.ok(torment);
  assert.equal(torment.duration, 3);
  assert.equal(observedRuntime(result).resourceController.value('malice'), 0);
  assert.ok(observedRuntime(result).resourceController.value('initiative') >= 4);
});

// Canonical actor effects remain independent; removing damage does not remove its summon or companion conditions.
test('Guild actor strike removal preserves conditions and summon expiry', () => {
  const result = runThief(
    [ID.THIEVES_GUILD, { type: 'combat-start' }, { type: 'wait', durationMs: 1500 }],
    {
      selectedSkillIds: [ID.THIEVES_GUILD]
    },
    {
      catalog(catalog) {
        const skill = catalog.skillsById.get(ID.THIEVES_GUILD);
        return applySkillPatch(
          withSkill(catalog, ID.THIEVES_GUILD, {
            castTimeMs: 0,
            duration: 1,
            summonAttack: {
              ...skill.summonAttack,
              summons: [
                {
                  name: 'Fixture',
                  weapon: 'Dagger',
                  weaponStrengthProfileId: 'weapon.dagger',
                  attacks: [{ skillId: 3665, initialDelay: 0 }]
                }
              ]
            }
          }),
          { skills: { 3665: { removeEffects: [{ type: 'strike', name: 'Strike' }] } } }
        );
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  const packets = result.events.filter((event) => event.sourceId === 'thief.thieves-guild');
  assert.equal(
    packets.some((event) => event.type === 'damage'),
    false
  );
  assert.ok(packets.some((event) => event.type === 'condition' && event.condition === 'Poisoned'));
  assert.equal(result.planningState.profession.activeThievesGuild, null);
});

// Old profile targets must fail rather than silently applying an obsolete tuning path.
test('Thief has no skill variants and rejects removed intrinsic profile targets', () => {
  assert.equal(
    thiefCatalog.balanceProfiles.some((profile) => profile.profileKind === 'skill-variant'),
    false
  );
  for (const id of [
    'thief.core.unload-refund',
    'thief.core.spider-venom-proc',
    'thief.core.assassins-signet',
    'thief.daredevil.palm-strike',
    'thief.deadeye.resources',
    'thief.specter.resources',
    'thief.antiquary.resources',
    'thief.antiquary.forged-surfer'
  ])
    assert.throws(
      () => applyBalanceProfilePatch(thiefCatalog, { balanceProfiles: { [id]: { fields: {} } } }),
      /unknown balance profile/
    );
});
