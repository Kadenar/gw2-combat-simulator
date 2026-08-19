import type { Skill } from '../../../platform/engine/types.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS as ID
} from '../../../professions/elementalist/data/ids.js';
import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../types.js';

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
const AERIAL_AGILITY_CHAIN: readonly ElementalistSkillIdentity[] = Object.freeze([
  { name: 'Aerial Agility', skillId: ID.AERIAL_AGILITY },
  { name: 'Aerial Agility (chain)', skillId: ID.AERIAL_AGILITY_CHAIN },
  { name: 'Aerial Agility (dash)', skillId: ID.AERIAL_AGILITY_DASH }
]);
const CHAIN_RESET_MS = 4000;
const GLYPH_OF_STORMS = new Map<string, ElementalistSkillIdentity>([
  ['Firestorm', { name: 'Glyph of Storms (Fire)', skillId: ID.GLYPH_OF_STORMS_FIRE }],
  ['Ice Storm', { name: 'Glyph of Storms (Water)', skillId: ID.GLYPH_OF_STORMS_WATER }],
  ['Lightning Storm', { name: 'Glyph of Storms (Air)', skillId: ID.GLYPH_OF_STORMS_AIR }],
  ['Sandstorm', { name: 'Glyph of Storms (Earth)', skillId: ID.GLYPH_OF_STORMS_EARTH }]
]);
const AURA_WINDOW_MS = 1500;
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

function normalized(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function elementName(value: unknown): Element | null {
  const name = String(value || '').trim();
  const element = `${name.slice(0, 1).toUpperCase()}${name.slice(1).toLowerCase()}` as Element;
  return ELEMENTS.has(element) ? element : null;
}

function actionName(action: DpsReportRecordedAction): string {
  return action.canonicalName || action.rawName;
}

function actionSkill(action: DpsReportRecordedAction, context: DpsReportProfessionReconstructionContext): Skill | null {
  const id = action.canonicalSkillId ?? action.rawSkillId;
  const name = actionName(action);
  return (
    context.catalog?.skills.find(
      (skill) =>
        (typeof skill.id === 'number' && Number(skill.id) === Number(id)) || normalized(skill.name) === normalized(name)
    ) || null
  );
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
    const attunement = String(actionSkill(action, context)?.attunement || '');
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
        lastAerialAgilityAt != null && action.start - lastAerialAgilityAt <= CHAIN_RESET_MS
          ? (aerialAgilityIndex + 1) % AERIAL_AGILITY_CHAIN.length
          : 0;
      lastAerialAgilityAt = action.start;
      normalizedAction = canonicalize(normalizedAction, AERIAL_AGILITY_CHAIN[aerialAgilityIndex]);
    } else {
      aerialAgilityIndex = -1;
      lastAerialAgilityAt = null;
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
  inference: 'elementalist-aura' | 'elementalist-blinding-flash'
): DpsReportRecordedAction {
  return {
    start: at,
    end: at,
    rawSkillId: identity.skillId,
    rawName: identity.name,
    status: 'instant',
    eventIndex,
    isSwap: false,
    metadataAccurate: false,
    inference,
    canonicalSkillId: identity.skillId,
    canonicalName: identity.name
  };
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

function recoverAuraActions(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[],
  nextEventIndex: () => number
): DpsReportRecordedAction[] {
  const primaryWeapon = normalized(context.professionConfig?.primaryWeapon);
  const secondaryWeapon = normalized(context.professionConfig?.secondaryWeapon);
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
    }

    for (const at of activationTimes(states, true)) {
      if (!inSelectedPhase(context, at)) continue;
      const explained = actions.some((action) => {
        if (Math.abs(action.start - at) > AURA_WINDOW_MS) return false;
        if (config.swapElement && swappedElement(action) === config.swapElement) return true;
        return sources.has(actionName(action));
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
  if (normalized(context.professionConfig?.primaryWeapon) !== 'scepter') return [];
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
  for (const at of candidates) {
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

  const recoveredAuras = recoverAuraActions(context, normalizedActions, nextEventIndex);
  const recoveredBlindingFlash = recoverBlindingFlashActions(context, normalizedActions, nextEventIndex);
  return [...normalizedActions, ...recoveredAuras, ...recoveredBlindingFlash].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
}
