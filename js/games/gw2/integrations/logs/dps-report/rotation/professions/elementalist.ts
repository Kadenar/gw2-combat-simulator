import { GW2_ACTION_TICK_MS, quicknessReferenceCastTimeMs } from '#gw2/platform/skills/timing.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS as ID
} from '#gw2/professions/elementalist/data/ids.js';
import { FIRE_ELEMENTAL_EVTC_PROFILE } from '#gw2/professions/elementalist/core/mechanics/elementals/profiles.js';
import { normalizedName as normalized, recordedActionSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { firstStrikePacketOffsetMs } from '#gw2/integrations/logs/lib/rotation/timing.js';
import { createInferredAction } from '#gw2/integrations/logs/dps-report/rotation/create-inferred-action.js';
import { primaryTargetHits } from '#gw2/integrations/logs/dps-report/rotation/target-damage.js';
import type {
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '#gw2/integrations/logs/dps-report/rotation/types.js';

type Element = keyof typeof ELEMENTALIST_ATTUNEMENT_SKILL_IDS;

interface ElementalistSkillIdentity {
  readonly name: string;
  readonly skillId: number;
}

interface AuraRecoveryConfig extends ElementalistSkillIdentity {
  readonly buffId: number;
  readonly weapon: string;
  readonly weaponSlot: 'main-hand' | 'off-hand';
  readonly swapElement: Element | null;
  readonly baseSources: ReadonlySet<string>;
  readonly pistolSources?: ReadonlySet<string>;
}

const ELEMENTS = new Set<Element>(['Fire', 'Water', 'Air', 'Earth']);
const SHORTENABLE_SKILLS = new Map([
  ['Flamestrike', 440],
  ['Arc Lightning', 2600]
]);
const ATTUNEMENT_SUFFIX_SKILLS = new Set(['Glyph of Elemental Power', 'Primordial Stance', 'Deploy Jade Sphere']);
const SPEAR_ETCHING_BY_FULL_SKILL = new Map<string, ElementalistSkillIdentity>([
  ['Volcano', { name: 'Etching: Volcano', skillId: ID.ETCHING_VOLCANO }],
  ['Jökulhlaup', { name: 'Etching: Jökulhlaup', skillId: ID.ETCHING_JO_KULHLAUP }],
  ['Derecho', { name: 'Etching: Derecho', skillId: ID.ETCHING_DERECHO }],
  ['Haboob', { name: 'Etching: Haboob', skillId: ID.ETCHING_HABOOB }]
]);
const AERIAL_AGILITY_CHAIN: readonly ElementalistSkillIdentity[] = Object.freeze([
  { name: 'Aerial Agility', skillId: ID.AERIAL_AGILITY },
  { name: 'Aerial Agility (chain)', skillId: ID.AERIAL_AGILITY_CHAIN },
  { name: 'Aerial Agility (dash)', skillId: ID.AERIAL_AGILITY_DASH }
]);
// Aerial Agility's flip survives intervening skills and expires roughly five
// seconds after the last stage, matching the live skill-slot behavior.
const AERIAL_AGILITY_FLIP_WINDOW_MS = 5000;
const GLYPH_OF_STORMS = new Map<string, ElementalistSkillIdentity>([
  ['Firestorm', { name: 'Glyph of Storms (Fire)', skillId: ID.GLYPH_OF_STORMS_FIRE }],
  ['Ice Storm', { name: 'Glyph of Storms (Water)', skillId: ID.GLYPH_OF_STORMS_WATER }],
  ['Lightning Storm', { name: 'Glyph of Storms (Air)', skillId: ID.GLYPH_OF_STORMS_AIR }],
  ['Sandstorm', { name: 'Glyph of Storms (Earth)', skillId: ID.GLYPH_OF_STORMS_EARTH }]
]);
const AURA_SOURCE_GRACE_MS = 150;
const IGNITE_DAMAGE_SKILL_ID = 76882;
const FLAME_BARRAGE_FIRST_PACKET_MS = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage.projectileImpacts[0] * 1000;
const AURA_RECOVERY: readonly AuraRecoveryConfig[] = Object.freeze([
  {
    buffId: 5677,
    name: 'Fire Shield',
    skillId: ID.FIRE_SHIELD,
    weapon: 'Focus',
    weaponSlot: 'off-hand',
    swapElement: 'Fire',
    baseSources: new Set(['Feel the Burn!', 'Signet of Fire', 'Conflagration', 'Overload Fire']),
    pistolSources: new Set(['Elemental Explosion', 'Searing Salvo', 'Frostfire Flurry'])
  },
  {
    buffId: 5579,
    name: 'Frost Aura',
    skillId: ID.FROST_AURA,
    weapon: 'Dagger',
    weaponSlot: 'off-hand',
    swapElement: null,
    baseSources: new Set(['Overload Water']),
    pistolSources: new Set(['Elemental Explosion', 'Flowing Finesse'])
  },
  {
    buffId: 5577,
    name: 'Shocking Aura',
    skillId: ID.SHOCKING_AURA,
    weapon: 'Dagger',
    weaponSlot: 'main-hand',
    swapElement: null,
    baseSources: new Set(['Overload Air'])
  },
  {
    buffId: 5684,
    name: 'Magnetic Aura',
    skillId: ID.MAGNETIC_AURA,
    weapon: 'Staff',
    weaponSlot: 'main-hand',
    swapElement: null,
    baseSources: new Set(['Overload Earth', 'Aftershock!', 'Signet of Earth'])
  }
]);
const BLIND_BUFF_ID = 720;
const WEAKNESS_BUFF_ID = 742;
const BLINDING_FLASH_COOCCURRENCE_MS = 100;
const BLINDING_FLASH_SOURCE_WINDOW_MS = 1000;
const BLIND_SOURCES = new Set(['Dust Devil', 'Dust Storm']);
const WEAKNESS_SOURCES = new Set(['Lightning Blitz']);

function elementName(value: unknown): Element | null {
  const name = String(value || '').trim();
  const element = `${name.slice(0, 1).toUpperCase()}${name.slice(1).toLowerCase()}` as Element;
  return ELEMENTS.has(element) ? element : null;
}

function actionName(action: DpsReportRecordedAction): string {
  return action.canonicalName || action.rawName;
}

function namedSkill(context: DpsReportProfessionReconstructionContext, name: string): ElementalistSkillIdentity | null {
  const skill = context.catalog?.skills.find((candidate) => normalized(candidate.name) === normalized(name));
  return skill && typeof skill.id === 'number' ? { name: skill.name, skillId: Number(skill.id) } : null;
}

function canonicalize(action: DpsReportRecordedAction, identity: ElementalistSkillIdentity): DpsReportRecordedAction {
  return {
    ...action,
    canonicalSkillId: identity.skillId,
    canonicalName: identity.name
  };
}

function swappedElement(action: DpsReportRecordedAction): Element | null {
  if (!action.isSwap) return null;
  const dual = action.rawName.match(/^Dual (Fire|Water|Air|Earth) Attunement$/i);
  if (dual) return elementName(dual[1]);
  const woven = action.rawName.match(/^(Fire|Water|Air|Earth) (?:Fire|Water|Air|Earth) Attunement$/i);
  if (woven) return elementName(woven[1]);
  const core = action.rawName.match(/^(Fire|Water|Air|Earth) Attunement$/i);
  return core ? elementName(core[1]) : null;
}

function mappedGlyphElement(name: string): Element | null {
  const mapped = GLYPH_OF_STORMS.get(name)?.name.match(/\((Fire|Water|Air|Earth)\)$/)?.[1];
  return elementName(mapped);
}

function configuredStartingElement(context: DpsReportProfessionReconstructionContext): Element {
  return elementName(context.professionConfig?.startAttunement) || 'Fire';
}

function equippedWeapons(context: DpsReportProfessionReconstructionContext): {
  readonly primaryWeapon: string;
  readonly secondaryWeapon: string;
} {
  const reported = context.player.weaponSets?.find(({ timeframe }) => {
    if (!Array.isArray(timeframe) || timeframe.length < 2) return true;
    return Number(timeframe[0]) < context.phase.end && Number(timeframe[1]) > context.phase.start;
  })?.weapons;

  // Prefer an explicit imported build, then use EI's active weapon-set metadata so
  // standalone dps.report imports can recover omitted weapon skills safely.
  return {
    primaryWeapon: normalized(context.professionConfig?.primaryWeapon || reported?.[0]),
    secondaryWeapon: normalized(context.professionConfig?.secondaryWeapon || reported?.[1])
  };
}

function inferStartingElement(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): Element {
  for (const action of actions) {
    if (swappedElement(action)) break;
    const glyphElement = mappedGlyphElement(action.rawName);
    if (glyphElement) return glyphElement;
    const suffixElement = elementName(action.rawName.match(/\((Fire|Water|Air|Earth)\)$/)?.[1]);
    if (suffixElement) return suffixElement;
    const attunement = String(recordedActionSkill(action, context)?.attunement || '');
    const skillElement = attunement.includes('+') ? null : elementName(attunement);
    if (skillElement) return skillElement;
  }

  return configuredStartingElement(context);
}

function normalizeRecordedActions(context: DpsReportProfessionReconstructionContext): DpsReportRecordedAction[] {
  const sorted = [...context.recordedActions].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
  const result: DpsReportRecordedAction[] = [];
  let currentElement = inferStartingElement(context, sorted);
  let aerialAgilityIndex = -1;
  let lastAerialAgilityAt: number | null = null;

  for (const action of sorted) {
    const threshold = SHORTENABLE_SKILLS.get(action.rawName);
    let normalizedAction =
      action.status !== 'interrupted' && threshold != null && action.end - action.start < threshold
        ? { ...action, status: 'interrupted' as const }
        : action;

    if (action.rawName === 'Aerial Agility') {
      aerialAgilityIndex =
        lastAerialAgilityAt != null && action.start - lastAerialAgilityAt <= AERIAL_AGILITY_FLIP_WINDOW_MS
          ? (aerialAgilityIndex + 1) % AERIAL_AGILITY_CHAIN.length
          : 0;
      lastAerialAgilityAt = action.start;
      normalizedAction = canonicalize(normalizedAction, AERIAL_AGILITY_CHAIN[aerialAgilityIndex]);
    } else {
      const glyph = GLYPH_OF_STORMS.get(action.rawName);
      const element = swappedElement(action);
      if (glyph) {
        normalizedAction = canonicalize(normalizedAction, glyph);
      } else if (element) {
        normalizedAction = canonicalize(normalizedAction, {
          name: `${element} Attunement`,
          skillId: ELEMENTALIST_ATTUNEMENT_SKILL_IDS[element]
        });
        currentElement = element;
      } else if (ATTUNEMENT_SUFFIX_SKILLS.has(action.rawName)) {
        const skill = namedSkill(context, `${action.rawName} (${currentElement})`);
        if (skill) normalizedAction = canonicalize(normalizedAction, skill);
      }
    }

    result.push(normalizedAction);
  }

  return result;
}

function inSelectedPhase(context: DpsReportProfessionReconstructionContext, at: number): boolean {
  return at >= 0 && at >= context.phase.start && at < context.phase.end;
}

function inferredAction(
  identity: ElementalistSkillIdentity,
  at: number,
  eventIndex: number,
  inference: NonNullable<DpsReportRecordedAction['inference']>
): DpsReportRecordedAction {
  return createInferredAction({ id: identity.skillId, name: identity.name }, at, at, eventIndex, inference);
}

function activationTimes(states: readonly (readonly [number, number])[] | undefined, exactOne: boolean): number[] {
  if (!Array.isArray(states)) return [];
  const activations: number[] = [];
  let previous = 0;
  for (const state of states) {
    if (!Array.isArray(state) || state.length < 2) continue;
    const [at, value] = state;
    const active = exactOne ? value === 1 : value >= 1;
    if (previous === 0 && active && Number.isFinite(at)) activations.push(at);
    previous = value;
  }

  return activations;
}

function fireElementalHits(context: DpsReportProfessionReconstructionContext, skillId: number): number {
  if (context.report.targets?.length !== 1) return 0;
  const phaseIndex = context.report.phases.indexOf(context.phase);
  const elemental = context.player.minions?.find(
    (minion) => Number(minion.id) === 6524 || normalized(minion.name) === 'fire elemental'
  );
  const row = elemental?.targetDamageDist?.[0]?.[phaseIndex]?.find((entry) => Number(entry.id) === skillId);
  return Math.max(0, Number(row?.connectedHits ?? row?.hits ?? 0));
}

function recoverOpeningDragonsTooth(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  if (context.profile.specializationId !== 'evoker' || equippedWeapons(context).primaryWeapon !== 'scepter') return [];
  const ordered = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const recorded = ordered.filter(
    (action) => action.rawSkillId === ID.DRAGONS_TOOTH || action.canonicalSkillId === ID.DRAGONS_TOOTH
  );
  const firstAction = ordered[0];
  const skill = recorded[0] ? recordedActionSkill(recorded[0], context) : null;
  const duration = quicknessReferenceCastTimeMs(skill);
  if (
    !firstAction ||
    !skill ||
    !(duration > 0) ||
    primaryTargetHits(context, ID.DRAGONS_TOOTH) !== recorded.length + 1
  ) {
    return [];
  }

  // One surplus Dragon's Tooth hit proves EI clipped exactly one cast. Place that
  // setup cast against the first reported action, matching the scepter precast lane.
  return [
    createInferredAction(
      { id: ID.DRAGONS_TOOTH, name: "Dragon's Tooth" },
      firstAction.start - duration,
      firstAction.start,
      firstAction.eventIndex - 0.1,
      'elementalist-damage-evidence',
      { status: 'completed', expectedDurationMs: duration }
    )
  ];
}

function recoverOpeningIgnite(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  if (context.profile.specializationId !== 'evoker') return [];
  const identity = namedSkill(context, 'Ignite');
  const skill = context.catalog?.skills.find((candidate) => Number(candidate.id) === identity?.skillId) || null;
  const strikeOffset = firstStrikePacketOffsetMs(skill, 0, { explicitOnly: true });
  if (!identity || strikeOffset == null) return [];

  const ignites = actions.filter((action) => action.rawSkillId === ID.IGNITE || action.canonicalSkillId === ID.IGNITE);
  const reportedHits = ignites.filter(
    (action) => action.start + strikeOffset >= context.phase.start && action.start + strikeOffset < context.phase.end
  ).length;
  if (primaryTargetHits(context, IGNITE_DAMAGE_SKILL_ID) !== reportedHits + 1) return [];

  // A surplus raw familiar hit plus a late reported Ignite proves one clipped
  // activation; offset it before the phase so its modeled strike lands at the boundary.
  return [
    inferredAction(
      identity,
      context.phase.start - strikeOffset,
      Math.min(-0.05, ...actions.map((action) => action.eventIndex - 0.05)),
      'elementalist-damage-evidence'
    )
  ];
}

function recoverAuraActions(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[],
  nextEventIndex: () => number
): DpsReportRecordedAction[] {
  const { primaryWeapon, secondaryWeapon } = equippedWeapons(context);
  const hasPistol = primaryWeapon === 'pistol' || secondaryWeapon === 'pistol';
  const recovered: DpsReportRecordedAction[] = [];

  for (const config of AURA_RECOVERY) {
    const equippedWeapon = config.weaponSlot === 'main-hand' ? primaryWeapon : secondaryWeapon;
    if (equippedWeapon !== normalized(config.weapon)) continue;
    const skill = namedSkill(context, config.name);
    if (!skill) continue;
    const buffUptimes = Array.isArray(context.player.buffUptimes) ? context.player.buffUptimes : [];
    const states = buffUptimes.find((buff) => Number(buff.id) === config.buffId)?.states;
    const sources = new Set(config.baseSources);
    if (hasPistol) {
      for (const source of config.pistolSources || []) sources.add(source);
      // Elemental Epitome can grant Frost Aura from Frigid Flurry's projectile combos, without a dagger input.
      if (context.profile.specializationId === 'catalyst' && config.skillId === ID.FROST_AURA) {
        sources.add('Frigid Flurry');
      }
    }

    for (const at of activationTimes(states, true)) {
      if (!inSelectedPhase(context, at)) continue;
      const explained = actions.some((action) => {
        if (config.swapElement && swappedElement(action) === config.swapElement) {
          return Math.abs(action.start - at) <= AURA_SOURCE_GRACE_MS;
        }

        return (
          sources.has(actionName(action)) &&
          at >= action.start - AURA_SOURCE_GRACE_MS &&
          at <= action.end + AURA_SOURCE_GRACE_MS
        );
      });
      if (!explained) {
        recovered.push(inferredAction(skill, at, nextEventIndex(), 'elementalist-aura'));
      }
    }
  }

  return recovered;
}

function recoverBlindingFlashActions(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[],
  nextEventIndex: () => number
): DpsReportRecordedAction[] {
  if (equippedWeapons(context).primaryWeapon !== 'scepter') return [];
  const skill = namedSkill(context, 'Blinding Flash');
  if (!skill) return [];

  const blindTimes = new Set<number>();
  const weaknessTimes = new Set<number>();
  const targets = Array.isArray(context.report.targets) ? context.report.targets : [];
  for (const target of targets) {
    const buffs = Array.isArray(target.buffs) ? target.buffs : [];
    for (const buff of buffs) {
      const times =
        Number(buff.id) === BLIND_BUFF_ID ? blindTimes : Number(buff.id) === WEAKNESS_BUFF_ID ? weaknessTimes : null;
      if (!times) continue;
      for (const at of activationTimes(buff.states, false)) {
        if (inSelectedPhase(context, at)) times.add(at);
      }
    }
  }

  if (!blindTimes.size && !weaknessTimes.size) return [];

  const candidates = new Set<number>();
  if (blindTimes.size && weaknessTimes.size) {
    const sortedWeakness = [...weaknessTimes].sort((left, right) => left - right);
    let weaknessIndex = 0;
    for (const blindAt of [...blindTimes].sort((left, right) => left - right)) {
      while (
        weaknessIndex < sortedWeakness.length &&
        sortedWeakness[weaknessIndex] < blindAt - BLINDING_FLASH_COOCCURRENCE_MS
      ) {
        weaknessIndex += 1;
      }

      if (
        weaknessIndex < sortedWeakness.length &&
        Math.abs(sortedWeakness[weaknessIndex] - blindAt) <= BLINDING_FLASH_COOCCURRENCE_MS
      ) {
        candidates.add(blindAt);
      }
    }
  } else {
    for (const at of blindTimes.size ? blindTimes : weaknessTimes) candidates.add(at);
  }

  const recovered: DpsReportRecordedAction[] = [];
  const startingElement = inferStartingElement(context, actions);
  for (const at of candidates) {
    let currentElement = startingElement;
    // Blinding Flash occupies scepter 3 only in Air, so reject otherwise ambiguous condition evidence outside Air.
    for (const action of actions) {
      if (action.start > at) break;
      currentElement = swappedElement(action) || currentElement;
    }

    if (currentElement !== 'Air') continue;

    const hasBlindSource = actions.some(
      (action) =>
        BLIND_SOURCES.has(actionName(action)) && Math.abs(action.start - at) <= BLINDING_FLASH_SOURCE_WINDOW_MS
    );
    const hasWeaknessSource = actions.some(
      (action) =>
        WEAKNESS_SOURCES.has(actionName(action)) && Math.abs(action.start - at) <= BLINDING_FLASH_SOURCE_WINDOW_MS
    );
    if (blindTimes.size && weaknessTimes.size && hasBlindSource && hasWeaknessSource) continue;
    if (blindTimes.size && !weaknessTimes.size && hasBlindSource) continue;
    if (!blindTimes.size && weaknessTimes.size && hasWeaknessSource) continue;
    recovered.push(inferredAction(skill, at, nextEventIndex(), 'elementalist-blinding-flash'));
  }

  return recovered;
}

function recoverOpeningSpearEtching(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[],
  nextEventIndex: () => number
): DpsReportRecordedAction[] {
  const ordered = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const full = ordered.find((action) => SPEAR_ETCHING_BY_FULL_SKILL.has(actionName(action)));
  if (!full) return [];
  const identity = SPEAR_ETCHING_BY_FULL_SKILL.get(actionName(full));
  if (!identity) return [];
  if (ordered.some((action) => actionName(action) === identity.name && action.start < full.start)) return [];
  const skill = recordedActionSkill(
    {
      ...full,
      rawSkillId: identity.skillId,
      rawName: identity.name,
      canonicalSkillId: identity.skillId,
      canonicalName: identity.name
    },
    context
  );
  if (!skill) return [];
  const duration = Math.max(0, Number(skill.quicknessCastTimeMs || skill.castTimeMs || 0));
  const end = ordered[0]?.start ?? context.phase.start;

  // A full etching before its first base cast proves EI clipped the opening setup;
  // place that setup immediately before the earliest surviving report action.
  return [
    createInferredAction(
      { id: identity.skillId, name: identity.name },
      end - duration,
      end,
      nextEventIndex(),
      'elementalist-spear-etching',
      { status: 'completed', expectedDurationMs: duration }
    )
  ];
}

function recoverOpeningFlameBarrage(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[],
  openingEtching: readonly DpsReportRecordedAction[],
  nextEventIndex: () => number
): DpsReportRecordedAction[] {
  const primaryWeapon = equippedWeapons(context).primaryWeapon;
  if (context.profile.specializationId !== 'evoker' || !['scepter', 'spear'].includes(primaryWeapon)) return [];
  const recorded = actions.filter((action) => normalized(actionName(action)) === 'flame barrage');
  if (fireElementalHits(context, ID.FLAME_BARRAGE_ELEMENTAL_COMMAND) <= recorded.length * 4) return [];
  const firstAction = [...actions].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  )[0];
  if (!firstAction) return [];
  const at =
    primaryWeapon === 'scepter'
      ? context.phase.start - FLAME_BARRAGE_FIRST_PACKET_MS
      : Math.min(
          context.phase.start - GW2_ACTION_TICK_MS,
          firstAction.start + Math.max(0, Number(openingEtching[0]?.expectedDurationMs || 0))
        );

  // Four packets are the maximum per Flame Barrage command. Surplus minion hits
  // therefore prove EI clipped one pre-combat command from the player's rotation.
  return [
    createInferredAction(
      { id: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND, name: 'Flame Barrage' },
      at,
      at,
      nextEventIndex(),
      'elementalist-damage-evidence'
    )
  ];
}

/** Reconstructs Elementalist attunement variants and report-omitted weapon actions from EI evidence. */
export function reconstructElementalistDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const normalizedActions = normalizeRecordedActions(context);
  let eventIndex = Math.max(-1, ...normalizedActions.map((action) => action.eventIndex));
  const nextEventIndex = (): number => {
    eventIndex += 1;
    return eventIndex;
  };

  const recoveredEtching = recoverOpeningSpearEtching(context, normalizedActions, nextEventIndex);
  const recoveredFlameBarrage = recoverOpeningFlameBarrage(
    context,
    normalizedActions,
    recoveredEtching,
    nextEventIndex
  );
  const recoveredDragonsTooth = recoverOpeningDragonsTooth(context, normalizedActions);
  const recoveredIgnite = recoverOpeningIgnite(context, normalizedActions);
  const recoveredAuras = recoverAuraActions(context, normalizedActions, nextEventIndex);
  const recoveredBlindingFlash = recoverBlindingFlashActions(context, normalizedActions, nextEventIndex);
  return [
    ...normalizedActions,
    ...recoveredEtching,
    ...recoveredFlameBarrage,
    ...recoveredDragonsTooth,
    ...recoveredIgnite,
    ...recoveredAuras,
    ...recoveredBlindingFlash
  ].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}
