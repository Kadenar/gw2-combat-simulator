import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { mesmerTooltips } from '#gw2/professions/mesmer/app/tooltips.js';
import { cryOfPainConfusion } from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { mesmerSelectedAmbush } from '#gw2/professions/mesmer/specializations/mirage/mechanics/ambush.js';
import { mesmerSelectedInstrument } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-projection.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { createDefaultConfig, runMesmer } from '#tests/helpers/mesmer-simulation.js';

// Intrinsic skills have one patch owner; fixed clone capacity needs no balance profile.
test('Mesmer catalog removes skill profiles and assigns intrinsic specialization policy to traits', () => {
  for (const id of [TRAIT.PSYCHIC_BLADES, TRAIT.WANDERING_MINSTREL, TRAIT.MIRAGE_CLOAK])
    assert.ok(mesmerCatalog.balanceProfilesById.has(id));
  for (const id of [
    'mesmer.core.resources',
    'mesmer.core.mimic',
    'mesmer.virtuoso.bladesong-sorrow',
    'mesmer.troubadour.crescendo'
  ])
    assert.throws(
      () => applyBalanceProfilePatch(mesmerCatalog, { balanceProfiles: { [id]: { fields: { duration: 1 } } } }),
      /unknown balance profile/
    );
});

// Removing a component cannot make a different authored attack become the instrument's afterimage payload.
test('instrument projection retains named strike ownership while Harp intentionally owns no strike', () => {
  const catalog = applySkillPatch(mesmerCatalog, {
    skills: {
      [ID.FLUSTERING_FLUTE]: {
        removeEffects: [{ type: 'strike', name: 'Strike' }],
        addEffects: [{ type: 'strike', name: 'Separate attack', coefficient: 9, hits: 1 }]
      }
    }
  });
  const flute = mesmerSelectedInstrument({ catalog }, ID.FLUSTERING_FLUTE);
  assert.equal(flute.type, undefined);
  assert.ok(flute.conditions.some(({ condition }) => condition === 'Confusion'));
  assert.equal(mesmerSelectedInstrument({ catalog }, ID.HARMONIOUS_HARP).type, undefined);
});

// Selected strike and status components remain independently removable for player and clone consumers.
test('ambush projection does not restore removed Vulnerability or replace its named player strike', () => {
  const catalog = applySkillPatch(mesmerCatalog, {
    skills: {
      [ID.SPLIT_SURGE]: {
        removeEffects: [
          { type: 'strike', name: 'Player attack' },
          { type: 'condition', name: 'Vulnerability' }
        ],
        addEffects: [{ type: 'strike', name: 'Separate attack', coefficient: 9, hits: 1 }]
      }
    }
  });
  const ambush = mesmerSelectedAmbush({ catalog }, ID.SPLIT_SURGE);
  assert.equal(ambush.player.type, undefined);
  assert.equal(ambush.clone.type, 'strike');
  assert.equal(ambush.vulnerability, undefined);
  assert.ok(ambush.player.boons.length > 0);
});

// Ordinary skill additions default to the player and must not disappear while filtering clone templates.
test('Mirage player ambush retains ordinary added effects without an explicit source', () => {
  const profession = withPatchPreview(mesmerProfession, {
    id: 'ambush-owner',
    label: 'Ambush owner',
    professions: {
      mesmer: {
        skills: { [ID.SPLIT_SURGE]: { addEffects: [{ type: 'boon', boon: 'Protection', duration: 4, stacks: 1 }] } }
      }
    }
  });
  const result = runMesmer(
    ['Dodge / Mirage Cloak', 'Split Surge'],
    {
      ...createDefaultConfig(),
      patchId: 'ambush-owner',
      specialization: 'Mirage',
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      initialResource: 0,
      selectedTraitIds: []
    },
    { profession }
  );
  const context = profession.resolvePatch({ id: 'ambush-owner' }).balanceContext;
  const protection = mesmerTooltips.skills[ID.SPLIT_SURGE](
    context,
    context.catalog.skillsById.get(ID.SPLIT_SURGE)
  ).facts.find(({ name }) => name === 'Protection');
  assert.equal(protection.applications, 1);
  assert.deepEqual(result.warnings, []);
  assert.ok(
    result.events.some(
      (event) => event.type === 'buff' && event.kind === 'protection' && event.skillId === ID.SPLIT_SURGE
    )
  );
});

// Flute's specialization override changes only its player's Confusion; ordinary Cry of Pain stays trait-owned.
test('Flute Cry of Pain fields preserve separate trait and skill tuning', () => {
  const catalog = applySkillPatch(mesmerCatalog, {
    skills: {
      [ID.FLUSTERING_FLUTE]: {
        fields: { cryOfPainAdditionalStacks: 4, cryOfPainDurationMultiplier: 1 }
      }
    }
  });
  const context = { catalog, traits: new Set([TRAIT.CRY_OF_PAIN]) };
  const condition = { type: 'condition', condition: 'Confusion', stacks: 3, duration: 6 };
  const flute = catalog.skillsById.get(ID.FLUSTERING_FLUTE);
  assert.deepEqual(cryOfPainConfusion(context, condition, flute), { ...condition, stacks: 7, duration: 12 });
  assert.deepEqual(cryOfPainConfusion(context, condition), { ...condition, stacks: 4, duration: 8 });
});

// The selected signet's cadence and amount feed the existing ready-only resource scheduler.
test('Signet of Illusions skill fields control passive resource generation', () => {
  const profession = withPatchPreview(mesmerProfession, {
    id: 'signet-owner',
    label: 'Signet owner',
    professions: {
      mesmer: { skills: { [ID.SIGNET_OF_ILLUSIONS]: { fields: { pulseInterval: 1, resourceGain: 2 } } } }
    }
  });
  const result = runMesmer(
    ['Ether Bolt', { type: 'wait', durationMs: 700 }],
    {
      ...createDefaultConfig(),
      patchId: 'signet-owner',
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: '',
      initialResource: 0,
      selectedTraitIds: [],
      selectedSkillIds: [ID.SIGNET_OF_ILLUSIONS]
    },
    { profession }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession[STATE.RESOURCE], 2);
});
