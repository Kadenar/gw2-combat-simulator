import assert from 'node:assert/strict';
import test from 'node:test';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

const elites = ['Daredevil', 'Deadeye', 'Specter', 'Antiquary'];
const profileId = (elite) => `thief.${elite.toLowerCase()}.thieves-guild`;
const wait = (durationMs) => ({ type: 'wait', durationMs });
const config = (specialization) => ({ specialization, selectedSkillIds: [ID.THIEVES_GUILD] });
const guildPackets = (result, type = 'damage') =>
  result.events.filter((event) => event.type === type && event.sourceId === 'thief.thieves-guild');

/** A short guild with no shared thieves isolates the selected elite's scheduling and packet tuning. */
function guildCatalog(elite, attacks, duration = 2) {
  return (catalog) =>
    withProfile(
      withSkill(catalog, ID.THIEVES_GUILD, {
        castTimeMs: 0,
        cooldown: 0,
        summonAttack: { ...catalog.skillsById.get(ID.THIEVES_GUILD).summonAttack, duration, summons: [] }
      }),
      profileId(elite),
      { attacks }
    );
}

test('guild catalogs include only the active elite contribution, including detached preview runtimes', () => {
  for (const selected of ['Core', ...elites]) {
    for (const options of [{}, { traitTriggers: false }]) {
      const runtime = thiefProfession.runtimeFor(config(selected), options);
      for (const elite of elites)
        assert.equal(runtime.catalog.balanceProfilesById.has(profileId(elite)), elite === selected);
    }
  }
});

for (const elite of elites) {
  test(`${elite} guild streams read selected profiles and preserve explicit empty attacks`, () => {
    const attack = { name: 'Fixture', coefficientPerHit: 0.73, hits: 1, initialDelay: 0.2, interval: 0.5 };
    const result = runThief(['Thieves Guild', { type: 'combat-start' }, wait(1400)], config(elite), {
      catalog: guildCatalog(elite, [attack], 1)
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      guildPackets(result).map(({ at, coefficient }) => [at, coefficient]),
      [
        [0.2, 0.73],
        [0.7, 0.73]
      ]
    );
    assert.equal(result.planningState.profession.activeThievesGuild, null);

    const empty = runThief(['Thieves Guild', { type: 'combat-start' }, wait(1400)], config(elite), {
      catalog: guildCatalog(elite, [])
    });
    assert.deepEqual(empty.warnings, []);
    assert.deepEqual(guildPackets(empty), []);
  });
}

test('a missing selected guild profile fails without restoring static elite data', () => {
  assert.throws(
    () =>
      runThief(['Thieves Guild', { type: 'combat-start' }, wait(500)], config('Deadeye'), {
        catalog(catalog) {
          const balanceProfilesById = new Map(catalog.balanceProfilesById);
          balanceProfilesById.delete(profileId('Deadeye'));
          return { ...catalog, balanceProfilesById };
        }
      }),
    /thief\.deadeye\.thieves-guild.*missing required profile/
  );
});

test('Specter chooses selected condition tuning from live target state at each impact', () => {
  const attack = {
    name: 'Well of Sorrow',
    skillId: 67795,
    coefficientPerHit: 0.33,
    initialDelay: 0.2,
    interval: 1,
    conditions: [
      { condition: 'Poisoned', stacks: 1, duration: 0.3 },
      { condition: 'Bleeding', stacks: 2, duration: 0.4 },
      { condition: 'Torment', stacks: 2, duration: 0.5 },
      { condition: 'Torment', stacks: 1, duration: 0.6 }
    ]
  };
  const result = runThief(['Thieves Guild', { type: 'combat-start' }, wait(2400)], config('Specter'), {
    catalog: guildCatalog('Specter', [attack], 3),
    // Change target state after summoning; subsequent impacts must see these applications.
    timeline: [
      {
        at: 0.9,
        run: (runtime) =>
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'condition',
              at: runtime.time,
              condition: 'Poisoned',
              stacks: 1,
              duration: 3,
              source: 'fixture',
              sourceId: 'fixture',
              actorType: 'player'
            }
          })
      },
      {
        at: 1.9,
        run: (runtime) =>
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'condition',
              at: runtime.time,
              condition: 'Bleeding',
              stacks: 1,
              duration: 3,
              source: 'fixture',
              sourceId: 'fixture',
              actorType: 'player'
            }
          })
      }
    ]
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    guildPackets(result, 'condition').map(({ at, condition, duration }) => [at, condition, duration]),
    [
      [0.2, 'Poisoned', 0.3],
      [1.2, 'Bleeding', 0.4],
      [2.2, 'Torment', 0.5]
    ]
  );
});
