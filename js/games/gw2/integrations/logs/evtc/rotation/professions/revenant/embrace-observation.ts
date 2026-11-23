/** Infer Embrace the Darkness empowerment from the Torment applied alongside each strike on the main target. */
import {
  expectedConditionDurationsMs,
  isOutgoingStrike,
  matchingConditionApplications,
  observationAttributeSets,
  primaryStrikeTarget
} from '#gw2/integrations/logs/evtc/rotation/professions/condition-proc-observation.js';
import type { ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';
import { CONDITION } from '#gw2/platform/constants.js';
import { conditionEffectTicks } from '#gw2/platform/effects/authoring.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';

const EMBRACE_HIT = 34331;
const SWAP_RAZE_HIT = 73077;
const TORMENT = 19426;
// Arc can timestamp a pulse and its applications a few milliseconds apart.
const PULSE_WINDOW_MS = 4;

function tormentTicks(skill: Skill | undefined, trigger?: string) {
  return (skill?.effects ?? []).flatMap((effect) =>
    effect.type === 'condition' &&
    effect.condition === CONDITION.TORMENT &&
    (trigger === undefined || (effect.metadata?.trigger ?? '') === trigger)
      ? conditionEffectTicks(effect)
      : []
  );
}

export function analyzeEmbraceObservation(
  log: ParsedEvtc,
  player: bigint,
  catalog: CanonicalCatalog,
  config: Gw2Config
) {
  const target = primaryStrikeTarget(log, player);
  const strikes = log.events.filter((e) => e.target === target && isOutgoingStrike(e, player));
  const pulses = strikes.filter((e) => e.skillId === EMBRACE_HIT).sort((a, b) => a.time - b.time);

  if (target == null || !pulses.length) return null;

  const embrace = catalog.skillsById.get(ID.EMBRACE_THE_DARKNESS);
  const normal = tormentTicks(embrace, '')[0];
  const empowered = tormentTicks(embrace, 'empowered-upkeep-pulse')[0];
  const counts = { normal: 0, empowered: 0, unknown: 0 };

  if (!normal || !empowered || normal.duration !== empowered.duration) return { ...counts, unknown: pulses.length };

  const durations = expectedConditionDurationsMs(
    normal.duration,
    CONDITION.TORMENT,
    config,
    observationAttributeSets(config, catalog, revenantProfession.attributeContributions)
  );
  const applications = matchingConditionApplications(log, player, target, TORMENT, durations);
  const packets = [...strikes, ...applications].sort((a, b) => a.time - b.time);
  const raze = catalog.skillsById.get(ID.ABYSSAL_RAZE);
  const base = tormentTicks(raze, '')[0];
  const bonus = tormentTicks(raze, 'crushing-abyss')[0];
  const razeStacks =
    base?.duration === normal.duration && bonus?.duration === normal.duration
      ? Array.from({ length: Number(raze?.maximumStacks) + 1 }, (_, i) => base.stacks + i * bonus.stacks)
      : [];

  let start = 0;
  for (const [index, pulse] of pulses.entries()) {
    // A stack within reach of two pulses cannot identify either pulse independently.
    if (
      (pulses[index - 1]?.time ?? -Infinity) >= pulse.time - 2 * PULSE_WINDOW_MS ||
      (pulses[index + 1]?.time ?? Infinity) <= pulse.time + 2 * PULSE_WINDOW_MS
    ) {
      counts.unknown++;
      continue;
    }

    while (packets[start] && packets[start]!.time < pulse.time - PULSE_WINDOW_MS) start++;
    let stacks = 0;
    let competingStacks: readonly number[] = [0];
    for (let i = start; i < packets.length && packets[i]!.time <= pulse.time + PULSE_WINDOW_MS; i++) {
      const packet = packets[i]!;

      if (packet === pulse) continue;

      if (packet.buff) {
        stacks++;
        continue;
      }

      // Raze applies a base stack plus a pair per Crushing Abyss stack. A swap Raze consumes the full pool.
      if (packet.skillId === ID.ABYSSAL_RAZE || packet.skillId === SWAP_RAZE_HIT) {
        if (competingStacks[0] !== 0) {
          competingStacks = [];
          break;
        }

        competingStacks = packet.skillId === SWAP_RAZE_HIT ? razeStacks.slice(-1) : razeStacks;
        continue;
      }

      const other = catalog.skillsById.get(packet.skillId);

      if (!other || tormentTicks(other).some((tick) => tick.duration === normal.duration)) {
        competingStacks = [];
        break;
      }
    }

    const canBeNormal = competingStacks.includes(stacks - normal.stacks);
    const canBeEmpowered = competingStacks.includes(stacks - empowered.stacks);

    if (canBeNormal === canBeEmpowered) counts.unknown++;
    else if (canBeEmpowered) counts.empowered++;
    else counts.normal++;
  }

  return counts;
}
