import assert from 'node:assert/strict';
import test from 'node:test';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { applySkillPatch, applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { DAREDEVIL_THIEVES_GUILD_ACTOR } from '#gw2/professions/thief/specializations/daredevil/mechanics/thieves-guild.js';
import { DEADEYE_THIEVES_GUILD_ACTOR } from '#gw2/professions/thief/specializations/deadeye/mechanics/thieves-guild.js';
import {
  SPECTER_THIEVES_GUILD_ACTOR,
  guildAttackConditions
} from '#gw2/professions/thief/specializations/specter/mechanics/thieves-guild.js';
import { ANTIQUARY_THIEVES_GUILD_ACTOR } from '#gw2/professions/thief/specializations/antiquary/mechanics/thieves-guild.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

const actors = {
  Daredevil: DAREDEVIL_THIEVES_GUILD_ACTOR,
  Deadeye: DEADEYE_THIEVES_GUILD_ACTOR,
  Specter: SPECTER_THIEVES_GUILD_ACTOR,
  Antiquary: ANTIQUARY_THIEVES_GUILD_ACTOR
};
const wait = (durationMs) => ({ type: 'wait', durationMs });
const config = (specialization) => ({ specialization, selectedSkillIds: [ID.THIEVES_GUILD] });
const guildPackets = (result) =>
  result.events.filter((event) => event.type === 'damage' && event.sourceId === 'thief.thieves-guild');

// Actor contributions are structural; deleted profile targets cannot acquire numeric tuning again.
test('guild catalogs reject every deleted elite profile, including detached preview runtimes', () => {
  for (const selected of ['Core', ...Object.keys(actors)]) {
    for (const options of [{}, { traitTriggers: false }]) {
      const runtime = thiefProfession.runtimeFor(config(selected), options);
      for (const elite of Object.keys(actors)) {
        const id = `thief.${elite.toLowerCase()}.thieves-guild`;
        assert.equal(runtime.catalog.balanceProfilesById.has(id), false);
        assert.throws(
          () => applyBalanceProfilePatch(runtime.catalog, { balanceProfiles: { [id]: { fields: {} } } }),
          /unknown balance profile/
        );
      }
    }
  }
});

// The family binding selects only its own actor while the shared pair and Core default still attack.
for (const selected of ['Core', ...Object.keys(actors)]) {
  test(`${selected} guild retains shared actors and isolates the selected third actor`, () => {
    const result = runThief(['Thieves Guild', { type: 'combat-start' }, wait(6000)], config(selected));
    assert.deepEqual(result.warnings, []);
    const packets = guildPackets(result);
    for (const shared of thiefProfession.catalog.skillsById
      .get(ID.THIEVES_GUILD)
      .summonAttack.summons.filter((actor) => actor.variant == null)) {
      assert.ok(packets.some((event) => event.skillName.endsWith(shared.name)));
    }

    for (const [elite, actor] of Object.entries(actors)) {
      assert.equal(
        packets.some((event) => event.skillName.endsWith(actor.name)),
        elite === selected
      );
    }

    if (selected === 'Core') {
      const coreActor = thiefProfession.catalog.skillsById
        .get(ID.THIEVES_GUILD)
        .summonAttack.summons.find((actor) => actor.variant === 'Core Thief');
      assert.ok(packets.some((event) => event.skillName.endsWith(coreActor.name)));
    }
  });
}

// Structural contributions keep patch-aware attack lookup and the shared expiry contract.
for (const [elite, actor] of Object.entries(actors)) {
  test(`${elite} guild reads selected attack skills and retires at expiry`, () => {
    const skills = Object.fromEntries(
      actor.attacks.map(({ skillId }) => [
        skillId,
        { effects: [{ type: 'strike', name: 'Strike', coefficient: 0.73, hits: 1 }] }
      ])
    );
    skills[ID.THIEVES_GUILD] = { fields: { duration: 6 } };
    const result = runThief(['Thieves Guild', { type: 'combat-start' }, wait(8000)], config(elite), {
      catalog: (catalog) => applySkillPatch(catalog, { skills })
    });
    assert.deepEqual(result.warnings, []);
    const packets = guildPackets(result).filter((event) => event.skillName.endsWith(actor.name));
    assert.ok(packets.length > 0);
    assert.ok(packets.every((event) => event.coefficient === 0.73));
    assert.equal(result.planningState.profession.activeThievesGuild, null);
    const baseline = thiefProfession.runtimeFor(config(elite)).catalog;
    assert.notEqual(
      baseline.skillsById.get(actor.attacks[0].skillId).effects.find((effect) => effect.type === 'strike').coefficient,
      0.73
    );
  });
}

// Each condition decision reads live target state and keeps removed candidates absent.
test('Specter chooses selected condition tuning from live target state', () => {
  const catalog = applySkillPatch(thiefProfession.runtimeFor(config('Specter')).catalog, {
    skills: {
      67795: {
        effects: [
          { type: 'condition', name: 'Poisoned', duration: 0.3 },
          { type: 'condition', name: 'Bleeding', duration: 0.4 },
          { type: 'condition', name: 'Torment', duration: 0.5 }
        ]
      }
    }
  });
  const present = new Set();
  const runtime = {
    config: { target: { conditions: {} } },
    time: 0,
    combat: { targetHasCondition: (condition) => present.has(condition) }
  };
  for (const [condition, duration] of [
    ['Poisoned', 0.3],
    ['Bleeding', 0.4],
    ['Torment', 0.5]
  ]) {
    const selected = guildAttackConditions(runtime, catalog.skillsById.get(67795));
    assert.equal(selected.length, 1);
    assert.equal(selected[0].condition, condition);
    assert.equal(selected[0].duration, duration);
    present.add(condition);
  }

  present.clear();
  const removed = applySkillPatch(catalog, {
    skills: { 67795: { removeEffects: [{ type: 'condition', name: 'Poisoned' }] } }
  });
  assert.deepEqual(guildAttackConditions(runtime, removed.skillsById.get(67795)), []);
});
