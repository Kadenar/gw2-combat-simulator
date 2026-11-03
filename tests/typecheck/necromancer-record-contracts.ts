/** Keep Necromancer flip expiries and canonical mutable stats tied to their owned fields. */
import type { Gw2MutableStats } from '#gw2/platform/attributes/stats.js';
import type { SkillFlipCommands, SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import type { NecromancerCanonicalBuild } from '#gw2/professions/necromancer/types.js';

type Assert<T extends true> = T;
type Attributes = Gw2MutableStats;

export type NecromancerRecordAssertions = [
  Assert<string extends keyof Attributes ? false : true>,
  Assert<NecromancerCanonicalBuild['assumptions']['alacrity'] extends boolean | undefined ? true : false>
];

declare const attributes: Attributes;
declare const flips: SkillFlipWindows;
declare const commands: SkillFlipCommands;
// @ts-expect-error Attribute copies reject misspelled conversion fields.
attributes.conditonDamage;
// @ts-expect-error Flip availability requires a complete window with identity and readiness.
flips['exit'] = { expiresAt: 10 };

// @ts-expect-error Mechanics read windows but must request changes through shared commands.
commands.flips['exit'] = flips['exit'];
