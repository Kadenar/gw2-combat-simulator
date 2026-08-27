import type {
  PaletteSkillAvailability,
  ProfessionResourceView,
  ProfessionUiContract,
  RotationStateSnapshotItem,
  SchedulerRecord,
  SimulationEvent,
  Skill
} from '../../../../platform/engine/types.js';
import { ELEMENTALIST_JADE_SPHERE_SKILL_IDS } from '../../data/ids.js';
import { CATALYST_MAXIMUM_ENERGY, type CatalystState } from './state.js';

const CATALYST_SPHERE_COST = 10;
const CATALYST_SPHERE_SKILL_IDS = Object.freeze(Object.values(ELEMENTALIST_JADE_SPHERE_SKILL_IDS));

function uiState(context: SchedulerRecord): Partial<CatalystState> {
  return (context.professionState as Partial<CatalystState> | undefined) || {};
}

function catalystPaletteAvailability(context: SchedulerRecord, skill: Skill): PaletteSkillAvailability {
  if (skill.skillFamily !== 'Jade Sphere') {
    return { available: true, message: '' };
  }

  const state = uiState(context);
  const build = context.build as SchedulerRecord | undefined;
  const primaryAttunement = String(
    (context.professionState as SchedulerRecord | undefined)?.primaryAttunement || build?.startAttunement || 'Fire'
  );

  if (skill.attunement !== primaryAttunement) {
    return { available: false, message: `Requires ${String(skill.attunement)} attunement.` };
  }

  const energy = Number(state.energy ?? build?.initialCatalystEnergy ?? CATALYST_MAXIMUM_ENERGY);
  const available = energy >= CATALYST_SPHERE_COST;
  return {
    available,
    message: available ? '' : `Requires ${CATALYST_SPHERE_COST} Energy; currently ${energy}`
  };
}

function empoweringAurasAt(context: SchedulerRecord, at: number): { stacks: number; remaining: number } | null {
  let expiries: number[] = [];
  const events = (context.result as { events?: readonly SimulationEvent[] } | undefined)?.events || [];
  for (const event of events) {
    const applicationAt = Number(event.at || 0);

    if (applicationAt > at) break;

    if (event.type !== 'buff' || event.kind !== 'empowering auras') continue;
    expiries = expiries.filter((expiry) => expiry > applicationAt);
    const expiresAt = applicationAt + Number(event.duration || 0);
    // Empowering Auras refreshes every active stack whenever another aura is
    // gained, then adds one stack up to five; replay that refresh contract.
    expiries = expiries.map(() => expiresAt);
    for (let stack = 0; stack < Math.max(1, Number(event.stacks || 1)) && expiries.length < 5; stack += 1) {
      if (expiresAt > applicationAt) expiries.push(expiresAt);
    }
  }

  expiries = expiries.filter((expiry) => expiry > at);
  return expiries.length ? { stacks: expiries.length, remaining: Math.min(...expiries) - at } : null;
}

/** Shows timed Catalyst combat state that changes decisions at the inspected rotation point. */
function catalystStateSnapshot(context: SchedulerRecord): RotationStateSnapshotItem[] {
  const state = uiState(context);
  const at = Math.max(0, Number(context.atSeconds || 0));
  const items: RotationStateSnapshotItem[] = [];
  const empowerment = (state.elementalEmpowermentExpiries || []).filter((expiry) => Number(expiry) > at).length;

  if (empowerment > 0) {
    items.push({
      id: 'catalyst-elemental-empowerment',
      label: 'Elemental Empowerment',
      value: `${Math.min(10, empowerment)}/10`,
      title: 'Active Elemental Empowerment stacks'
    });
  }

  const empoweringAuras = empoweringAurasAt(context, at);

  if (empoweringAuras) {
    items.push({
      id: 'catalyst-empowering-auras',
      label: 'Empowering Auras',
      value: `${empoweringAuras.stacks}/5 · ${empoweringAuras.remaining.toFixed(1)}s`,
      title: 'Active Empowering Auras stacks and refreshed duration remaining'
    });
  }

  for (const element of ['Fire', 'Water', 'Air', 'Earth']) {
    const remaining = Number(state.sphereExpiry?.[element] || 0) - at;

    if (remaining <= 0) continue;
    items.push({
      id: `catalyst-${element.toLowerCase()}-sphere`,
      label: `${element} Sphere`,
      value: `${remaining.toFixed(1)}s`,
      title: `Time remaining for the active ${element} Jade Sphere`
    });
  }

  return items;
}

export const catalystUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  skillBarGroups: () => [
    {
      id: 'elementalist-catalyst-spheres',
      label: 'Jade Sphere',
      skillIds: CATALYST_SPHERE_SKILL_IDS,
      color: '#44ddaa',
      className: 'elementalist-catalyst-spheres',
      order: -10
    }
  ],
  paletteGroups: () => [
    {
      id: 'elementalist-catalyst-spheres',
      label: 'F5',
      skillIds: CATALYST_SPHERE_SKILL_IDS,
      color: '#44ddaa',
      className: 'compact-resource-palette elementalist-catalyst-spheres',
      resourceAnchor: true,
      order: -10
    }
  ],
  paletteSkillAvailability: catalystPaletteAvailability,
  rotationStateSnapshot: catalystStateSnapshot,
  resourceViews: (context: SchedulerRecord): ProfessionResourceView[] => {
    const state = uiState(context);
    const build = context.build as SchedulerRecord | undefined;
    return [
      {
        id: 'catalyst-energy',
        singular: 'energy',
        plural: 'energy',
        maximum: CATALYST_MAXIMUM_ENERGY,
        value: Number(state.energy ?? build?.initialCatalystEnergy ?? CATALYST_MAXIMUM_ENERGY),
        startMaximum: CATALYST_MAXIMUM_ENERGY,
        startValue: Number(build?.initialCatalystEnergy ?? CATALYST_MAXIMUM_ENERGY),
        canStart: true,
        buildKey: 'initialCatalystEnergy',
        step: 1,
        displayMode: 'bar',
        pipStyle: 'compact-profession-resource-catalyst-energy',
        shortLabel: 'Energy',
        statusLabel: 'Catalyst'
      }
    ];
  }
});
