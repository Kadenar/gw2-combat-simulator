import assert from 'node:assert/strict';
import test from 'node:test';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';

test('Writ and symbol reactions survive renamed skills, including ordinary and special extension packets', () => {
  for (const [id, weapon] of [
    [ID.SYMBOL_OF_FAITH, 'Mace'],
    [ID.SYMBOL_OF_PUNISHMENT, 'Scepter']
  ]) {
    const result = runGuardian(
      [id, { type: 'wait', durationMs: 8000 }],
      {
        primaryWeapon: weapon,
        selectedTraitIds: [TRAIT.WRIT_OF_PERSISTENCE, TRAIT.SYMBOLIC_AVENGER, TRAIT.SYMBOLIC_EXPOSURE]
      },
      {
        // Display text is deliberately unrelated to symbols; authored identity must survive catalog replacement.
        catalog: (catalog) => withSkill(catalog, id, { name: 'Renamed attack', description: '' })
      }
    );
    assert.deepEqual(result.warnings, []);
    const field = result.events.find((event) => event.type === 'combo_field');
    const baseDuration = guardianCatalog.skillsById.get(id).comboFields[0].duration;
    assert.equal(field.expiresAt - field.at, baseDuration + 2);
    const extended = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === id && event.at > field.at + baseDuration
    );
    assert.ok(extended.length > 0);
    assert.ok(extended.every((event) => event.metadata?.guardianSymbol === true));
    assert.ok(result.planningState.profession.symbolicAvengerExpirations.length > 0);
    assert.ok(
      result.resolvedEvents.some(
        (event) => event.sourceId === TRAIT.SYMBOLIC_EXPOSURE && event.at === extended.at(-1).at
      )
    );
  }
});

test('symbol wording and a Light field cannot grant Writ extensions without the authored skill tag', () => {
  const result = runGuardian(
    [ID.SYMBOL_OF_FAITH, { type: 'wait', durationMs: 8000 }],
    {
      primaryWeapon: 'Mace',
      selectedTraitIds: [TRAIT.WRIT_OF_PERSISTENCE]
    },
    {
      catalog: (catalog) =>
        withSkill(catalog, ID.SYMBOL_OF_FAITH, {
          tags: [],
          name: 'Symbol of Imposture',
          description: 'Symbol. Creates a symbol.'
        })
    }
  );
  assert.deepEqual(result.warnings, []);
  const field = result.events.find((event) => event.type === 'combo_field');
  assert.equal(field.expiresAt - field.at, guardianCatalog.skillsById.get(ID.SYMBOL_OF_FAITH).comboFields[0].duration);
});

test('symbol reactions use delivered packet metadata rather than skill tags, names, or descriptions', () => {
  const result = runGuardian(
    [ID.ORB_OF_WRATH, { type: 'wait', durationMs: 2000 }],
    {
      selectedTraitIds: [TRAIT.SYMBOLIC_AVENGER, TRAIT.SYMBOLIC_EXPOSURE]
    },
    {
      // Three otherwise identical packets isolate missing, explicit false, and explicit true classifications.
      catalog: (catalog) =>
        withSkill(catalog, ID.ORB_OF_WRATH, {
          tags: ['symbol'],
          name: 'Lesser Symbol of Imposture',
          description: 'Symbol. Creating a symbol.',
          castTimeMs: 0,
          effects: [
            {
              type: 'strike',
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              ticks: [
                { atMs: 0, coefficient: 1 },
                { atMs: 1000, coefficient: 1, metadata: { guardianSymbol: false } },
                { atMs: 2000, coefficient: 1, metadata: { guardianSymbol: true } }
              ]
            }
          ]
        })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.symbolicAvengerExpirations.length, 1);
  const exposure = result.resolvedEvents.filter((event) => event.sourceId === TRAIT.SYMBOLIC_EXPOSURE);
  assert.equal(exposure.length, 1);
  assert.equal(exposure[0].at, 2);
});

test('symbol eligibility rejects non-boolean authored packet metadata', () => {
  assert.throws(
    () =>
      withSkill(guardianCatalog, ID.ORB_OF_WRATH, {
        effects: [{ type: 'strike', coefficient: 1, metadata: { guardianSymbol: 'true' } }]
      }),
    /guardianSymbol must be a boolean/
  );
});
