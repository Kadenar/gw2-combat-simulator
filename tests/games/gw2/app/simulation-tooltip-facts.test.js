import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fromModifier,
  fromProfile,
  profileTooltip,
  skillTooltip,
  tooltipFactorChange,
  tooltipSeconds,
  traitTooltip
} from '#gw2/app/shared/simulation-tooltip.js';

const context = {
  catalog: {
    balanceProfilesById: new Map([
      [1, { id: 1, value: 1.234567891, effects: [{ type: 'condition', condition: 'Burning', duration: 2 }] }],
      ['other', { id: 'other', value: 3, effects: [{ type: 'condition', condition: 'Bleeding', duration: 4 }] }]
    ]),
    skillsById: new Map([[1, { id: 1, effects: [{ type: 'condition', condition: 'Torment', duration: 5 }] }]])
  },
  modifierRulesById: new Map([['bonus', { amount: 0.125, factor: 1.5, parameters: { perStack: 0.01 } }]])
};

// Declarative rows retain source-specific defaults and exact custom formatting in every selected context.
test('fact specifications resolve selected profiles, modifier scalars, and parameters without rounding raw formats', () => {
  const describe = traitTooltip('Scalar facts', [
    ['value', 'Rounded'],
    ['value', 'Raw', String],
    ['value', 'Raw multiplier', (value) => `${value}×`],
    fromProfile('other', 'value', 'Duration', tooltipSeconds),
    fromModifier('bonus', 'amount', 'Bonus'),
    fromModifier('bonus', 'factor', 'Factor', tooltipFactorChange),
    fromModifier('bonus', 'perStack', 'Per stack')
  ]);
  const facts = (selected) =>
    describe(selected, { id: 1 })
      .facts.slice(0, 7)
      .map(({ detail }) => detail);
  assert.deepEqual(facts(context), ['1.2345679', '1.234567891', '1.234567891×', '3s', '+12.5%', '+50%', '+1%']);
  const selected = {
    catalog: {
      ...context.catalog,
      balanceProfilesById: new Map([
        [1, { id: 1, value: 9.876543219 }],
        ['other', { id: 'other', value: 7 }]
      ])
    },
    modifierRulesById: new Map([['bonus', { amount: 0.25, factor: 2, parameters: { perStack: 0.02 } }]])
  };
  assert.deepEqual(facts(selected), ['9.8765432', '9.876543219', '9.876543219×', '7s', '+25%', '+100%', '+2%']);
});

// Trait/profile facts precede effects; skill facts follow the selected skill's effects, including computed callbacks.
test('tooltip helpers retain their own identity, callback arguments, qualifiers, and effect ordering', () => {
  for (const computed of [false, true]) {
    let calls = 0;
    const input = (id, skill = false) =>
      computed
        ? (selected, entity) => {
            calls++;
            assert.equal(selected, context);
            assert.equal(entity, skill ? context.catalog.skillsById.get(id) : id);
            return [{ name: 'Value', detail: String(selected.catalog.balanceProfilesById.get(id).value) }];
          }
        : [['value', 'Value', String]];
    const trait = traitTooltip('Trait', input(1), 'trait effect')(context, { id: 1 });
    const profile = profileTooltip('other', 'Profile', input('other'), 'profile effect')(context, { id: 1 });
    const skill = skillTooltip('Skill', input(1, true))(context, { id: 1 });
    assert.deepEqual(
      trait.facts.map(({ name }) => name),
      ['Value', 'Burning']
    );
    assert.equal(trait.facts[0].detail, '1.234567891');
    assert.match(trait.facts[1].detail, /trait effect/);
    assert.deepEqual(
      profile.facts.map(({ name }) => name),
      ['Value', 'Bleeding']
    );
    assert.equal(profile.facts[0].detail, '3');
    assert.match(profile.facts[1].detail, /profile effect/);
    assert.deepEqual(
      skill.facts.map(({ name }) => name),
      ['Torment', 'Value']
    );
    assert.equal(skill.facts[1].detail, '1.234567891');
    assert.equal(calls, computed ? 3 : 0);
  }
});

// A missing or malformed source must fail at rendering instead of borrowing another profile or hiding invalid data.
test('declarative facts reject missing profiles, modifiers, and non-finite numeric fields', () => {
  for (const [fact, pattern] of [
    [fromProfile('missing', 'value', 'Missing'), /missing required profile/],
    [fromModifier('missing', 'amount', 'Missing'), /Missing tooltip modifier/],
    [['absent', 'Missing'], /field=absent/],
    [fromProfile('other', 'absent', 'Missing'), /field=absent/],
    [fromModifier('bonus', 'absent', 'Missing'), /Invalid tooltip number/]
  ]) {
    assert.throws(() => traitTooltip('Invalid', [fact])(context, { id: 1 }), pattern);
  }

  for (const value of [undefined, '1', NaN, Infinity]) {
    const invalid = {
      catalog: { ...context.catalog, balanceProfilesById: new Map([[1, { id: 1, value }]]) },
      modifierRulesById: new Map([['bonus', { amount: value, parameters: { perStack: value } }]])
    };
    for (const fact of [
      ['value', 'Invalid'],
      fromModifier('bonus', 'amount', 'Invalid'),
      fromModifier('bonus', 'perStack', 'Invalid')
    ]) {
      assert.throws(() => traitTooltip('Invalid', [fact])(invalid, { id: 1 }));
    }
  }

  assert.throws(
    () => traitTooltip('Missing', [['value', 'Missing']])(context, { id: 'missing' }),
    /missing required profile/
  );
});
