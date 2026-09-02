import { readFile } from 'node:fs/promises';

import '../testing/register-dist-loader.mjs';
import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { decompressEvtcInput } from '#gw2/integrations/logs/evtc/decompression.js';
import { parseEvtc } from '#gw2/integrations/logs/evtc/parser.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';

const adapter = await loadProfessionAppAdapter('necromancer');
const savedBuild = JSON.parse(
  await readFile('data/gw2/builds/necromancer/b-power-ritualist.json', 'utf8')
);
const build = adapter.toApplicationBuild({ ...savedBuild, rotation: [] });
const app = {
  build,
  adapter,
  profession: adapter.profession,
  skillByName: adapter.profession.catalog.skillsByName,
  skillById: adapter.profession.catalog.skillsById,
  attributeWeaponSet: 1
};
adapter.recalculate(app);

const source = await readFile(
  'F:/Downloads/sim benches/necro/ritualist/power ritualist bench.zevtc'
);
const log = parseEvtc(await decompressEvtcInput(source));
const professionConfig = adapter.simulationConfig(app);
const imported = reconstructEvtcRotation(log, adapter.profession.catalog, {
  playerAddress: '0x7d0',
  selectedSkillNames: Object.values(build.selectedSkills || {}),
  professionConfig
});
build.rotation = imported.rotation;
const result = adapter.simulateBuild(build.rotation, professionConfig);
const simCombatStartMs = result.steps.find((step) => step.skill === 'Combat Start').start;

const sourceActions = [...imported.actions];
let sourceIndex = 0;
const sourceByRotationIndex = new Map();
for (const [rotationIndex, command] of imported.rotation.entries()) {
  if (command.name.startsWith('__')) continue;
  const match = sourceActions.slice(sourceIndex).findIndex((action) => action.name === command.name);
  if (match < 0) throw new Error(`Could not align ${command.name} at rotation index ${rotationIndex}.`);
  sourceIndex += match;
  sourceByRotationIndex.set(rotationIndex, sourceActions[sourceIndex]);
  sourceIndex += 1;
}
const actionDrift = result.steps
  .filter((step) => sourceByRotationIndex.has(step.ri))
  .map((step) => {
    const sourceAction = sourceByRotationIndex.get(step.ri);
    const sourceStart = sourceAction.timestampMs - imported.combatStartTimestampMs;
    const simStart = step.start - simCombatStartMs;
    return {
      name: step.skill,
      sourceStart,
      sourceDuration: sourceAction.durationMs,
      simStart,
      simDuration: step.end - step.start,
      drift: Math.round(simStart - sourceStart),
      ri: step.ri
    };
  });

console.log(
  JSON.stringify(
    {
      sourceGravediggers: imported.actions
        .filter((action) => action.name === 'Gravedigger')
        .map((action) => ({
          start: action.timestampMs - imported.combatStartTimestampMs,
          duration: action.durationMs
        })),
      simGravediggers: result.steps
        .filter((step) => step.skill === 'Gravedigger')
        .map((step) => ({
          start: step.start - simCombatStartMs,
          end: step.end - simCombatStartMs,
          ri: step.ri
        })),
      driftChanges: actionDrift.filter(
        (row, index) => index === 0 || Math.abs(row.drift - actionDrift[index - 1].drift) >= 15
      ),
      lateDrift: actionDrift.filter((row) => row.sourceStart >= 74_000),
      earlyDrift: actionDrift.filter((row) => row.sourceStart >= 0 && row.sourceStart <= 30_000),
      middleDrift: actionDrift.filter((row) => row.sourceStart >= 30_000 && row.sourceStart <= 45_000),
      timelineOriginMs: imported.timelineOriginMs,
      encounterEndEvents: log.events
        .filter(
          (event) =>
            event.time >= imported.timelineOriginMs + imported.combatStartTimestampMs + 90_000 &&
            [1, 2, 4, 16, 17].includes(event.stateChange)
        )
        .map((event) => ({
          time: event.time - (imported.timelineOriginMs + imported.combatStartTimestampMs),
          source: `0x${event.source.toString(16)}`,
          target: `0x${event.target.toString(16)}`,
          skillId: event.skillId,
          value: event.value,
          stateChange: event.stateChange
        })),
      finalCombatEvents: log.events
        .filter(
          (event) =>
            event.time >= imported.timelineOriginMs + imported.combatStartTimestampMs + 91_000 &&
            event.time <= imported.timelineOriginMs + imported.combatStartTimestampMs + 93_000 &&
            (event.source === 0x7d0n || event.target === 0x7d0n)
        )
        .map((event) => ({
          time: event.time - (imported.timelineOriginMs + imported.combatStartTimestampMs),
          source: `0x${event.source.toString(16)}`,
          target: `0x${event.target.toString(16)}`,
          skillId: event.skillId,
          value: event.value,
          activation: event.activation,
          stateChange: event.stateChange,
          buff: event.buff
        })),
      lateAutoEvents: log.events
        .filter(
          (event) =>
            event.source === 0x7d0n &&
            [73_012, 73_040, 73_047].includes(event.skillId) &&
            event.time >= imported.timelineOriginMs + imported.combatStartTimestampMs + 78_000
        )
        .map((event) => ({
          time: event.time - (imported.timelineOriginMs + imported.combatStartTimestampMs),
          skillId: event.skillId,
          value: event.value,
          activation: event.activation,
          stateChange: event.stateChange,
          buff: event.buff
        })),
      latePerforates: imported.actions
        .filter((action) => action.name === 'Perforate' && action.timestampMs - imported.combatStartTimestampMs >= 85_000)
        .map((action) => ({
          start: action.timestampMs - imported.combatStartTimestampMs,
          duration: action.durationMs,
          status: action.status,
          command: imported.rotation.find((command) => command.sourceActionId === action.id)
        })),
      latePerforateEvents: log.events
        .filter(
          (event) =>
            event.source === 0x7d0n &&
            event.skillId === 73_068 &&
            event.time >= imported.timelineOriginMs + imported.combatStartTimestampMs + 88_000
        )
        .map((event) => ({
          time: event.time - (imported.timelineOriginMs + imported.combatStartTimestampMs),
          value: event.value,
          activation: event.activation,
          stateChange: event.stateChange,
          buff: event.buff
        })),
      dps: result.dps,
      simCombatStartMs,
      duration: result.duration,
      dpsStartTime: result.dpsStartTime,
      dpsWindow: result.dpsWindow,
      warnings: result.warnings
    },
    null,
    2
  )
);
