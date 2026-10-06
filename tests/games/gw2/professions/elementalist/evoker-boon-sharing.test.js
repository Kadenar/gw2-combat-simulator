import assert from 'node:assert/strict';
import test from 'node:test';
import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { buildBoonGeneration, projectedPartyEffects } from '#gw2/platform/results/boon-generation.js';
import { effectStateAt } from '#gw2/platform/results/effect-report.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistTooltips } from '#gw2/professions/elementalist/app/tooltips.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';

// Each familiar must author a party grant so solo simulations still report the boon provided to a full subgroup.
for (const [element, skills, boon] of [
  ['Earth', ['Calcify', 'Seismic Impact'], 'alacrity'],
  ['Water', ['Splash', 'Buoyant Deluge'], 'alacrity'],
  ['Fire', ['Ignite', 'Conflagration'], 'quickness'],
  ['Air', ['Zap', 'Lightning Blitz'], 'quickness']
]) {
  for (const skill of skills) {
    test(`Familiar's Blessing from ${skill} reaches allies and appears in party reporting`, () => {
      for (const count of [0, 4]) {
        const result = runElementalist(
          [
            { type: 'cast', skillId: elementalistCatalog.skillsByName.get(skill).id },
            { type: 'wait', durationMs: 6000 }
          ],
          {
            specialization: 'Evoker',
            evokerElement: element,
            selectedTraitIds: [TRAIT.FAMILIARS_BLESSING, TRAIT.ELEMENTAL_BALANCE],
            initialEvokerCharges: 6,
            initialEvokerEmpowered: skill === skills[1] ? 3 : 0,
            allies: { count }
          }
        );
        assert.deepEqual(result.warnings, []);
        const grants = result.resolvedEvents.filter(
          (event) => event.type === 'buff' && event.sourceId === TRAIT.FAMILIARS_BLESSING
        );
        assert.equal(grants.length, 1);
        const [grant] = grants;
        assert.equal(grant.kind, boon);
        assert.equal(grant.audience?.recipients, 'party');
        assert.equal(grant.audience.maximumRecipients, 5);
        assert.equal(grant.resolvedAudience.includesSelf, true);
        assert.equal(grant.resolvedAudience.alliedPlayerCount, count);

        const generation = buildBoonGeneration(grants, 0, result.rotationEndTime);
        assert.equal(generation.boons.get(boon).self.generatedStackSeconds, grant.duration);
        assert.equal(generation.boons.get(boon).allies.generatedStackSeconds, grant.duration * 4);
        const report = projectedPartyEffects(generation, result.rotationEndTime);
        for (const recipient of ['ally:1', 'ally:2', 'ally:3', 'ally:4']) {
          const track = report.tracks.find((entry) => entry.kind === boon && entry.recipient === recipient);
          assert.ok(track);
          assert.equal(effectStateAt(report, track, grant.at).count, 1);
          assert.equal(effectStateAt(report, track, result.rotationEndTime).count, 0);
        }
      }
    });
  }
}

// Each meditation's extra trait boon must retain its party audience independently of the base skill payload.
for (const [name, boon] of [
  ["Fox's Fury", 'might'],
  ["Hare's Agility", 'fury'],
  ["Toad's Fortitude", 'stability'],
  ['Elemental Procession', 'resistance']
]) {
  test(`Altruistic Aspect shares ${name}'s ${boon} with allies only when selected`, () => {
    const skill = elementalistCatalog.skillsByName.get(name);
    const profile = elementalistCatalog.balanceProfilesById.get(TRAIT.ALTRUISTIC_ASPECT);
    const effect = requireEffect(profile, 'boon', name);
    const simulate = (selectedTraitIds) =>
      runElementalist(
        [
          { type: 'cast', skillId: skill.id },
          { type: 'wait', durationMs: 12000 }
        ],
        {
          specialization: 'Evoker',
          evokerElement: 'Earth',
          selectedTraitIds,
          selectedSkillIds: [skill.id],
          allies: { count: 4 }
        }
      );
    const baseline = simulate([]);
    const selected = simulate([TRAIT.ALTRUISTIC_ASPECT]);
    assert.deepEqual(baseline.warnings, []);
    assert.deepEqual(selected.warnings, []);
    const generation = (result) =>
      buildBoonGeneration(result.resolvedEvents, 0, result.rotationEndTime).boons.get(boon);
    const before = generation(baseline);
    const after = generation(selected);
    const duration = effect.duration * effect.stacks;
    assert.equal(after.self.generatedStackSeconds - (before?.self.generatedStackSeconds ?? 0), duration);
    assert.equal(after.allies.generatedStackSeconds - (before?.allies.generatedStackSeconds ?? 0), duration * 4);
  });
}

// Protection belongs to Seismic Impact itself and reaches the party even without a target or boon-granting traits.
test('Seismic Impact exposes and applies its intrinsic party Protection', () => {
  const skill = elementalistCatalog.skillsByName.get('Seismic Impact');
  const context = withPatchPreview(elementalistProfession, null).balanceContextFor();
  const tooltip = describeSimulationSkill(context, skill, elementalistTooltips);
  const protection = tooltip.facts.find((fact) => fact.name === 'Protection');
  assert.ok(protection);
  assert.match(protection.detail, /1\.5s/);
  assert.match(protection.detail, /up to 5 party members/);

  const result = runElementalist(
    [
      { type: 'cast', skillId: skill.id, offTarget: true },
      { type: 'wait', durationMs: 12000 }
    ],
    {
      specialization: 'Evoker',
      evokerElement: 'Earth',
      selectedTraitIds: [],
      initialEvokerEmpowered: 3,
      allies: { count: 4 }
    }
  );
  assert.deepEqual(result.warnings, []);
  const grants = result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === 'protection');
  assert.ok(grants.length > 0);
  for (const grant of grants) {
    assert.equal(grant.skillId, skill.id);
    assert.equal(grant.duration, 1.5);
    assert.equal(grant.resolvedAudience.includesSelf, true);
    assert.equal(grant.resolvedAudience.alliedPlayerCount, 4);
  }
});

// Calcify's disable reward must never become party generation, and missing the target must suppress it.
test('Calcify Protection stays personal and requires an accepted disable', () => {
  const skill = elementalistCatalog.skillsByName.get('Calcify');
  for (const offTarget of [false, true]) {
    const result = runElementalist(
      [
        { type: 'cast', skillId: skill.id, offTarget },
        { type: 'wait', durationMs: 6000 }
      ],
      {
        specialization: 'Evoker',
        evokerElement: 'Earth',
        selectedTraitIds: [],
        initialEvokerCharges: 6,
        allies: { count: 4 }
      }
    );
    assert.deepEqual(result.warnings, []);
    const grants = result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === 'protection');
    assert.equal(grants.length, offTarget ? 0 : 1);
    if (offTarget) continue;
    assert.equal(grants[0].duration, 2);
    assert.equal(grants[0].resolvedAudience.includesSelf, true);
    assert.equal(grants[0].resolvedAudience.alliedPlayerCount, 0);
    assert.equal(
      buildBoonGeneration(grants, 0, result.rotationEndTime).boons.get('protection').allies.generatedStackSeconds,
      0
    );
  }
});

// All player disables share the passive cooldown; other actors and familiar elements cannot claim it.
test('Earth familiar Protection shares an internal cooldown across accepted player disables', () => {
  for (const evokerElement of ['Earth', 'Fire']) {
    const result = runElementalist(
      [{ type: 'wait', durationMs: 2000 }],
      { specialization: 'Evoker', evokerElement, selectedTraitIds: [] },
      {
        initialize(runtime) {
          for (const [at, actorType] of [
            [0.1, 'summon'],
            [0.2, 'player'],
            [0.3, 'player'],
            [0.5, 'player']
          ]) {
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'control',
                at,
                source: 'Fixture disable',
                sourceId: 42,
                skillId: 42,
                skillName: 'Fixture disable',
                actorType,
                controlKind: 'crowd-control'
              }
            });
          }
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const grants = result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === 'protection');
    assert.deepEqual(
      grants.map((event) => event.at),
      evokerElement === 'Earth' ? [0.2, 0.5] : []
    );
  }
});
