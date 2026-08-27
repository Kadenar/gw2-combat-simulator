import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Resolves one game's declared runtime-data roots from the repository manifest. */
export function resolveGameData(root, gameId) {
  const manifest = JSON.parse(readFileSync(path.join(root, 'data', 'games.json'), 'utf8'));
  const game = manifest.games.find(({ id }) => id === gameId);
  if (!game) throw new TypeError(`Unknown game "${gameId}".`);
  return Object.fromEntries(game.runtimeData.map(({ kind, source }) => [kind, path.resolve(root, source)]));
}

/** Reads and removes the shared --game option while preserving command-specific arguments. */
export function parseGameOption(args, fallback = 'gw2') {
  const values = args.filter((argument) => argument.startsWith('--game=')).map((argument) => argument.slice(7));
  if (values.length > 1) throw new TypeError('Specify --game only once.');
  const gameId = values[0] || fallback;
  return { gameId, args: args.filter((argument) => !argument.startsWith('--game=')) };
}
