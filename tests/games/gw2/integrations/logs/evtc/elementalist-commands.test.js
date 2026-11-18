// Owned elemental command signals must become playable inputs even without skill-name metadata.
import assert from 'node:assert/strict';
import test from 'node:test';

import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';

for (const [species, rawSkillId, skillId] of [
  [6524, 25499, ID.FLAME_BARRAGE_ELEMENTAL_COMMAND],
  [6523, 25498, ID.STOMP_ELEMENTAL_COMMAND]
]) {
  test(`Elementalist command ${rawSkillId} resolves only the selected player's summon`, () => {
    const summon = 0x2000n;
    const otherSummon = 0x3000n;
    const fixture = log({
      agents: [
        { ...log().agents[0], profession: 6, elite: 80 },
        { address: summon, profession: species, elite: 0xffffffff },
        { address: otherSummon, profession: species, elite: 0xffffffff }
      ],
      skills: [],
      events: [
        event({ stateChange: 1 }),
        event({
          time: 1100,
          skillId: 59536,
          stateChange: 69,
          target: summon,
          targetInstance: 2,
          targetMasterInstance: 1,
          value: 1000
        }),
        event({
          time: 2000,
          source: otherSummon,
          sourceInstance: 3,
          target: otherSummon,
          targetInstance: 3,
          skillId: 59536,
          stateChange: 69,
          value: 1000
        }),
        event({ time: 3000, source: PLAYER, stateChange: 2 })
      ]
    });
    const result = reconstructEvtcRotation(fixture, elementalistCatalog);
    const commands = result.rotation.filter((command) => command.type === 'cast');
    assert.deepEqual(commands, [{ type: 'cast', skillId }]);
    assert.ok(result.actions.some((action) => action.rawSkillId === rawSkillId && action.supportedByCatalog));
    assert.doesNotMatch(result.warnings.join('\n'), /not present in the supplied simulator catalog/);
  });
}
