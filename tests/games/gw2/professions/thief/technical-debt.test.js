import { describeSimulationSkill, describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { thiefTooltips } from '#gw2/professions/thief/app/tooltips.js';
import { beginThiefStealthAttack, grantThiefStealth } from '#gw2/professions/thief/core/mechanics/stealth.js';
import { thiefCoreModule } from '#gw2/professions/thief/core/module.js';
import { modifyThiefLifeSiphon } from '#gw2/professions/thief/core/mechanics/life-siphon.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Exercise the public patch path so runtime and presentation must resolve the same selected tuning.
function patched(balanceProfiles) {
  return withPatchPreview(thiefProfession, {
    id: 'thief-debt',
    label: 'Thief debt regression',
    professions: { thief: { balanceProfiles } }
  });
}

// Initialized pools and tooltips follow the selected trait cap.
test('Maleficent Seven owns the raised malice cap in previews and tooltips', () => {
  assert.equal(runThief([], { specialization: 'Deadeye' }).planningState.profession.malice.maximum, 5);
  assert.equal(
    runThief([], { specialization: 'Deadeye', selectedTraitIds: [TRAIT.MALEFICENT_SEVEN] }).planningState.profession
      .malice.maximum,
    7
  );
  const context = patched({
    [TRAIT.MALEFICENT_SEVEN]: { fields: { maximumStacks: 11 } }
  }).balanceContextFor('thief-debt');
  const trait = describeSimulationTrait(context, { id: TRAIT.MALEFICENT_SEVEN }, thiefTooltips);
  const mark = describeSimulationSkill(context, context.catalog.skillsById.get(ID.DEADEYES_MARK), thiefTooltips);
  assert.equal(trait.facts.find((fact) => fact.name === 'Maximum malice').detail, '11');
  assert.equal(mark.facts.find((fact) => fact.name === 'Maximum malice').detail, '5');
  assert.equal(mark.facts.find((fact) => fact.name === 'Maximum malice with Maleficent Seven').detail, '11');
});

test('Lead Attacks selected cap and bonus govern grants, damage, siphons and facts', () => {
  const profession = patched({
    [TRAIT.LEAD_ATTACKS]: { fields: { maximumStacks: 2, damageIncreasePerStack: 0.05 } }
  });
  const result = runThief(
    ['Death Blossom'],
    { patchId: 'thief-debt', selectedTraitIds: [TRAIT.LEAD_ATTACKS] },
    { profession }
  );
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  assert.equal(runtime.profession.core.leadAttackExpirations.length, 2);
  const rule = thiefCoreModule.modifiers.modifierRules.find((rule) => rule.id === 'thief.lead-attacks');
  const context = profession.balanceContextFor('thief-debt');
  // An excess seeded stack also checks the modifier's cap independently of grant capping.
  runtime.profession.core.leadAttackExpirations.push(runtime.time + 10);
  const modifierContext = { ...context, runtime, config: runtime.config, time: runtime.time };
  for (const event of [{ actorType: 'player' }, { actorType: 'player', condition: 'Poisoned' }]) {
    assert.equal(rule.when({ ...modifierContext, event }), true);
    assert.equal(rule.amount({ ...modifierContext, event }), 0.1);
  }

  assert.equal(
    modifyThiefLifeSiphon(runtime, {
      actorType: 'player',
      at: runtime.time,
      damageKind: 'life-steal',
      flatDamage: 100
    }).flatStrikeMultiplier,
    1.1
  );
  const { facts } = describeSimulationTrait(context, { id: TRAIT.LEAD_ATTACKS }, thiefTooltips);
  assert.equal(facts.find((fact) => fact.name === 'Strike and condition damage per stack').detail, '+5%');
  assert.equal(facts.find((fact) => fact.name === 'Maximum stacks').detail, '2');
});

test('stealth entry and exits honor selected linger and venom grants without repeating entry on extension', () => {
  for (const attack of [false, true]) {
    const grants = [];
    const result = runThief(
      [{ type: 'wait', durationMs: 2000 }],
      { selectedTraitIds: [TRAIT.HIDDEN_KILLER, TRAIT.LEECHING_VENOMS] },
      {
        catalog: (catalog) =>
          withProfile(withProfile(catalog, TRAIT.HIDDEN_KILLER, { duration: 6 }), TRAIT.LEECHING_VENOMS, {
            resourceGain: 2,
            durationMultiplier: 7,
            maximumStacks: 3
          }),
        probes: [
          [
            1,
            (runtime) => {
              grantThiefStealth(runtime, runtime.helpers.skillsById.get(ID.BACKSTAB), 3);
              grants.push(structuredClone(runtime.profession.core.venomChargeBatches[ID.SPIDER_VENOM]));
            }
          ],
          [
            1.5,
            (runtime) => {
              grantThiefStealth(runtime, runtime.helpers.skillsById.get(ID.BACKSTAB), 1);
              grants.push(structuredClone(runtime.profession.core.venomChargeBatches[ID.SPIDER_VENOM]));
            }
          ],
          ...(attack
            ? [
                [
                  2,
                  (runtime) =>
                    beginThiefStealthAttack(runtime, {
                      skill: runtime.helpers.skillsById.get(ID.BACKSTAB),
                      id: 'test-attack'
                    })
                ]
              ]
            : [])
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      grants[0].map(({ charges, expiresAt }) => [charges, expiresAt]),
      [[2, 8]]
    );
    assert.deepEqual(grants[1], grants[0]);
    const core = observedRuntime(result).profession.core;
    assert.equal(core.hiddenKillerUntil, attack ? 8 : 11);
    assert.deepEqual(
      core.venomChargeBatches[ID.SPIDER_VENOM].map(({ charges, expiresAt }) => [charges, expiresAt]),
      attack
        ? [
            [2, 8],
            [1, 9]
          ]
        : [[2, 8]]
    );
  }
});

// Named effect identities keep surviving facts attached to their runtime trigger after removals or reordering.
for (const [traitId, labels] of [
  [TRAIT.SHADESTEP, { alacrity: 'Grasping Shadows', protection: "Dawn's Repose", aegis: 'Mind Shock' }],
  [
    TRAIT.POSSESSIVE_HOARDER,
    { might: 'offensive artifact', protection: 'defensive artifact', alacrity: 'any artifact' }
  ]
]) {
  test(`${traitId} tooltip labels survive effect removal and reordering`, () => {
    for (const removed of [null, Object.keys(labels)[0]]) {
      const context = patched(
        removed
          ? {
              [traitId]: { removeEffects: [{ type: 'boon', name: removed }] }
            }
          : {}
      ).balanceContextFor('thief-debt');
      const profile = context.catalog.balanceProfilesById.get(traitId);
      const catalog = withProfile(context.catalog, traitId, { effects: [...profile.effects].reverse() });
      const { facts } = describeSimulationTrait({ ...context, catalog }, { id: traitId }, thiefTooltips);
      for (const [boon, label] of Object.entries(labels)) {
        const fact = facts.find((fact) => fact.name.toLowerCase() === boon);
        if (boon === removed) assert.equal(fact, undefined);
        else assert.ok(fact?.detail.includes(label), `${boon}: ${JSON.stringify(fact)}`);
      }
    }
  });
}
