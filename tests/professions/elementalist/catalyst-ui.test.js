import assert from 'node:assert/strict';
import test from 'node:test';

import { paletteView } from '#gw2/app/rotation/palette/model.js';
import { elementalistAppAdapter } from '#gw2/content/professions/elementalist/app/app-definition.js';
import { elementalistProfession } from '#gw2/content/professions/elementalist/definition.js';
import { ELEMENTALIST_JADE_SPHERE_SKILL_IDS } from '#gw2/content/professions/elementalist/data/ids.js';

const sphereIds = Object.values(ELEMENTALIST_JADE_SPHERE_SKILL_IDS);
const sphereNames = [
  'Deploy Jade Sphere (Fire)',
  'Deploy Jade Sphere (Water)',
  'Deploy Jade Sphere (Air)',
  'Deploy Jade Sphere (Earth)'
];

test('Catalyst exposes every Jade Sphere beside its energy in the rotation palette', () => {
  const context = {
    specialization: 'Catalyst',
    catalog: elementalistProfession.catalog,
    professionState: {
      primaryAttunement: 'Fire',
      energy: 30
    }
  };
  const group = paletteView(elementalistProfession, context).find(
    (candidate) => candidate.id === 'elementalist-catalyst-spheres'
  );

  assert.ok(group);
  assert.equal(group.label, 'F5');
  assert.equal(group.resourceAnchor, true);
  assert.deepEqual(group.skillIds, sphereIds);
  assert.deepEqual(
    group.skillIds.map((id) => elementalistProfession.catalog.skillsById.get(id)?.name),
    sphereNames
  );
  assert.equal(
    new Set(group.skillIds.map((id) => elementalistProfession.catalog.skillsById.get(id)?.icon)).size,
    sphereIds.length
  );
});

test('Catalyst exposes Jade Spheres through the native profession skill bar', () => {
  const group = elementalistProfession.ui
    .skillBarGroups({
      specialization: 'Catalyst',
      catalog: elementalistProfession.catalog
    })
    .find((candidate) => candidate.id === 'elementalist-catalyst-spheres');

  assert.ok(group);
  assert.equal(group.id, 'elementalist-catalyst-spheres');
  assert.deepEqual(group.skillIds, sphereIds);
});

test('Catalyst energy exposes its native compact-bar styling hook', () => {
  const [energy] = elementalistProfession.ui.resourceViews({
    specialization: 'Catalyst',
    professionState: { energy: 20 }
  });

  assert.equal(energy.id, 'catalyst-energy');
  assert.equal(energy.displayMode, 'bar');
  assert.equal(energy.pipStyle, 'compact-profession-resource-catalyst-energy');
});

test('Catalyst sphere palette availability reflects attunement and energy', () => {
  const fireSphere = elementalistProfession.catalog.skillsById.get(ELEMENTALIST_JADE_SPHERE_SKILL_IDS.Fire);
  const waterSphere = elementalistProfession.catalog.skillsById.get(ELEMENTALIST_JADE_SPHERE_SKILL_IDS.Water);
  const context = {
    specialization: 'Catalyst',
    professionState: {
      primaryAttunement: 'Fire',
      energy: 30
    }
  };

  assert.deepEqual(elementalistProfession.ui.paletteSkillAvailability(context, fireSphere), {
    available: true,
    message: ''
  });
  assert.match(
    elementalistProfession.ui.paletteSkillAvailability(context, waterSphere).message,
    /Requires Water attunement/
  );
  assert.deepEqual(
    elementalistProfession.ui.paletteSkillAvailability(
      {
        ...context,
        professionState: {
          primaryAttunement: 'Fire',
          energy: 9
        }
      },
      fireSphere
    ),
    { available: false, message: 'Requires 10 Energy; currently 9' }
  );
});
