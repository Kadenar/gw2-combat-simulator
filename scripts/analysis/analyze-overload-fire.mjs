/** Counts recorded Burning Bolt projectiles during Overload Fire casts. Run npm run build:modules first. */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { decompressEvtcInput } from '#gw2/integrations/logs/evtc/decompression.js';
import { parseEvtc } from '#gw2/integrations/logs/evtc/parser.js';
import { EVTC_STATE_CHANGE as STATE, EVTC_ACTIVATION as ACTIVATION } from '#gw2/integrations/logs/evtc/types.js';

const OVERLOAD_FIRE = 29706;
const BURNING_BOLT = 12853;
const MISSILE_CREATE = 57;
const USAGE = 'Usage: node scripts/analysis/analyze-overload-fire.mjs <fight.evtc|fight.zevtc|fight.evtc.zip> [--json]';

/** Keeps player ownership and recorded animation boundaries intact for both legacy and modern logs. */
export function analyzeOverloadFire(log) {
  if (log.header.revision !== 1) throw new Error('This analyzer requires EVTC combat-event revision 1.');

  const players = log.agents.filter((agent) => agent.profession === 6 && agent.elite === 48);
  const reports = players.map((player) => {
    const events = log.events.filter((event) => event.source === player.address).sort((a, b) => a.time - b.time);
    const combatStart = events.find((event) => event.stateChange === STATE.ENTER_COMBAT)?.time;
    const casts = [];
    const warnings = [];
    let active = null;
    let unassignedBurningBolts = 0;

    for (const event of events) {
      const legacy = event.stateChange === STATE.NONE;
      const starts =
        event.stateChange === STATE.ANIMATION_START ||
        (legacy && [ACTIVATION.START, ACTIVATION.QUICKNESS].includes(event.activation));
      const stops =
        event.stateChange === STATE.ANIMATION_STOP ||
        (legacy && [ACTIVATION.CANCEL_FIRE, ACTIVATION.CANCEL_CANCEL, ACTIVATION.RESET].includes(event.activation));

      // A subsequent animation bounds a missing stop; its completion status remains unknown.
      if (starts) {
        if (active) active = null;
        if (event.skillId === OVERLOAD_FIRE) {
          active = {
            cast: casts.length + 1,
            startMs: event.time,
            combatTimeSeconds: combatStart == null ? null : (event.time - combatStart) / 1000,
            durationMs: null,
            status: 'unknown',
            burningBolts: 0
          };
          casts.push(active);
        }
      } else if (stops && event.skillId === OVERLOAD_FIRE && active) {
        active.durationMs = event.time - active.startMs;
        active.status =
          event.activation === ACTIVATION.CANCEL_CANCEL
            ? 'interrupted'
            : [ACTIVATION.CANCEL_FIRE, ACTIVATION.RESET].includes(event.activation)
              ? 'completed'
              : 'unknown';
        active = null;
      } else if (event.stateChange === MISSILE_CREATE && event.skillId === BURNING_BOLT) {
        // Launch/remove records repeat the projectile; only creation records count, including simultaneous bolts.
        if (active) active.burningBolts += 1;
        else unassignedBurningBolts += 1;
      }
    }

    if (!events.some((event) => event.stateChange === MISSILE_CREATE)) {
      warnings.push(
        'No projectile creation records for this player; zero recorded bolts does not establish zero finishers.'
      );
    }

    if (casts.some((cast) => cast.status === 'unknown')) {
      warnings.push('Some cast boundaries or completion states are missing; their bolt attribution is provisional.');
    }

    if (unassignedBurningBolts) {
      warnings.push('Some Burning Bolts fall outside recorded Overload Fire casts and are excluded from the total.');
    }

    return {
      character: player.character,
      account: player.account,
      address: `0x${player.address.toString(16)}`,
      totalCasts: casts.length,
      completedCasts: casts.filter((cast) => cast.status === 'completed').length,
      burningBolts: casts.reduce((sum, cast) => sum + cast.burningBolts, 0),
      unassignedBurningBolts,
      casts,
      warnings
    };
  });

  return {
    arcdpsBuild: log.header.arcdpsBuild,
    note: 'Counts recorded Burning Bolt projectiles, not unique whirl pulses or confirmed hits. Burning applications share a skill ID, so hits are not inferred.',
    players: reports
  };
}

/** Prints a readable per-player breakdown by default, with JSON available for saving or further analysis. */
async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } }
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }

  if (positionals.length !== 1) throw new Error(USAGE);

  const log = parseEvtc(await decompressEvtcInput(await readFile(positionals[0])));
  const report = analyzeOverloadFire(log);
  if (values.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Overload Fire analysis: ${positionals[0]}`);
  if (!report.players.length) console.log('No Tempest players found.');
  for (const player of report.players) {
    console.log(`\n${player.character} (${player.account})`);
    console.log(
      `${player.burningBolts} recorded Burning Bolts across ${player.totalCasts} casts (${player.completedCasts} completed).`
    );
    console.table(
      player.casts.map((cast) => ({
        Cast: cast.cast,
        'Combat time (s)': cast.combatTimeSeconds,
        'Duration (ms)': cast.durationMs,
        Status: cast.status,
        'Burning Bolts': cast.burningBolts
      }))
    );
    for (const warning of player.warnings) console.log(`Warning: ${warning}`);
  }

  console.log(`\n${report.note}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
