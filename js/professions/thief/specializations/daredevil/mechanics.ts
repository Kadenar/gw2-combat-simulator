import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import type { SkillId } from "../../../../platform/engine/types.js";
import type { ThiefDodge } from "../../types.js";

interface DaredevilDodgeEffectBase {
  sourceId: SkillId;
  stacks?: number;
  duration?: number;
}

export type DaredevilDodgeEffect = Readonly<
  | (DaredevilDodgeEffectBase & {
      type: "strike";
      coefficient: number;
      hits: number;
    })
  | (DaredevilDodgeEffectBase & {
      type: "condition";
      condition: string;
    })
  | (DaredevilDodgeEffectBase & {
      type: "boon";
      boon: string;
    })
>;

export const DAREDEVIL_DODGE_EFFECTS: Readonly<
  Partial<Record<ThiefDodge, readonly DaredevilDodgeEffect[]>>
> = Object.freeze({
  "Bounding Dodger": Object.freeze([
    Object.freeze({
      type: "strike",
      sourceId: TRAIT.BOUNDING_DODGER,
      coefficient: 1.33,
      hits: 1,
    }),
  ]),
  "Lotus Training": Object.freeze([
    Object.freeze({
      type: "condition",
      sourceId: TRAIT.LOTUS_TRAINING,
      condition: "Bleeding",
      stacks: 1,
      duration: 4,
    }),
    Object.freeze({
      type: "condition",
      sourceId: TRAIT.LOTUS_TRAINING,
      condition: "Torment",
      stacks: 1,
      duration: 4,
    }),
    Object.freeze({
      type: "condition",
      sourceId: TRAIT.LOTUS_TRAINING,
      condition: "Crippled",
      stacks: 1,
      duration: 2,
    }),
  ]),
  "Unhindered Combatant": Object.freeze([
    Object.freeze({
      type: "boon",
      sourceId: TRAIT.UNHINDERED_COMBATANT,
      boon: "Swiftness",
      stacks: 1,
      duration: 8,
    }),
  ]),
});
