/** Extract only encounter health and armor evidence; player names, accounts, rotations, and instance addresses are discarded. */
export function extractEncounterHealth(data, source) {
  const html = source.format === 'ei-html';

  if (!html && source.format !== 'ei-json') throw new Error('Unsupported EI report format.');

  const phase = data.phases?.[0];
  const success = html ? phase?.success : data.success;
  const encounterId = html ? data.logID : data.eiEncounterID;
  const mode = html
    ? { 'Normal Mode': 'normal', 'Challenge Mode': 'challenge', 'Legendary Challenge Mode': 'legendary' }[phase?.mode]
    : data.isLegendaryCM
      ? 'legendary'
      : data.isCM
        ? 'challenge'
        : 'normal';

  if (
    success !== true ||
    encounterId !== Number.parseInt(source.encounterId, 16) ||
    mode !== source.difficulty ||
    data.triggerID !== source.triggerId ||
    !Array.isArray(data.targets)
  ) {
    throw new Error(`Report identity, success, or difficulty does not match ${source.report}.`);
  }

  const targets = source.primaryTargetIndexes.map((index) => {
    const target = data.targets[index];
    const health = html ? target?.health : target?.totalHealth;
    const toughness = html ? target?.tough : target?.toughness;

    if (!Number.isSafeInteger(toughness) || toughness < 0) throw new Error(`Invalid EI toughness at target ${index}.`);

    // Level-80 encounter NPC armor combines the report's toughness with 1,223 base defense.
    const armor = toughness + 1223;

    if (!target || typeof target.name !== 'string' || !Number.isSafeInteger(health) || (health !== -1 && health <= 0))
      throw new Error(`Invalid EI health at target ${index}.`);

    if (html && phase.targetPriorities[phase.targets.indexOf(index)] !== 0)
      throw new Error('Expected a primary encounter target.');

    // EI HTML exposes segmented bars explicitly; the raw JSON sources in this manifest have a single bar.
    if (!html && target.healthBars?.length)
      throw new Error('Add explicit raw JSON health-bar extraction before importing this target.');

    const healthBars = html ? (target.hpBars ?? null) : null;

    if (
      healthBars !== null &&
      (!Array.isArray(healthBars) ||
        healthBars.some(
          (bar) => !Array.isArray(bar) || bar.length !== 4 || bar.some((value) => !Number.isFinite(value))
        ))
    )
      throw new Error('Invalid segmented EI health bars.');

    return { index, name: target.name, health, armor, primary: true, healthBars };
  });
  return {
    encounterId: source.encounterId,
    difficulty: source.difficulty,
    report: source.report,
    endpoint: source.endpoint,
    parser: html ? data.parser : `Elite Insights ${data.eliteInsightsVersion}`,
    gw2Build: html ? data.gw2Build : data.gW2Build,
    targets
  };
}

/** The selected report is explicit; cross-checks never average observations or silently overwrite conflicting totals. */
export function combineEncounterHealth(reports) {
  const [selected] = reports;

  if (!selected) throw new Error('An encounter needs an EI source report.');

  const signature = (report) =>
    JSON.stringify(
      report.targets
        .map(({ health, healthBars, armor }) => ({ health, healthBars, armor }))
        .sort((a, b) => a.health - b.health)
    );
  const corroboratingReports = [];
  const differingReports = [];
  for (const other of reports.slice(1)) {
    if (other.encounterId !== selected.encounterId || other.difficulty !== selected.difficulty)
      throw new Error('Cannot combine different encounters or difficulties.');

    (signature(other) === signature(selected) ? corroboratingReports : differingReports).push(other.report);
  }

  return { ...selected, corroboratingReports, differingReports };
}

/** Ship only encounter mechanics data so report URLs and collection metadata never enter the simulator. */
export function runtimeEncounterHealth({ encounterId, difficulty, targets }) {
  return { encounterId, difficulty, targets };
}
