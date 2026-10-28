import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { guardianTooltips } from '#gw2/professions/guardian/app/tooltips.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';

const sources = [
  { owner: 'skills', id: ID.EFFULGENT_STANCE, rotation: ['Effulgent Stance'] },
  { owner: 'skills', id: ID.RADIANT_RESOLVE, rotation: ['Radiant Resolve'] },
  { owner: 'skills', id: ID.DAZZLING_HAMMER, rotation: ['Enter Radiant Forge', 'Luminous Staff', 'Dazzling Hammer'] },
  { owner: 'balanceProfiles', id: TRAIT.SOVEREIGN_OF_LIGHT, rotation: ['Enter Radiant Forge'] },
  { owner: 'balanceProfiles', id: TRAIT.JUSTICE_IS_BLIND, rotation: ['Radiant Justice'] }
];

// Patch each real source independently; attribution stays on its triggering skill while tuning comes from its owner.
function fixture(edits) {
  const profession = withPatchPreview(guardianProfession, {
    id: 'luminary-payloads',
    label: 'Luminary payload ownership',
    professions: { guardian: edits }
  });
  return {
    context: profession.resolvePatch({ id: 'luminary-payloads' }).balanceContext,
    run(rotation, config = {}) {
      const result = runGuardian(
        rotation,
        { specialization: 'Luminary', patchId: 'luminary-payloads', ...config },
        { profession }
      );
      assert.deepEqual(result.warnings, []);
      return result;
    }
  };
}

test('each native Light Aura grant reads only its skill or trait payload', () => {
  for (const source of sources) {
    const patched = fixture({
      [source.owner]: { [source.id]: { effects: [{ type: 'aura', name: 'Light Aura', duration: 9 }] } }
    });
    const config = { selectedTraitIds: source.owner === 'balanceProfiles' ? [source.id] : [] };
    const result = patched.run(source.rotation, config);
    const aura = result.events.find((event) => event.type === 'aura' && event.aura === 'Light Aura');
    assert.ok(aura, String(source.id));
    assert.equal(aura.duration, 9);
    assert.equal(result.planningState.profession[STATE.LIGHT_AURA_UNTIL], aura.at + 9);

    // Editing one source cannot change another source's duration, even when both grants share the same tracker.
    const other = source.id === ID.RADIANT_RESOLVE ? sources[0] : sources[1];
    const independent = patched.run(other.rotation);
    assert.equal(independent.events.find((event) => event.type === 'aura')?.duration, 4);

    const describe =
      source.owner === 'skills' ? guardianTooltips.skills[source.id] : guardianTooltips.traits[source.id];
    const entity = source.owner === 'skills' ? patched.context.catalog.skillsById.get(source.id) : { id: source.id };
    assert.ok(
      describe(patched.context, entity).facts.some((fact) => fact.name === 'Light Aura' && fact.detail.includes('9s'))
    );
  }
});

test('removing a native aura grant preserves other sources and independent skill or trait effects', () => {
  for (const source of sources) {
    const patched = fixture({
      [source.owner]: { [source.id]: { removeEffects: [{ type: 'aura', name: 'Light Aura' }] } }
    });
    const config = { selectedTraitIds: source.owner === 'balanceProfiles' ? [source.id] : [] };
    const result = patched.run(source.rotation, config);
    assert.equal(
      result.events.some((event) => event.type === 'aura'),
      false,
      String(source.id)
    );
    assert.equal(result.planningState.profession[STATE.LIGHT_AURA_UNTIL], 0);

    if (source.id === ID.RADIANT_RESOLVE)
      assert.equal(result.planningState.profession[STATE.RADIANT_RESOLVE_ARMED], true);

    if (source.id === ID.DAZZLING_HAMMER)
      assert.ok(result.events.some((event) => event.type === 'damage' && event.skillId === source.id));

    if (source.id === TRAIT.JUSTICE_IS_BLIND)
      assert.ok(result.events.some((event) => event.type === 'condition' && event.condition === 'Blindness'));

    const other = source.id === ID.RADIANT_RESOLVE ? sources[0] : sources[1];
    assert.ok(patched.run(other.rotation).events.some((event) => event.type === 'aura'));
  }
});

test('Effulgent skill tuning controls its counting window, capped detonation, and tooltip', () => {
  const patched = fixture({
    skills: {
      [ID.EFFULGENT_STANCE]: {
        fields: { duration: 3, maximumStacks: 2, damageIncreasePerStack: 0.4 },
        effects: [{ type: 'strike', name: 'Strike', coefficient: 0.7 }],
        removeEffects: [{ type: 'aura', name: 'Light Aura' }]
      }
    }
  });
  const result = patched.run(['Effulgent Stance', 'Whirling Wrath', { type: 'wait', durationMs: 4000 }], {
    primaryWeapon: 'Greatsword'
  });
  const detonation = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.EFFULGENT_STANCE_DAMAGE
  );
  assert.ok(detonation);
  assert.equal(detonation.coefficient, 0.7 + 2 * 0.4);
  const activation = result.events.find((event) => event.type === 'action' && event.skillId === ID.EFFULGENT_STANCE);
  assert.equal(detonation.at - activation.at, 3);
  assert.ok(result.events.some((event) => event.type === 'control' && event.skillId === ID.EFFULGENT_STANCE_DAMAGE));
  assert.equal(result.planningState.profession[STATE.EFFULGENT_STACKS], 0);
  assert.equal(result.planningState.profession[STATE.EFFULGENT_ACTIVE_UNTIL], 0);
  const facts = guardianTooltips.skills[ID.EFFULGENT_STANCE](patched.context, { id: ID.EFFULGENT_STANCE }).facts;
  assert.equal(facts.find((fact) => fact.name === 'Maximum counted hits').detail, '2');
  assert.equal(facts.find((fact) => fact.name === 'Stance duration').detail, '3s');
  assert.equal(facts.find((fact) => fact.name === 'Additional coefficient per counted hit').detail, '0.4');
});
