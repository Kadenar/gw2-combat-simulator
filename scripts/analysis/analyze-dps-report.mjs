/**
 * Inspects a dps.report Elite Insights page and prints one player's rotation and
 * damage distribution as JSON.
 *
 * Accepts either a saved report HTML file or a `https://dps.report/...` URL,
 * extracts the embedded `_logData` assignment, inflates it when it is a
 * base64/deflate blob, then selects a phase and player and emits their cast list
 * and per-skill damage breakdown.
 *
 * Usage: node scripts/analysis/analyze-dps-report.mjs <report.html|URL>
 *   [--summary]                 Collapse casts into per-skill/status counts.
 *   [--player=<index|name|account>]  Defaults to the first player.
 *   [--phase=<index|name>]      Defaults to the first phase.
 */
import fs from 'node:fs';
import { inflateSync } from 'node:zlib';

const args = process.argv.slice(2);
const input = args.find((argument) => !argument.startsWith('--'));
if (!input) {
  console.error(
    'Usage: node scripts/analysis/analyze-dps-report.mjs ' +
      '<report.html|https://dps.report/...> [--summary] ' +
      '[--player=<index|name|account>] [--phase=<index|name>]'
  );
  process.exit(1);
}

const summaryOnly = args.includes('--summary');
const playerSelector = optionValue('player');
const phaseSelector = optionValue('phase');

function optionValue(name) {
  return args.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function readInput(source) {
  if (!/^https?:\/\//i.test(source)) {
    return fs.readFileSync(source, 'utf8');
  }

  const response = await fetch(source, {
    headers: { 'user-agent': 'gw2-combat-simulator report analyzer' },
    redirect: 'follow'
  });
  if (!response.ok) {
    throw new Error(`Unable to download ${source}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function extractAssignment(html, name, nextName) {
  const marker = `const ${name} = `;
  const start = html.indexOf(marker);
  if (start < 0) {
    throw new Error(`The report does not contain an embedded ${name} value.`);
  }

  const valueStart = start + marker.length;
  const nextMarker = nextName ? html.indexOf(`const ${nextName}`, valueStart) : -1;
  const scriptEnd = html.indexOf('</script>', valueStart);
  const valueEnd = nextMarker >= 0 ? nextMarker : scriptEnd;
  if (valueEnd < 0) {
    throw new Error(`The embedded ${name} value is not terminated.`);
  }

  return html.slice(valueStart, valueEnd).trim().replace(/;\s*$/, '');
}

function decodeLogData(html) {
  let logData;
  try {
    logData = JSON.parse(extractAssignment(html, '_logData', '_crData'));
  } catch (error) {
    throw new Error(`Unable to parse the report's embedded log data: ${error}`);
  }

  if (typeof logData !== 'string') return logData;

  try {
    const compressed = Buffer.from(logData, 'base64');
    return JSON.parse(inflateSync(compressed).toString('utf8'));
  } catch (error) {
    throw new Error(`Unable to inflate the report's embedded log data: ${error}`);
  }
}

function resolveIndex(items, selector, label, fields) {
  if (selector == null || selector === '') return 0;

  if (/^\d+$/.test(selector)) {
    const index = Number(selector);
    if (index >= 0 && index < items.length) return index;
  }

  const normalized = selector.toLowerCase();
  const index = items.findIndex((item) =>
    fields.some((field) =>
      String(item[field] ?? '')
        .toLowerCase()
        .includes(normalized)
    )
  );
  if (index >= 0) return index;

  throw new Error(
    `Unknown ${label} ${JSON.stringify(selector)}. Available ${label}s: ${items
      .map((item, itemIndex) => `${itemIndex}:${item[fields[0]]}`)
      .join(', ')}`
  );
}

const ROTATION_STATUS = new Map([
  [0, 'unknown'],
  [1, 'reduced-aftercast'],
  [2, 'cancelled'],
  [3, 'full-aftercast'],
  [4, 'instant']
]);

function skillMetadata(logData, skillId, isBuff = false) {
  const map = isBuff ? logData.buffMap : logData.skillMap;
  return map?.[`${isBuff ? 'b' : 's'}${skillId}`] ?? null;
}

function rotationEntries(logData, player, phaseIndex) {
  return (player.details?.rotation?.[phaseIndex] ?? []).map(([at, skillId, durationMs, statusId, quickness]) => {
    const skill = skillMetadata(logData, skillId);
    return {
      at,
      skillId,
      skill: skill?.name ?? `Unknown ${skillId}`,
      durationMs,
      status: ROTATION_STATUS.get(statusId) ?? `unknown-${statusId}`,
      quickness,
      autoAttack: skill?.aa === true,
      weaponSwap: skill?.isSwap === true,
      gearProc: skill?.gearProc === true,
      traitProc: skill?.traitProc === true,
      unconditionalProc: skill?.unconditionalProc === true
    };
  });
}

function damageEntries(logData, player, phaseIndex) {
  const distribution = player.details?.dmgDistributions?.[phaseIndex]?.distribution ?? [];
  return distribution
    .map((row) => {
      const isBuff = row[0] === true;
      const skillId = row[1];
      const skill = skillMetadata(logData, skillId, isBuff);
      return {
        skillId,
        skill: skill?.name ?? `Unknown ${skillId}`,
        indirectDamage: isBuff,
        damage: row[2],
        minimumDamage: row[3],
        maximumDamage: row[4],
        casts: row[5],
        connectedHits: row[6],
        criticalHits: row[7],
        flankingHits: row[8],
        glancingHits: row[9],
        barrierDamage: row[12],
        criticalDamage: row[13],
        totalHits: row[14],
        castDurationMs: row[15],
        againstMovingHits: row[16]
      };
    })
    .sort((left, right) => right.damage - left.damage);
}

function summarizeCasts(casts) {
  return [
    ...casts
      .filter((cast) => !cast.gearProc && !cast.traitProc && !cast.unconditionalProc)
      .reduce((counts, cast) => {
        const key = `${cast.skillId}:${cast.status}`;
        const current = counts.get(key) ?? {
          skillId: cast.skillId,
          skill: cast.skill,
          status: cast.status,
          casts: 0,
          averageDurationMs: 0
        };
        current.averageDurationMs = (current.averageDurationMs * current.casts + cast.durationMs) / (current.casts + 1);
        current.casts += 1;
        counts.set(key, current);
        return counts;
      }, new Map())
      .values()
  ].sort((left, right) => right.casts - left.casts);
}

const html = await readInput(input);
const logData = decodeLogData(html);
if (!Array.isArray(logData.phases) || !Array.isArray(logData.players)) {
  throw new Error('The embedded Elite Insights data has no phases or players.');
}

const phaseIndex = resolveIndex(logData.phases, phaseSelector, 'phase', ['name', 'nameNoMode']);
const playerIndex = resolveIndex(logData.players, playerSelector, 'player', ['name', 'acc']);
const phase = logData.phases[phaseIndex];
const player = logData.players[playerIndex];
const durationSeconds = Number(phase.duration) / 1000;
const totalDamage =
  player.details?.dmgDistributions?.[phaseIndex]?.contributedDamage ?? phase.dpsStats?.[playerIndex]?.[0] ?? 0;
const casts = rotationEntries(logData, player, phaseIndex);
const damage = damageEntries(logData, player, phaseIndex);

const report = {
  header: {
    source: input,
    logName: logData.logName,
    logStart: logData.logStart,
    logEnd: logData.logEnd,
    parser: logData.parser,
    arcVersion: logData.arcVersion,
    gw2Build: logData.gw2Build,
    evtcBuild: logData.evtcBuild,
    mapId: logData.mapID,
    triggerId: logData.triggerID,
    region: logData.region
  },
  phase: {
    index: phaseIndex,
    name: phase.name,
    start: phase.start,
    end: phase.end,
    durationSeconds,
    success: phase.success,
    targets: (phase.targets ?? []).map((targetIndex) => ({
      index: targetIndex,
      name: logData.targets?.[targetIndex]?.name,
      health: logData.targets?.[targetIndex]?.health
    }))
  },
  player: {
    index: playerIndex,
    name: player.name,
    account: player.acc,
    profession: player.profession,
    subgroup: player.group,
    weaponSets: player.weaponSets
  },
  combatWindow: {
    duration: durationSeconds,
    totalDamage,
    dps: durationSeconds > 0 ? totalDamage / durationSeconds : 0
  },
  ...(summaryOnly ? { casts: summarizeCasts(casts), damage } : { casts, damage })
};

console.log(JSON.stringify(report, null, 2));
