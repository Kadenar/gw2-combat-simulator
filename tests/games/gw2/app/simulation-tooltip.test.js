// Exercise tooltip construction and caching with independent skill, build and row inputs.
import assert from 'node:assert/strict';
import test from 'node:test';

import { defineProfessionApp } from '#gw2/app/define-profession-app.js';
import {
  describeSimulationSkill,
  describeSimulationTrait,
  simulationEffectFacts,
  skillTooltip,
  tooltipNumber
} from '#gw2/app/shared/simulation-tooltip.js';
import { skillTooltipAttributes } from '#gw2/app/shared/tooltip-overlay.js';
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
  assert.match(heading, /data-wiki-recharge="6"/);
  assert.deepEqual(
    describe('0-0-0').facts.map((fact) => fact.detail),
    ['8s', '1', '4']
  );
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
