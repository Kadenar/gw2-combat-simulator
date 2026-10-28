import assert from 'node:assert/strict';
import test from 'node:test';

import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { elementalistTooltips } from '#gw2/professions/elementalist/app/tooltips.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { WEAVER_SPEAR_BUFFS } from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/spear.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

const skills = Object.keys(WEAVER_SPEAR_BUFFS).map((id) => elementalistCatalog.skillsById.get(Number(id)));
const wait = (durationMs) => ({ type: 'wait', durationMs });
const cast = (skillId, fields = {}) => ({ type: 'cast', skillId, ...fields });

// Minimal native scenarios isolate buff ownership and impact ordering without relying on a saved rotation.
function run(skill, rotation, options = {}) {
  const { patchId = 'current', ...simulationOptions } = options;
  const [startAttunement, secondaryAttunement] = skill.attunement.split('+');
  return runElementalist(
    rotation,
    {
      patchId,
      specialization: 'Weaver',
      primaryWeapon: 'Spear',
      startAttunement,
      secondaryAttunement,
      selectedTraitIds: [],
      selectedSkillIds: [ID.ARCANE_BLAST]
    },
    simulationOptions
  );
}

const strikes = (result, id) =>
  result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === id);
const liveBuffs = (result, kind, at) => observedRuntime(result).mechanics.combat.activeBuffStacks(kind, at);

test('all spear duals arm without damage and consume once on a non-spear strike', () => {
  for (const skill of skills) {
    const armed = run(skill, [cast(skill.id), wait(1000)]);
    assert.deepEqual(armed.warnings, [], skill.name);
    assert.deepEqual(strikes(armed, skill.id), [], skill.name);
    assert.equal(liveBuffs(armed, WEAVER_SPEAR_BUFFS[skill.id], 1), 1);

    const result = run(skill, [cast(skill.id), wait(1000), cast(ID.ARCANE_BLAST), wait(1000), cast(ID.ARCANE_BLAST)]);
    assert.deepEqual(result.warnings, [], skill.name);
    const [trigger] = strikes(result, ID.ARCANE_BLAST);
    const followups = strikes(result, skill.id);
    assert.equal(followups.length, 1, `${skill.name} consumes one charge`);
    assert.equal(followups[0].at, trigger.at, skill.name);
    assert.equal(followups[0].triggeredBy, 'Arcane Blast');
    assert.equal(followups[0].activationId, result.steps.find((step) => step.skillId === skill.id).activationId);
    assert.notEqual(followups[0].activationId, trigger.activationId);
    assert.equal(followups[0].skillWeapon, 'Spear');
    assert.ok(followups[0].damage > 0);
    assert.equal(liveBuffs(result, WEAVER_SPEAR_BUFFS[skill.id], trigger.at), 0);
  }
});

test('spear follow-ups expire at the buff boundary and refresh without stacking', () => {
  for (const skill of skills) {
    const expired = run(skill, [cast(skill.id), wait(5000), cast(ID.ARCANE_BLAST)]);
    assert.deepEqual(expired.warnings, [], skill.name);
    assert.deepEqual(strikes(expired, skill.id), [], skill.name);

    const refreshed = run(skill, [cast(skill.id), wait(4000), cast(skill.id), wait(2000), cast(ID.ARCANE_BLAST)], {
      catalog: (catalog) => withSkill(catalog, skill.id, { cooldown: 0 })
    });
    assert.deepEqual(refreshed.warnings, [], skill.name);
    const [followup] = strikes(refreshed, skill.id);
    assert.equal(strikes(refreshed, skill.id).length, 1, skill.name);
    assert.equal(
      followup.activationId,
      refreshed.steps.filter((step) => step.skillId === skill.id).at(-1).activationId
    );
  }
});

test('a strike already in flight consumes the buff; a missed strike leaves it armed', () => {
  const skill = elementalistCatalog.skillsById.get(ID.ELUTRIATE);
  for (const offTarget of [false, true]) {
    const result = run(skill, [
      cast(ID.LIGHTNING_JAVELIN, { offTarget }),
      cast(skill.id, { concurrentOffsetMs: 120 }),
      wait(100),
      cast(ID.ARCANE_BLAST)
    ]);
    assert.deepEqual(result.warnings, []);
    const trigger = strikes(result, offTarget ? ID.ARCANE_BLAST : ID.LIGHTNING_JAVELIN)[0];
    const [followup] = strikes(result, skill.id);
    assert.equal(followup.at, trigger.at);
    assert.equal(followup.triggeredBy, trigger.skillName);
    assert.equal(strikes(result, skill.id).length, 1);
    const conditions = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillId === skill.id
    );
    assert.deepEqual([...new Set(conditions.map((event) => event.condition))].sort(), ['Chilled', 'Vulnerability']);
    assert.ok(conditions.every((event) => event.at === trigger.at));
  }
});

test('condition damage, zero-damage packets, and companion strikes cannot consume a player follow-up', () => {
  const skill = elementalistCatalog.skillsById.get(ID.FROSTFIRE_WARD);
  const result = run(skill, [cast(skill.id), wait(2000), cast(ID.ARCANE_BLAST)], {
    timeline: [
      {
        at: 0.5,
        run(runtime) {
          for (const event of [
            { type: 'condition', condition: 'Burning', stacks: 1, duration: 1, actorType: 'player' },
            { type: 'damage', coefficient: 0, actorType: 'player', weaponStrength: 1000 },
            { type: 'damage', coefficient: 1, actorType: 'summon', summonOwner: 'fixture', weaponStrength: 1000 }
          ]) {
            runtime.mechanics.effects.emit({
              kind: 'packet',
              event: { ...event, at: 0.5, source: 'fixture', sourceId: 'fixture', skillName: 'Fixture' }
            });
          }
        }
      }
    ]
  });
  assert.deepEqual(result.warnings, []);
  const [followup] = strikes(result, skill.id);
  assert.equal(followup.at, strikes(result, ID.ARCANE_BLAST)[0].at);
  assert.equal(strikes(result, skill.id).length, 1);
});

test('different spear buffs share the next strike without consuming each other during activation', () => {
  const result = run(elementalistCatalog.skillsById.get(ID.FROSTFIRE_WARD), [
    'Frostfire Ward',
    'Air Attunement',
    'Galvanize',
    'Earth Attunement',
    'Shale Storm',
    'Water Attunement',
    'Soothing Burst',
    'Fire Attunement',
    'Earth Attunement',
    'Fiery Impact',
    'Water Attunement',
    'Air Attunement',
    'Elutriate',
    wait(1000),
    'Arcane Blast'
  ]);
  assert.deepEqual(result.warnings, []);
  const [trigger] = strikes(result, ID.ARCANE_BLAST);
  for (const skill of skills) {
    const followups = strikes(result, skill.id);
    assert.equal(followups.length, 1, skill.name);
    assert.equal(followups[0].at, trigger.at, skill.name);
    assert.equal(followups[0].triggeredBy, trigger.skillName, skill.name);
  }
});

test('spear buff grants and follow-up payloads remain independently patchable', () => {
  const skill = elementalistCatalog.skillsById.get(ID.GALVANIZE);
  for (const removed of ['grant', 'payload']) {
    const result = run(skill, [cast(skill.id), wait(1000), cast(ID.ARCANE_BLAST)], {
      catalog: (catalog) =>
        applySkillPatch(catalog, {
          skills: {
            [skill.id]: {
              sideEffects: {
                'additional-strike': {
                  removeEffects: [
                    removed === 'grant'
                      ? { type: 'buff', name: skill.name }
                      : { type: 'strike', name: `${skill.name} - Additional Strike` }
                  ]
                }
              }
            }
          }
        })
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(strikes(result, skill.id), []);
    // Removing either deferred component leaves immediate self benefits intact.
    assert.ok(
      result.resolvedEvents.some((event) => event.type === 'buff' && event.kind === 'might' && event.stacks === 3)
    );
    assert.ok(
      result.resolvedEvents.some((event) => event.type === 'buff' && event.kind === 'superspeed' && event.stacks === 1)
    );
  }
});

test('selected spear action patches control expiry, sibling conditions, and qualified tooltip facts', () => {
  const skill = elementalistCatalog.skillsById.get(ID.FIERY_IMPACT);
  const profession = withPatchPreview(elementalistProfession, {
    id: 'spear-followup',
    label: 'Spear follow-up',
    professions: {
      elementalist: {
        skills: {
          [skill.id]: {
            sideEffects: {
              'additional-strike': {
                effects: [
                  { type: 'buff', name: skill.name, duration: 1 },
                  { type: 'strike', coefficient: 4 },
                  { type: 'condition', condition: 'Burning', stacks: 2, duration: 9 }
                ],
                removeEffects: [{ type: 'condition', condition: 'Bleeding' }]
              }
            }
          }
        }
      }
    }
  });

  // The selected window gates every surviving reward; removing one condition cannot remove its siblings.
  for (const elapsed of [500, 1500]) {
    const result = run(skill, [cast(skill.id), wait(elapsed), cast(ID.ARCANE_BLAST)], {
      profession,
      patchId: 'spear-followup'
    });
    assert.deepEqual(result.warnings, []);
    const followups = strikes(result, skill.id);
    const conditions = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillId === skill.id
    );

    if (elapsed < 1000) {
      assert.equal(followups.length, 1);
      assert.equal(followups[0].coefficient, 4);
      assert.equal(
        conditions.reduce((sum, event) => sum + event.stacks, 0),
        2
      );
      assert.ok(conditions.every((event) => event.condition === 'Burning' && event.duration === 9));
      assert.ok(conditions.every((event) => event.at === strikes(result, ID.ARCANE_BLAST)[0].at));
    } else {
      assert.deepEqual(followups, []);
      assert.deepEqual(conditions, []);
    }
  }

  const context = profession.resolvePatch({ id: 'spear-followup' }).balanceContext;
  const model = describeSimulationSkill(context, context.catalog.skillsById.get(skill.id), elementalistTooltips);
  assert.ok(model.facts.some((fact) => fact.detail.includes('1s') && fact.detail.includes('follow-up window')));
  assert.ok(
    model.facts.some(
      (fact) => fact.detail.includes('4 coefficient') && fact.detail.includes('on the next qualifying strike')
    )
  );
  assert.ok(model.facts.some((fact) => fact.name === 'Burning' && fact.stacks === 2 && fact.detail.includes('9s')));
  assert.ok(!model.facts.some((fact) => fact.name === 'Bleeding'));
});

test('removing a spear follow-up strike retains its conditions and consumes the armed buff once', () => {
  const skill = elementalistCatalog.skillsById.get(ID.FIERY_IMPACT);
  const result = run(skill, [cast(skill.id), wait(500), cast(ID.ARCANE_BLAST), wait(500), cast(ID.ARCANE_BLAST)], {
    catalog: (catalog) =>
      applySkillPatch(catalog, {
        skills: { [skill.id]: { sideEffects: { 'additional-strike': { removeEffects: [{ type: 'strike' }] } } } }
      })
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(strikes(result, skill.id), []);
  const conditions = result.resolvedEvents.filter((event) => event.type === 'condition' && event.skillId === skill.id);
  assert.deepEqual([...new Set(conditions.map((event) => event.condition))].sort(), ['Bleeding', 'Burning']);
  const [trigger] = strikes(result, ID.ARCANE_BLAST);
  assert.ok(conditions.every((event) => event.at === trigger.at));
  assert.equal(liveBuffs(result, WEAVER_SPEAR_BUFFS[skill.id], trigger.at), 0);
});

test('active balance preview changes deferred spear coefficients in combat and tooltips', () => {
  const profession = withPatchPreview(elementalistProfession, activePatchPreview);
  for (const [id, coefficient] of [
    [ID.SHALE_STORM, 2],
    [ID.FIERY_IMPACT, 2.25],
    [ID.GALVANIZE, 3.1]
  ]) {
    const skill = elementalistCatalog.skillsById.get(id);
    const result = run(skill, [cast(id), wait(1000), cast(ID.ARCANE_BLAST)], {
      profession,
      patchId: activePatchPreview.id
    });
    assert.deepEqual(result.warnings, [], skill.name);
    assert.equal(strikes(result, id)[0].coefficient, coefficient, skill.name);
    const context = profession.resolvePatch({ id: activePatchPreview.id }).balanceContext;
    const model = describeSimulationSkill(context, context.catalog.skillsById.get(id), elementalistTooltips);
    assert.ok(
      model.facts.some(
        (fact) =>
          fact.detail.includes(`${coefficient} coefficient`) && fact.detail.includes('on the next qualifying strike')
      ),
      skill.name
    );
  }
});

test('spear blast finishers select fields at the consuming hit and retain the granting skill', () => {
  for (const id of [ID.FIERY_IMPACT, ID.SOOTHING_BURST]) {
    const skill = elementalistCatalog.skillsById.get(id);
    const result = run(skill, [cast(id), wait(1000), cast(ID.ARCANE_BLAST)], {
      // A field created after arming must still be available to the deferred blast.
      timeline: [
        {
          at: 0.5,
          run(runtime) {
            runtime.mechanics.effects.emit({
              kind: 'packet',
              event: {
                type: 'combo_field',
                at: 0.5,
                fieldId: 'followup:fire',
                fieldType: 'Fire',
                expiresAt: 2,
                ownerId: 'elementalist',
                ownerActorType: 'player',
                actorType: 'player',
                source: 'Fixture field',
                sourceId: 'fixture.field'
              }
            });
          }
        }
      ]
    });
    assert.deepEqual(result.warnings, [], skill.name);
    const combos = result.resolvedEvents.filter((event) => event.type === 'combo' && event.skillId === id);
    assert.equal(combos.length, 1, skill.name);
    assert.equal(combos[0].fieldId, 'followup:fire');
    assert.equal(combos[0].finisherType, 'Blast');
    assert.equal(combos[0].at, strikes(result, ID.ARCANE_BLAST)[0].at);
    assert.equal(combos[0].activationId, result.steps.find((step) => step.skillId === id).activationId);
  }
});
