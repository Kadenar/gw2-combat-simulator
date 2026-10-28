import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBoonGeneration } from '#gw2/platform/results/boon-generation.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as SKILL,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

const config = {
  specialization: 'Conduit',
  selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
  startingLegend: LEGEND.ENTITY,
  selectedTraitIds: [TRAIT.SHARED_WISDOM]
};
const swiftnessGrants = (result) =>
  result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === 'swiftness');
const sharedWisdomGrants = (result) =>
  result.resolvedEvents.filter((event) => event.type === 'buff' && event.metadata?.trigger);

// Every Entity button shares Swiftness and its own trait boon, using only terrestrial button identities.
for (const [skillId, boon] of [
  [SKILL.SHIELDING_HANDS, 'protection'],
  [SKILL.BEGUILING_HAZE, 'fury'],
  [SKILL.HEX_EATER_VORTEX, 'resolution'],
  [SKILL.GLADIATORS_DEFENSE, 'stability'],
  [SKILL.TWIN_MOON_SWEEP, 'might']
]) {
  test(`Shared Wisdom shares Swiftness and ${boon} from Entity skill ${skillId}`, () => {
    for (const count of [0, 4]) {
      const rotation = ['__combat_start', skillId, { type: 'wait', durationMs: 6000 }];
      const result = runRevenant(rotation, { ...config, allies: { count } });
      assert.deepEqual(result.warnings, []);
      const grants = sharedWisdomGrants(result);
      assert.deepEqual(new Set(grants.map((event) => event.kind)), new Set(['swiftness', boon]));
      assert.equal(swiftnessGrants(result).length, 1);
      for (const grant of grants) {
        assert.equal(grant.skillId, skillId);
        assert.equal(grant.audience?.recipients, 'party');
        assert.equal(grant.audience.maximumRecipients, 5);
        assert.equal(grant.resolvedAudience.includesSelf, true);
        assert.equal(grant.resolvedAudience.alliedPlayerCount, count);
      }

      // Party reporting must include the four projected allies even in a solo simulation.
      const generation = buildBoonGeneration(grants, 0, result.rotationEndTime);
      for (const kind of ['swiftness', boon]) {
        const reported = generation.boons.get(kind);
        assert.ok(reported.self.generatedStackSeconds > 0);
        assert.equal(reported.allies.generatedStackSeconds, reported.self.generatedStackSeconds * 4);
      }

      const unselected = runRevenant(rotation, { ...config, selectedTraitIds: [], allies: { count } });
      assert.deepEqual(unselected.warnings, []);
      assert.deepEqual(sharedWisdomGrants(unselected), []);
    }
  });
}

// Equipping Entity does not make weapon, profession, or another legend's skills eligible.
test('Shared Wisdom Swiftness belongs only to Legendary Entity skills', () => {
  for (const skill of ['Preparation Thrust', 'Cosmic Wisdom', 'Release Potential: Dervish', 'Phase Traversal']) {
    const result = runRevenant(['__combat_start', skill], {
      ...config,
      startingLegend: skill === 'Phase Traversal' ? LEGEND.ASSASSIN : LEGEND.ENTITY,
      allies: { count: 4 }
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(swiftnessGrants(result), []);
  }
});
