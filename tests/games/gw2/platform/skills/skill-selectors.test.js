/** Selector lookups and declarations keep runtime, presentation, and input identity on one contract. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { displayedSkill, resolveSkillSelector, selectorRootSkillId } from '#gw2/platform/skills/selectors.js';

const catalog = createCanonicalCatalog({
  skills: [
    { id: 1, name: 'Selector', selector: { first: 2, second: 3 } },
    { id: 2, name: 'First', loadoutSkillId: 1 },
    { id: 3, name: 'Second', loadoutSkillId: 1 },
    { id: 4, name: 'Ordinary' }
  ]
});
const root = catalog.skillsById.get(1);

// A wrong selection must fail everywhere, or a tile could show one payload while the cast rejects it.
test('selector lookups reject unknown selections and pass ordinary skills through', () => {
  assert.equal(resolveSkillSelector(catalog, root, 'second').id, 3);
  assert.throws(() => resolveSkillSelector(catalog, root, 'missing'), /no valid missing choice/);
  assert.throws(() => displayedSkill(catalog, root, 'missing'), /no valid missing choice/);

  const ordinary = catalog.skillsById.get(4);
  assert.equal(resolveSkillSelector(catalog, ordinary, 'second'), ordinary);
  assert.equal(displayedSkill(catalog, ordinary), ordinary);
});

// Pending presentation has no live state to name a choice, so it falls back only when the selection is absent.
test('displayed selectors use the first authored choice only without a selection', () => {
  assert.equal(displayedSkill(catalog, root).id, 2);
  assert.equal(displayedSkill(catalog, root, 'second').id, 3);
});

// Highlights group a family through this back-reference, so a missing one must fail at catalog creation.
test('selector choices must point back to their input', () => {
  assert.equal(selectorRootSkillId(catalog, 3), 1);
  assert.equal(selectorRootSkillId(catalog, 1), 1);
  assert.equal(selectorRootSkillId(catalog, 4), 4);
  assert.throws(
    () =>
      createCanonicalCatalog({
        skills: [
          { id: 1, name: 'Selector', selector: { only: 2 } },
          { id: 2, name: 'Payload' }
        ]
      }),
    /Invalid skill selector choice: 2/
  );
});
