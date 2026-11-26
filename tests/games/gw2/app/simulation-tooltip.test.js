// Exercise tooltip construction and caching with independent skill, build and row inputs.
import assert from 'node:assert/strict';
import test from 'node:test';

import { defineProfessionApp } from '#gw2/app/define-profession-app.js';
import {
  describeSimulationSkill,
  describeSimulationTrait,
  profileCooldown,
  simulationEffectFacts,
  skillTooltip,
  tooltipHasTrait,
  tooltipNumber,
  tooltipSeconds,
  traitTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { skillTooltipAttributes, traitTooltipAttributes } from '#gw2/app/shared/tooltip-overlay.js';
import { professionRegistry } from '#gw2/profession-registry.js';

test('skill cards cache by selection and balance context while row details stay local', async () => {
  const { profession } = await professionRegistry[0].loadAppAdapter();
  const skill = { id: 'sample', name: 'Sample' };
  const patch = (name) => ({ balanceContext: { catalog: { skillsById: new Map([[skill.id, { ...skill, name }]]) } } });
  const adapter = defineProfessionApp({
    profession,
    tooltips: {
      traits: {},
      skills: {
        [skill.id]: (_context, selected, _specialization, build) => ({
          description: selected.name,
          facts: build.specializations.map(({ name }) => ({ name, detail: selected.name }))
        })
      }
    }
  });
  const first = patch('first');
  const build = { specializations: [{ name: 'one' }] };
  const card = adapter.skillTooltip(skill, first, build);
  assert.equal(card.description, 'first');
  assert.equal(adapter.skillTooltip({ ...skill }, first, structuredClone(build)), card);
  const other = adapter.skillTooltip(skill, first, { specializations: [{ name: 'two' }] });
  assert.notDeepEqual(other.facts, card.facts);
  assert.equal(adapter.skillTooltip(skill, patch('second'), build).description, 'second');
  const row = (details) => skillTooltipAttributes(skill, card, { details, detailsTitle: skill.name });
  const saved = row('row-one');
  assert.ok(saved.includes('row-one'));
  assert.ok(row('row-two').includes('row-two'));
  assert.ok(!row('row-two').includes('row-one'));
  assert.equal(row('row-one'), saved);
});

// Trait cards must follow edits to the current build while reference cards have no selection.
test('trait cards resolve effects against the current trait choices', async () => {
  const { profession } = await professionRegistry[0].loadAppAdapter();
  const trait = { id: 'source', name: 'Source' };
  const adjustment = { id: 'adjustment' };
  const catalog = { specializations: [{ name: 'line', minorTraits: [], majorTraits: [[adjustment]] }] };
  const patch = { balanceContext: { catalog } };
  const adapter = defineProfessionApp({
    profession,
    tooltips: {
      traits: {
        [trait.id]: (context, _trait, _specialization, build) =>
          simulationEffectFacts([
            {
              type: 'condition',
              condition: 'Bleeding',
              duration: 4,
              stacks: tooltipHasTrait(context, build, adjustment.id) ? 2 : 1
            }
          ])
      }
    }
  });
  const stacks = (build) => adapter.traitTooltip(trait, patch, 'Core', build).facts[0].stacks;
  const build = { specializations: [{ name: 'line', traits: '1-0-0' }] };
  assert.equal(stacks(build), 2);
  build.specializations[0].traits = '0-0-0';
  assert.equal(stacks(build), 1);
  assert.equal(stacks(), 1);
});

// A selected trait may remove a cost entirely or add charges. Row and heading values must agree.
test('adjusted skill costs follow the selected trait and revert when it is removed', () => {
  const skill = { id: 'fixture', name: 'Fixture', cooldown: 8, ammo: 1, energyCost: 4 };
  const trait = { id: 'adjustment' };
  const catalog = { specializations: [{ name: 'line', minorTraits: [], majorTraits: [[trait]] }] };
  const presentation = {
    traits: {},
    skillFacts: () => [{ name: 'Base energy cost', detail: String(skill.energyCost) }],
    skillCosts: (_context, _skill, selection) =>
      selection.hasTrait(trait.id) ? { cooldown: 6, ammo: 2, energyCost: 0 } : undefined
  };
  const describe = (traits) =>
    describeSimulationSkill({ catalog }, skill, presentation, { specializations: [{ name: 'line', traits }] });
  const adjusted = describe('1-0-0');
  assert.deepEqual(
    adjusted.facts.map((fact) => fact.detail),
    ['6s', '2', '0']
  );
  const heading = skillTooltipAttributes(skill, adjusted);
  assert.match(heading, /data-wiki-energy="0"/);
  assert.equal(tooltipAttribute(heading, 'recharges')[0].seconds, '6');
  assert.deepEqual(
    describe('0-0-0').facts.map((fact) => fact.detail),
    ['8s', '1', '4']
  );
});

function tooltipAttribute(markup, name) {
  const value = markup.match(new RegExp(`data-wiki-${name}="([^"]*)"`))?.[1];
  return value && JSON.parse(value.replaceAll('&quot;', '"'));
}

test('trait headers collect trigger cooldowns and preserve their scope', () => {
  const trait = { id: 'sample', name: 'Sample' };
  const profile = { ...trait, internalCooldown: 0.5, cooldown: 4, rechargeReduction: 2 };
  const context = { catalog: { balanceProfilesById: new Map([[trait.id, profile]]) } };
  const model = traitTooltip('', [
    ['internalCooldown', 'First trigger', tooltipSeconds],
    ['rechargeReduction', 'Recharge reduction', tooltipSeconds]
  ])(context, trait);
  const scoped = profileCooldown('Second trigger')(context, trait.id);
  const tabs = ['Base effects', 'Alternate'].map((label) => ({ label, facts: [scoped] }));
  const card = traitTooltipAttributes(trait, {
    ...model,
    factTabs: tabs,
    factSections: [{ label: 'On swap', facts: [scoped] }]
  });
  assert.deepEqual(tooltipAttribute(card, 'recharges'), [
    { name: 'First trigger', seconds: '0.5', label: 'First trigger' },
    ...tabs.map((_, tab) => ({ name: 'Second trigger', seconds: '4', label: 'Second trigger', tab })),
    { name: 'On swap: Second trigger', seconds: '4', label: 'On swap: Second trigger' }
  ]);
  assert.deepEqual(tooltipAttribute(card, 'effects'), [model.facts[1]]);
  assert.deepEqual(
    tooltipAttribute(card, 'effect-tabs'),
    tabs.map(({ label }) => ({ label, facts: [] }))
  );
  assert.deepEqual(tooltipAttribute(card, 'effect-sections'), [{ label: 'On swap', facts: [] }]);
  assert.doesNotMatch(traitTooltipAttributes(trait, { facts: [model.facts[1]] }), /data-wiki-recharges/);
});

test('a disabled trigger cooldown is absent from both reference facts and the trait heading', () => {
  const trait = { id: 'sample', name: 'Sample' };
  const profile = { ...trait, internalCooldown: 0, rechargeReduction: 0 };
  const context = { catalog: { balanceProfilesById: new Map([[trait.id, profile]]) } };
  const describe = traitTooltip('', [
    ['internalCooldown', 'Trigger', (seconds) => `${seconds} seconds`],
    ['rechargeReduction', 'Reduction', tooltipSeconds]
  ]);
  const model = describeSimulationTrait(context, trait, { traits: { [trait.id]: describe } });
  assert.equal(model.facts.length, 1);
  assert.equal(model.facts[0].name, 'Reduction');
  assert.doesNotMatch(traitTooltipAttributes(trait, model), /data-wiki-recharges/);
});

test('a custom skill formatter reads the effect payload once', () => {
  let reads = 0;
  const skill = {
    id: 'sample',
    name: 'Sample',
    effects: [
      {
        type: 'strike',
        get coefficient() {
          reads++;
          return 1;
        }
      }
    ]
  };
  const model = describeSimulationSkill({ catalog: { skillsById: new Map([[skill.id, skill]]) } }, skill, {
    traits: {},
    skills: { [skill.id]: skillTooltip(skill.name) }
  });
  assert.equal(model.facts.length, 1);
  assert.equal(reads, 1);
});

test('finisher facts combine attempts across skill, effect and tick declarations', () => {
  const projectile = { finisherType: 'Projectile', chance: 0.2 };
  const certain = { ...projectile, chance: 1 };
  const whirl = { finisherType: 'Whirl' };
  const describe = (payload) =>
    describeSimulationSkill({ catalog: {} }, { id: 'sample', name: 'Sample', ...payload }, { traits: {} }).facts;
  const detail = (finisher) => describe({ comboFinishers: [finisher] })[0].detail;
  assert.notEqual(detail(projectile), detail(certain));
  assert.equal(detail(whirl), detail({ ...whirl, chance: 0.5 }));
  const facts = describe({
    comboFinishers: [{ ...projectile, attempts: 2 }],
    effects: [
      {
        type: 'strike',
        comboFinishers: [projectile, certain],
        ticks: [0, 500].map((atMs) => ({
          atMs,
          coefficient: 1,
          comboFinishers: [{ ...whirl, attemptGroup: String(atMs) }]
        }))
      }
    ]
  });
  const chances = new Map(facts.map((fact) => [fact.detail, fact.applications]));
  assert.deepEqual(
    [projectile, certain, whirl].map((finisher) => chances.get(detail(finisher))),
    [3, 1, 2]
  );
});

test('effect facts group matching applications and distinguish recipients and stack counts', () => {
  const self = { type: 'boon', boon: 'might', stacks: 1, duration: 6, audience: { recipients: 'self' } };
  const party = { ...self, audience: { recipients: 'party', affectsSelf: false } };
  const stacked = { ...self, stacks: 3 };
  const facts = simulationEffectFacts([self, party, self, stacked]).facts;
  assert.equal(facts.length, 3);
  const [own, allies, multiple] = facts;
  assert.equal(own.applications, 2);
  assert.equal(allies.applications, 1);
  assert.notEqual(own.detail, allies.detail);
  assert.deepEqual([own.stacks, multiple.stacks], [self.stacks, stacked.stacks]);
});

test('invalid inputs are rejected and only declared effects supply generated facts', () => {
  const context = { catalog: { balanceProfilesById: new Map() } };
  const presentation = { traits: {} };
  const skill = {
    id: 'sample',
    name: 'Sample',
    effects: [{ type: 'condition', condition: 'Torment', stacks: 1, duration: 3 }]
  };
  const facts = describeSimulationSkill(context, skill, presentation).facts;
  assert.ok(facts.length);
  assert.deepEqual(
    describeSimulationSkill(context, { ...skill, tooltipFacts: [{ name: 'external', detail: 'extra' }] }, presentation)
      .facts,
    facts
  );
  for (const amount of [null, () => 1])
    assert.throws(() => tooltipNumber({ amount }, 'amount'), /Invalid tooltip number/);
  assert.equal(tooltipNumber({ amount: 0 }, 'amount'), 0);
  assert.throws(() => describeSimulationTrait(context, { id: 'missing' }, presentation), /Missing trait tooltip/);
});

test('Twin Fangs tooltip separates passive critical damage from its earned critical-chance buff', async () => {
  const adapter = await professionRegistry.find(({ id }) => id === 'thief').loadAppAdapter();
  const patch = adapter.profession.resolvePatch({ id: 'current' });
  const trait = patch.balanceContext.catalog.traits.find(({ name }) => name === 'Twin Fangs');
  const model = adapter.traitTooltip(trait, patch);
  assert.deepEqual(
    model.facts.map(({ name, detail }) => [name, detail]),
    [
      ['Health threshold', '50%'],
      ['Critical damage increase', '+5%'],
      ['High-health critical damage increase', '+2%'],
      ['Critical chance increase while active', '+7%'],
      ['Bonus duration', '8s']
    ]
  );
  assert.doesNotMatch(model.description, /passive critical chance|full-health/);
});

// Walk the registry so new professions and catalog entries receive the same construction check.
for (const { id, loadAppAdapter } of professionRegistry) {
  test(`${id} skill and trait declarations produce complete tooltips`, async () => {
    const adapter = await loadAppAdapter();
    const patch = adapter.profession.resolvePatch({ id: 'current' });
    const { skills, traits } = patch.balanceContext.catalog;
    for (const [entities, describe] of [
      [skills, adapter.skillTooltip],
      [traits, adapter.traitTooltip]
    ]) {
      for (const entity of entities) {
        const model = describe(entity, patch);
        assert.ok(model.description && !model.incomplete, entity.name);
        assert.doesNotMatch(JSON.stringify(model), /NaN|Infinity|undefined/, entity.name);
      }
    }
  });
}
