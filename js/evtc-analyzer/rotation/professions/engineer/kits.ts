import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from "../../../types.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "../types.js";
import {
  canonicalAction,
  type EngineerActionIdentity,
  normalized,
  selectedSkill,
  skillForAction,
} from "./shared.js";

const DETONATE = Object.freeze({ name: "Detonate", skillId: 6162 });
const MINE_DAMAGE_SIGNAL = 6161;
const SWAP_GROUP_WINDOW_MS = 250;
const KIT_WEAPON_SET = 2;

export const PRECOMBAT_BOMBS: readonly EngineerActionIdentity[] = Object.freeze(
  [
    Object.freeze({ name: "Big Ol' Bomb", skillId: 5813 }),
    Object.freeze({ name: "Magnetic Bomb", skillId: 76530 }),
    Object.freeze({ name: "Fire Bomb", skillId: 5823 }),
    Object.freeze({ name: "Galvanic Bomb", skillId: 5822 }),
  ],
);

export function kitIdentity(
  context: EvtcProfessionReconstructionContext,
  kit: string,
  stow: boolean,
): EngineerActionIdentity | null {
  const skill = context.catalog?.skills.find((candidate) =>
    stow
      ? normalized(candidate.kit) === normalized(kit) &&
        candidate.handlerId === "engineer.kit-stow"
      : normalized(candidate.kitName) === normalized(kit) &&
        candidate.handlerId === "engineer.kit-equip",
  );
  return skill && typeof skill.id === "number"
    ? { name: skill.name, skillId: Number(skill.id) }
    : null;
}

export function inferDetonateActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  if (
    context.selectedSkillNames?.length &&
    !selectedSkill(context, "Throw Mine")
  ) {
    return [];
  }
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== MINE_DAMAGE_SIGNAL ||
      event.buff !== 0 ||
      event.activation !== EVTC_ACTIVATION.NONE ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE ||
      event.value <= 0
    ) {
      return [];
    }
    return [canonicalAction(eventIndex, event.time, DETONATE, event.skillId)];
  });
}

export function openingDamageSkillNames(
  context: EvtcProfessionReconstructionContext,
  windowMs = 1200,
): ReadonlySet<string> {
  const combatStart = context.log.events.find(
    (event) =>
      event.source === context.playerAddress &&
      event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT,
  )?.time;
  if (combatStart == null) return new Set();
  const names = new Map(
    context.log.skills.map((skill) => [skill.id, skill.name.trim()]),
  );
  return new Set(
    context.log.events
      .filter(
        (event) =>
          event.source === context.playerAddress &&
          event.buff === 0 &&
          event.activation === EVTC_ACTIVATION.NONE &&
          event.stateChange === EVTC_STATE_CHANGE.NONE &&
          event.value > 0 &&
          event.time >= combatStart &&
          event.time <= combatStart + windowMs,
      )
      .map((event) => names.get(event.skillId) || ""),
  );
}

export function normalizeKitTransitions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const sorted = [...actions].sort(
    (left, right) =>
      left.start - right.start || left.eventIndex - right.eventIndex,
  );
  const result: EvtcRecordedRotationAction[] = [];
  let activeKit: string | null = null;

  for (let index = 0; index < sorted.length; index += 1) {
    const action = sorted[index];
    if (action.rawName !== "Swap Weapons") {
      result.push(action);
      continue;
    }

    const swaps = [action];
    while (
      sorted[index + 1]?.rawName === "Swap Weapons" &&
      sorted[index + 1].start - action.start <= SWAP_GROUP_WINDOW_MS
    ) {
      swaps.push(sorted[index + 1]);
      index += 1;
    }
    const entersKit = swaps.some(
      (swap) => Number(swap.weaponSet) === KIT_WEAPON_SET,
    );
    const nextSwap = sorted
      .slice(index + 1)
      .find((candidate) => candidate.rawName === "Swap Weapons");
    const nextKitAction = sorted
      .slice(index + 1)
      .filter(
        (candidate) => nextSwap == null || candidate.start < nextSwap.start,
      )
      .find((candidate) => Boolean(skillForAction(context, candidate)?.kit));
    const nextKit = nextKitAction
      ? String(skillForAction(context, nextKitAction)?.kit || "")
      : "";

    if (entersKit && nextKit) {
      const identity = kitIdentity(context, nextKit, false);
      if (identity) {
        result.push(
          canonicalAction(
            swaps.at(-1)!.eventIndex,
            swaps.at(-1)!.start,
            identity,
            0,
            "state-change",
          ),
        );
        activeKit = nextKit;
      }
      continue;
    }
    if (activeKit) {
      const identity = kitIdentity(context, activeKit, true);
      if (identity) {
        result.push(
          canonicalAction(
            swaps[0].eventIndex,
            swaps[0].start,
            identity,
            0,
            "state-change",
          ),
        );
      }
      activeKit = null;
    }
  }
  return result;
}
