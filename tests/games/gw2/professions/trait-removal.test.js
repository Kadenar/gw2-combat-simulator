// Modifier contributions measure a trait by recalculating the build without it. A synthetic line keeps this test
// independent of any profession's trait data.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createWarriorBuildDefaults } from '#gw2/professions/warrior/build/build.js';
import { createCalculateAttributes, createProfessionBuildAttributeRules } from '#tests/helpers/build-attributes.js';

const FLAT = { id: 1, name: 'Flat Grant' };
const CONVERSION = { id: 2, name: 'Power Conversion' };
const catalog = {
  specializations: [{ name: 'Fixture Line', minorTraits: [FLAT], majorTraits: [[CONVERSION], [], []] }]
};

// The flat Power grant feeds the eligible conversion pool, so removing it also lowers the converted Ferocity.
const effectsByTraitId = new Map([
  [FLAT.id, [{ kind: 'flat', to: 'Power', amount: 100, feedsConversions: 'all' }]],
  [
    CONVERSION.id,
    [{ kind: 'conversion', from: 'Power', to: 'Ferocity', multiplier: 0.1, rounding: 'floor', input: 'eligible' }]
  ]
]);

/** Returns attributes and the trait IDs the contribution calculator received for one calculation. */
function calculate(disabledTrait, specializations = [{ name: 'Fixture Line', traits: '1-0-0' }]) {
  const seen = [];
  const contributions = ({ config }) => {
    seen.push(...config.selectedTraitIds);
    return config.selectedTraitIds.map((id) => ({ attributeEffects: effectsByTraitId.get(id) }));
  };

  const build = { ...createWarriorBuildDefaults(), specializations };
  const result = createCalculateAttributes(createProfessionBuildAttributeRules(catalog), contributions)(
    build,
    [],
    1,
    disabledTrait
  );

  return { ...result, seen };
}

test('a disabled trait loses its grant and conversion feed while other traits stay active', () => {
  const full = calculate(null);
  const withoutFlat = calculate(FLAT.name);
  const withoutConversion = calculate(CONVERSION.name);
  const withoutLine = calculate(null, []);
  const final = (result, attribute) => result.attributes[attribute].final;

  assert.deepEqual(full.seen, [FLAT.id, CONVERSION.id]);
  assert.deepEqual(withoutFlat.seen, [CONVERSION.id]);
  assert.deepEqual(
    withoutFlat.activeTraits.map(({ id }) => id),
    [CONVERSION.id]
  );
  assert.equal(final(full, 'Power') - final(withoutFlat, 'Power'), 100);
  assert.equal(final(full, 'Ferocity') - final(withoutFlat, 'Ferocity'), 10);

  assert.deepEqual(withoutConversion.seen, [FLAT.id]);
  assert.equal(final(withoutConversion, 'Power'), final(full, 'Power'));
  assert.equal(final(withoutConversion, 'Ferocity'), final(withoutLine, 'Ferocity'));
});
