/**
 * Reconstructs a simulator-format rotation from a dps.report log URL.
 *
 * Fetches the report, detects its players, and picks the acting player (or the one
 * named by `--player=`). It maps that player's Elite Insights cast summaries onto the
 * profession catalog for the chosen phase to produce a replayable rotation, printed as
 * JSON with metadata and warnings. An optional `--build=` file supplies active-build
 * skill selections so polymorphic skills resolve to the simulator's selected variant.
 *
 * Requires a prior `npm run build:modules` for the compiled `dist/js` modules.
 *
 * Usage: node scripts/analysis/reconstruct-dps-report-rotation.mjs <dps.report URL>
 *   [--player=<index|name|account>]  Disambiguate the recorded player.
 *   [--phase=<index>]                Phase to reconstruct (defaults to 0).
 *   [--build=<build.json>]           Active-build selections for polymorphic skills.
 *   [--timeline]                     Include the intermediate reconstructed actions.
 */
import { readFile } from 'node:fs/promises';

import '../testing/register-dist-loader.mjs';
import { loadProfession } from '../../dist/js/app/profession/registry.js';
import { fetchDpsReport } from '../../dist/js/dps-report-analyzer/url.js';
import {
  detectDpsReportRotationPlayers,
  reconstructDpsReportRotation
} from '../../dist/js/dps-report-analyzer/rotation/index.js';

const input = process.argv[2];

if (!input) {
  console.error(
    'Usage: npm run build:modules && node ' +
      'scripts/analysis/reconstruct-dps-report-rotation.mjs <dps.report URL> ' +
      '[--player=<index|name|account>] [--phase=<index>] [--build=<build.json>] [--timeline]'
  );
  process.exit(1);
}

const option = (prefix) => process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
const requestedPlayer = option('--player=');
const requestedPhase = option('--phase=');
const buildPath = option('--build=');
const report = await fetchDpsReport(input);
const players = detectDpsReportRotationPlayers(report);

let selected;

if (requestedPlayer != null) {
  const normalized = requestedPlayer.toLowerCase();

  selected = players.find(
    (player) =>
      String(player.index) === requestedPlayer ||
      player.character.toLowerCase().includes(normalized) ||
      player.account.toLowerCase().includes(normalized)
  );
} else if (players.length === 1 || players[0]?.recordedActionCount > players[1]?.recordedActionCount) {
  selected = players[0];
}

if (!selected) {
  console.error(
    JSON.stringify(
      {
        error: players.length
          ? 'Multiple players are equally likely. Re-run with --player=<index|name|account>.'
          : 'No supported player was found.',
        players
      },
      null,
      2
    )
  );
  process.exit(2);
}

let build = {};

if (buildPath) {
  build = JSON.parse(await readFile(buildPath, 'utf8'));
}

const profession = await loadProfession(selected.professionId);
const phaseIndex = requestedPhase == null ? 0 : Number(requestedPhase);
// Feed active-build selections into generic name/ID resolution so polymorphic
// skills (such as Amalgam protocols) use the simulator's selected variant.
const result = reconstructDpsReportRotation(report, profession?.catalog || null, {
  playerIndex: selected.index,
  phaseIndex,
  selectedSkillNames: Object.values(build.selectedSkills || {}),
  selectedSkillIds: build.selectedMorphSkillIds || [],
  // Profession recovery uses active state such as Revenant's starting legend;
  // passing the build keeps inference evidence-based across different reports.
  professionConfig: build
});
const output = {
  metadata: {
    report: input,
    eliteInsightsVersion: report.eliteInsightsVersion,
    player: result.player,
    phase: result.phase,
    parser: result.parserId,
    timingSource: 'Elite Insights cast summaries from dps.report',
    combatStartTimestampMs: result.combatStartTimestampMs,
    warnings: result.warnings,
    ...(process.argv.includes('--timeline') ? { reconstructedActions: result.actions } : {})
  },
  rotation: result.rotation
};

console.log(JSON.stringify(output, null, 2));
