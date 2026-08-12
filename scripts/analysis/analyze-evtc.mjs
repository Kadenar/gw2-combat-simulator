import { readFile } from "node:fs/promises";

import { decompressEvtcInput } from "../../dist/js/evtc-analyzer/decompression.js";
import { parseEvtc } from "../../dist/js/evtc-analyzer/parser.js";

const input = process.argv[2];
if (!input) {
  console.error(
    "Usage: npm run build && node scripts/analysis/analyze-evtc.mjs " +
      "<fight.evtc|fight.evtc.zip|fight.zevtc> [--summary] " +
      "[--debug-skill=<ids>] [--debug-name=<fragment>] [--debug-state=<ids>]",
  );
  process.exit(1);
}

const summaryOnly = process.argv.includes("--summary");
const numericOption = (prefix) =>
  new Set(
    process.argv
      .filter((argument) => argument.startsWith(prefix))
      .flatMap((argument) => argument.slice(prefix.length).split(","))
      .map(Number)
      .filter(Number.isFinite),
  );
const debugSkillIds = numericOption("--debug-skill=");
const debugStateChanges = numericOption("--debug-state=");
const debugNames = process.argv
  .filter((argument) => argument.startsWith("--debug-name="))
  .map((argument) => argument.slice("--debug-name=".length).toLowerCase())
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
    subgroup: agent.subgroup,
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
          subgroup: agent.subgroup,
        })),
        skills: log.skills,
      }),
  ...(debugSkillIds.size || debugStateChanges.size || debugNames.length
    ? {
        debugEvents: log.events
          .filter((event) => {
            const name = skillNames.get(event.skillId) || "";
            return (
              debugSkillIds.has(event.skillId) ||
              debugStateChanges.has(event.stateChange) ||
              debugNames.some((fragment) =>
                name.toLowerCase().includes(fragment),
              )
            );
          })
          .map((event) => ({
            ...event,
            source: `0x${event.source.toString(16)}`,
            target: `0x${event.target.toString(16)}`,
            skill: skillNames.get(event.skillId) || `Unknown ${event.skillId}`,
          })),
      }
    : {}),
};

console.log(JSON.stringify(report, null, 2));
