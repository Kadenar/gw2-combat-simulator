/**
 * Parses a raw arcdps EVTC combat log and prints its contents as JSON.
 *
 * Decompresses the input (plain `.evtc`, `.zevtc`, or zipped), parses it with the
 * project's EVTC parser, and emits the log header, the player agents, and — unless
 * `--summary` is given — every agent and skill. Optional `--debug-*` filters pull
 * matching combat events into a `debugEvents` array for troubleshooting.
 *
 * Requires a prior `npm run build` so the selected game's compiled log integration exists.
 *
 * Usage: node scripts/analysis/analyze-evtc.mjs <fight.evtc|.evtc.zip|.zevtc>
 *   [--summary]                Emit only header + players.
 *   [--debug-skill=<ids>]      Comma-separated skill ids to include as events.
 *   [--debug-name=<fragment>]  Skill-name substring to include as events.
 *   [--debug-state=<ids>]      Comma-separated state-change ids to include.
 */
import { readFile } from 'node:fs/promises';

import { decompressEvtcInput } from '#gw2/integrations/logs/evtc/decompression.js';
import { parseEvtc } from '#gw2/integrations/logs/evtc/parser.js';
import { parseGameOption } from '../lib/game-data.mjs';

const { gameId, args } = parseGameOption(process.argv.slice(2));
if (gameId !== 'gw2') throw new TypeError(`Game "${gameId}" does not support EVTC logs.`);
const input = args[0];

if (!input) {
  console.error(
    'Usage: npm run build && node scripts/analysis/analyze-evtc.mjs ' +
      '<fight.evtc|fight.evtc.zip|fight.zevtc> [--summary] ' +
      '[--debug-skill=<ids>] [--debug-name=<fragment>] [--debug-state=<ids>]'
  );
  process.exit(1);
}

const summaryOnly = args.includes('--summary');
const numericOption = (prefix) =>
  new Set(
    args
      .filter((argument) => argument.startsWith(prefix))
      .flatMap((argument) => argument.slice(prefix.length).split(','))
      .map(Number)
      .filter(Number.isFinite)
  );
const debugSkillIds = numericOption('--debug-skill=');
const debugStateChanges = numericOption('--debug-state=');
const debugNames = args
  .filter((argument) => argument.startsWith('--debug-name='))
  .map((argument) => argument.slice('--debug-name='.length).toLowerCase())
  .filter(Boolean);

const source = await readFile(input);
const expanded = await decompressEvtcInput(source);
const log = parseEvtc(expanded);
const skillNames = new Map(log.skills.map((skill) => [skill.id, skill.name]));
const players = log.agents
  .filter((agent) => agent.elite !== 0xffffffff)
  .map((agent) => ({
    address: `0x${agent.address.toString(16)}`,
    profession: agent.profession,
    elite: agent.elite,
    character: agent.character,
    account: agent.account,
    subgroup: agent.subgroup
  }));
const report = {
  header: log.header,
  players,
  ...(summaryOnly
    ? {}
    : {
        agents: log.agents.map((agent) => ({
          address: `0x${agent.address.toString(16)}`,
          profession: agent.profession,
          elite: agent.elite,
          character: agent.character,
          account: agent.account,
          subgroup: agent.subgroup
        })),
        skills: log.skills
      }),
  ...(debugSkillIds.size || debugStateChanges.size || debugNames.length
    ? {
        debugEvents: log.events
          .filter((event) => {
            const name = skillNames.get(event.skillId) || '';

            return (
              debugSkillIds.has(event.skillId) ||
              debugStateChanges.has(event.stateChange) ||
              debugNames.some((fragment) => name.toLowerCase().includes(fragment))
            );
          })
          .map((event) => ({
            ...event,
            source: `0x${event.source.toString(16)}`,
            target: `0x${event.target.toString(16)}`,
            skill: skillNames.get(event.skillId) || `Unknown ${event.skillId}`
          }))
      }
    : {})
};

console.log(JSON.stringify(report, null, 2));
