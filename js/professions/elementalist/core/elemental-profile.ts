import { ELEMENTALIST_SKILL_IDS as ID } from "../data/ids.js";
import type { SkillEffect } from "../../../platform/engine/types.js";

/**
 * Fire Elemental timings and packets measured from the supplied 2026-07-16
 * ArcDPS log. Runtime AI uses the action profiles; reference audits use the
 * compact schedule expanded below.
 */
export const FIRE_ELEMENTAL_EVTC_PROFILE = Object.freeze({
  lifetime: 120,
  rechargeAfterExpiry: 40,
  targetAcquisitionDelay: 0.16,
  postCommandRecovery: 0.56,
  subsequentCommandRecovery: 0.08,
  basePower: 1000,
  basePrecision: 1000,
  baseFerocity: 0,
  fireball: Object.freeze({
    skillId: ID.FIRE_ELEMENTAL_FIREBALL,
    baseDamage: 995,
    impact: 1.2,
    animationEnd: 2,
    recovery: 3.2,
  }),
  flameBurst: Object.freeze({
    skillId: ID.FIRE_ELEMENTAL_FLAME_BURST,
    baseDamage: 1460,
    impact: 2.52,
    animationEnd: 3.68,
    recovery: 4.64,
    cooldown: 15,
    burningStacks: 1,
    burningDuration: 3,
    mightStacks: 3,
    mightDuration: 10,
  }),
  flameBarrage: Object.freeze({
    skillId: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND,
    projectileBaseDamage: 400,
    explosionBaseDamage: 4800,
    projectileImpacts: Object.freeze([1.12, 1.32, 1.52]),
    explosionImpact: 1.52,
    animationEnd: 3.04,
    cooldown: 15,
    burningStacks: 1,
    burningDuration: 3,
  }),
});

const REFERENCE_PACKET_PROFILES = Object.freeze({
  fireball: Object.freeze({ baseDamage: 995, burning: false, might: false }),
  flameBurst: Object.freeze({ baseDamage: 1460, burning: true, might: true }),
  barrageProjectile: Object.freeze({
    baseDamage: 400,
    burning: true,
    might: false,
  }),
  barrageExplosion: Object.freeze({
    baseDamage: 4800,
    burning: false,
    might: false,
  }),
});

type ReferencePacketKind = keyof typeof REFERENCE_PACKET_PROFILES;
type ReferencePacket = readonly [atMs: number, kind: ReferencePacketKind];

const REFERENCE_PACKET_SCHEDULE: readonly ReferencePacket[] = Object.freeze([
  [1280, "barrageProjectile"],
  [1480, "barrageProjectile"],
  [1680, "barrageProjectile"],
  [1960, "barrageExplosion"],
  [6130, "flameBurst"],
  [13520, "barrageProjectile"],
  [13720, "barrageProjectile"],
  [13920, "barrageProjectile"],
  [14120, "barrageExplosion"],
  [16800, "fireball"],
  [20200, "fireball"],
  [23920, "fireball"],
  [26000, "barrageProjectile"],
  [26200, "barrageProjectile"],
  [26400, "barrageProjectile"],
  [26600, "barrageExplosion"],
  [30720, "flameBurst"],
  [33880, "fireball"],
  [37280, "fireball"],
  [38480, "barrageProjectile"],
  [38680, "barrageProjectile"],
  [38880, "barrageProjectile"],
  [39080, "barrageExplosion"],
  [41760, "fireball"],
  [45400, "fireball"],
  [48760, "fireball"],
  [50960, "barrageProjectile"],
  [51160, "barrageProjectile"],
  [51360, "barrageProjectile"],
  [51560, "barrageExplosion"],
  [54240, "fireball"],
  [57560, "fireball"],
  [60360, "fireball"],
  [63440, "barrageProjectile"],
  [63640, "barrageProjectile"],
  [63840, "barrageProjectile"],
  [64040, "barrageExplosion"],
  [68200, "flameBurst"],
  [71800, "fireball"],
  [74560, "fireball"],
  [75920, "barrageProjectile"],
  [76120, "barrageProjectile"],
  [76320, "barrageProjectile"],
  [76520, "barrageExplosion"],
  [79160, "fireball"],
  [82320, "fireball"],
  [86960, "flameBurst"],
  [88400, "barrageProjectile"],
  [88600, "barrageProjectile"],
  [88800, "barrageProjectile"],
  [89000, "barrageExplosion"],
  [91680, "fireball"],
  [95120, "fireball"],
  [98680, "fireball"],
  [100880, "barrageProjectile"],
  [101080, "barrageProjectile"],
  [101280, "barrageProjectile"],
  [101480, "barrageExplosion"],
  [104160, "fireball"],
  [106960, "fireball"],
  [111840, "flameBurst"],
  [113360, "barrageProjectile"],
  [113560, "barrageProjectile"],
  [113760, "barrageProjectile"],
  [113960, "barrageExplosion"],
  [116680, "fireball"],
  [119680, "fireball"],
]);

function referenceEffects([
  atMs,
  kind,
]: ReferencePacket): readonly SkillEffect[] {
  const profile = REFERENCE_PACKET_PROFILES[kind];
  return [
    {
      type: "strike",
      ticks: [
        {
          atMs,
          coefficient: 0,
          metadata: {
            flatStrikeBase: profile.baseDamage,
            flatStrikePowerCoeff: 0,
          },
        },
      ],
      timingAnchor: "castStart",
      timingScale: "fixed",
    },
    ...(profile.burning
      ? [
          {
            type: "condition" as const,
            ticks: [
              {
                atMs,
                condition: "Burning",
                stacks: 1,
                duration: 3,
              },
            ],
            timingAnchor: "castStart" as const,
            timingScale: "fixed" as const,
            metadata: {},
          },
        ]
      : []),
    ...(profile.might
      ? [
          {
            type: "boon" as const,
            boon: "Might",
            stacks: 3,
            duration: 10,
            durationScale: "boon" as const,
            atMs,
            timingAnchor: "castStart" as const,
            timingScale: "fixed" as const,
            metadata: {},
          },
        ]
      : []),
  ];
}

export const FIRE_ELEMENTAL_REFERENCE_EFFECTS: readonly SkillEffect[] =
  Object.freeze(REFERENCE_PACKET_SCHEDULE.flatMap(referenceEffects));
