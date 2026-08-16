import { findRotationSkill } from "../../catalog.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "../types.js";

const AUTOATTACK_CHAINS = Object.freeze([
  Object.freeze([
    Object.freeze({ name: "Dusk Strike", skillId: 29705 }),
    Object.freeze({ name: "Fading Twilight", skillId: 30799 }),
    Object.freeze({ name: "Chilling Scythe", skillId: 29867 }),
  ]),
  Object.freeze([
    Object.freeze({ name: "Dark Slash", skillId: 73012 }),
    Object.freeze({ name: "Deadly Slice", skillId: 73040 }),
    Object.freeze({ name: "Sinister Stab", skillId: 73047 }),
  ]),
]);

function resetsAutoattackChain(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction,
): boolean {
  const skill = findRotationSkill(
    action.rawSkillId,
    action.rawName,
    context.catalog,
    context.profile,
  );
  return (
    skill?.type === "Weapon" ||
    Number(skill?.castTimeMs || 0) > 0 ||
    Boolean(skill?.shroud) ||
    skill?.handlerId === "necromancer.shroud" ||
    action.rawName === "Swap Weapons"
  );
}

function isWeaponAutoattack(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction,
): boolean {
  const skill = findRotationSkill(
    action.rawSkillId,
    action.rawName,
    context.catalog,
    context.profile,
  );
  return String(skill?.slot || "").toLowerCase() === "weapon_1";
}

export function normalizeNecromancerAutoattackChains(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  // Arc can repeat a spear root ID for later chain steps and can report a
  // canceled greatsword child after the chain reset. Keep rawSkillId intact,
  // but choose the executable action from the reconstructed chain state.
  const positions = new Map<
    number,
    { readonly chainIndex: number; readonly actionIndex: number }
  >();
  AUTOATTACK_CHAINS.forEach((chain, chainIndex) => {
    chain.forEach((identity, actionIndex) => {
      positions.set(identity.skillId, { chainIndex, actionIndex });
    });
  });

  let activeChainIndex: number | null = null;
  let expectedActionIndex = 0;
  return [...actions]
    .sort(
      (left, right) =>
        left.start - right.start || left.eventIndex - right.eventIndex,
    )
    .flatMap((action) => {
      const position = positions.get(action.rawSkillId);
      if (
        action.status === "interrupted" &&
        (position != null || isWeaponAutoattack(context, action))
      ) {
        // Arc records canceled auto packets as casts even though no strike
        // completed. Replaying them reserves time and advances the simulator
        // away from the rotation that actually executed.
        activeChainIndex = null;
        expectedActionIndex = 0;
        return [];
      }
      if (!position) {
        if (resetsAutoattackChain(context, action)) {
          activeChainIndex = null;
          expectedActionIndex = 0;
        }
        return [action];
      }

      const actionIndex =
        activeChainIndex === position.chainIndex ? expectedActionIndex : 0;
      const chain = AUTOATTACK_CHAINS[position.chainIndex];
      const identity = chain[actionIndex];
      const normalized = {
        ...action,
        canonicalSkillId: identity.skillId,
        canonicalName: identity.name,
      };
      if (action.status === "completed" && actionIndex < chain.length - 1) {
        activeChainIndex = position.chainIndex;
        expectedActionIndex = actionIndex + 1;
      } else {
        activeChainIndex = null;
        expectedActionIndex = 0;
      }
      return [normalized];
    });
}
