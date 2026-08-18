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
