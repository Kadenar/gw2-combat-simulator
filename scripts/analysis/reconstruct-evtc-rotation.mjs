/**
 * Reconstructs a simulator-format rotation from a raw EVTC combat log.
 *
 * Parses the log, detects the recorded players, and picks the acting player (or the
 * one named by `--player=`). It then maps that player's animation activations, state
 * changes, and instant-skill effects onto the profession catalog to produce a
 * rotation the simulator can replay, printed as JSON with metadata and warnings.
 *
 * Requires a prior `npm run build:modules` for the compiled `dist/js` modules.
 *
 * Usage: node scripts/analysis/reconstruct-evtc-rotation.mjs <fight.evtc|.evtc.zip|.zevtc>
 *   [--player=<hex-address>]   Disambiguate when several players are recorded.
 *   [--timeline]               Include the intermediate reconstructed actions.
 *   [--no-instant-inference]   Skip inference of instant (untimed) casts.
 */
import { readFile } from 'node:fs/promises';

import '../testing/register-dist-loader.mjs';
import { loadProfession } from '../../dist/js/app/profession/registry.js';
import { decompressEvtcInput } from '../../dist/js/evtc-analyzer/decompression.js';
import { parseEvtc } from '../../dist/js/evtc-analyzer/parser.js';
import { detectEvtcRotationPlayers, reconstructEvtcRotation } from '../../dist/js/evtc-analyzer/rotation/index.js';

const input = process.argv[2];

if (!input) {
  console.error(
    'Usage: npm run build:modules && node ' +
      'scripts/analysis/reconstruct-evtc-rotation.mjs ' +
      '<fight.evtc|fight.evtc.zip|fight.zevtc> ' +
      '[--player=<hex-address>] [--timeline] [--no-instant-inference]'
  );
  process.exit(1);
}

const option = (prefix) => process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
const requestedAddress = option('--player=');
const source = await readFile(input);
const expanded = await decompressEvtcInput(source);
const log = parseEvtc(expanded);
const players = detectEvtcRotationPlayers(log);

let selected;

if (requestedAddress) {
  let address = null;

  try {
    address = BigInt(requestedAddress);
  } catch {
    address = null;
  }

  selected = players.find((player) => address != null && BigInt(player.address) === address);
} else if (players.length === 1 || players[0]?.recordedActionCount > players[1]?.recordedActionCount) {
  selected = players[0];
}

if (!selected) {
  console.error(
    JSON.stringify(
      {
        error: players.length
          ? 'Multiple players are equally likely. Re-run with --player=<address>.'
          : 'No supported player was found.',
        players
      },
      null,
      2
    )
  );
  process.exit(2);
}

const profession = await loadProfession(selected.professionId);
const result = reconstructEvtcRotation(log, profession?.catalog || null, {
  playerAddress: selected.address,
  inferInstantCasts: !process.argv.includes('--no-instant-inference')
});
const output = {
  metadata: {
    log: input,
    arcdpsBuild: log.header.arcdpsBuild,
    player: result.player,
    parser: result.parserId,
    timingSource: 'EVTC animation activations, state changes, and direct instant-skill effects',
    combatStartTimestampMs: result.combatStartTimestampMs,
    warnings: result.warnings,
    ...(process.argv.includes('--timeline') ? { reconstructedActions: result.actions } : {})
  },
  rotation: result.rotation
};

console.log(JSON.stringify(output, null, 2));
