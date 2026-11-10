// Live balance must not apply preview bonuses twice or share Meteor Shower falloff across casts.
import assert from 'node:assert/strict';
import test from 'node:test';

import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { cast, wait } from '#tests/helpers/commands.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';

test('Elementalist has no remaining active preview overrides', () => {
  assert.equal(activePatchPreview, null);
  const profession = withActivePatchPreview(elementalistProfession);
  assert.deepEqual(profession.patchOverviewFor({}, []), []);
});

test('overlapping Meteor Showers keep their damage falloff per activation', () => {
  const result = runElementalist(
    [cast(ID.METEOR_SHOWER), cast(ID.METEOR_SHOWER), wait(12000)],
    { primaryWeapon: 'Staff', startAttunement: 'Fire', selectedTraitIds: [] },
    { catalog: (catalog) => withSkill(catalog, ID.METEOR_SHOWER, { cooldown: 0 }) }
  );
  assert.deepEqual(result.warnings, []);
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.METEOR_SHOWER
  );
  const activations = [...Map.groupBy(strikes, (event) => event.activationId).values()];
  assert.equal(activations.length, 2);
  const [first, second] = activations;
  assert.ok(first.at(-1).at > second[0].at, 'the casts must overlap');
  assert.equal(second[0].coefficient, 2);
  assert.deepEqual(
    second.map((event) => event.coefficient),
    first.map((event) => event.coefficient)
  );
});
