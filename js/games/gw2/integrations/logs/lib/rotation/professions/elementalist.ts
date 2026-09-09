import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS as ID
} from '#gw2/professions/elementalist/data/ids.js';

import { normalizedName as normalized, recordedActionSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';

import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

type Element = keyof typeof ELEMENTALIST_ATTUNEMENT_SKILL_IDS;

interface ElementalistSkillIdentity {
  readonly name: string;
  readonly skillId: number;
}

const ELEMENTS = new Set<Element>(['Fire', 'Water', 'Air', 'Earth']);
const ATTUNEMENT_SUFFIX_SKILLS = new Set(['Glyph of Elemental Power', 'Primordial Stance', 'Deploy Jade Sphere']);
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

function elementName(value: unknown): Element | null {
  const name = String(value || '').trim();
  const element = `${name.slice(0, 1).toUpperCase()}${name.slice(1).toLowerCase()}` as Element;
  return ELEMENTS.has(element) ? element : null;
}

function namedSkill(context: LogActionNormalizationContext, name: string): ElementalistSkillIdentity | null {
  const skill = context.catalog?.skills.find((candidate) => normalized(candidate.name) === normalized(name));
  return skill && typeof skill.id === 'number' ? { name: skill.name, skillId: Number(skill.id) } : null;
}

function canonicalize(action: RecordedLogAction, identity: ElementalistSkillIdentity): RecordedLogAction {
  return {
    ...action,
    canonicalSkillId: identity.skillId,
    canonicalName: identity.name
  };
}

function swappedElement(action: RecordedLogAction): Element | null {
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

function configuredStartingElement(context: LogActionNormalizationContext): Element {
  return elementName(context.professionConfig?.startAttunement) || 'Fire';
}

function inferStartingElement(context: LogActionNormalizationContext, actions: readonly RecordedLogAction[]): Element {
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

function normalizeRecordedActions(context: LogActionNormalizationContext): RecordedLogAction[] {
  const sorted = [...context.recordedActions].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
  const result: RecordedLogAction[] = [];
  let currentElement = inferStartingElement(context, sorted);
  let aerialAgilityIndex = -1;
  let lastAerialAgilityAt: number | null = null;

  for (const action of sorted) {
    let normalizedAction = action;

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

/** Maps represented Elementalist attunement and chain variants without adding inputs. */
export function reconstructElementalistDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  return normalizeRecordedActions(context);
}
