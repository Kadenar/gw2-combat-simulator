import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type {
  MesmerClone,
  MesmerCloneAttack,
  MesmerResourceGain
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerAmbushAttack } from '#gw2/professions/mesmer/types.js';
/** Cloak listeners retain their order after the cloak packet and before any clone ambush. */
export const mirageCloakGranted = defineTriggerPoint<{
  readonly at: number;
  readonly source: string;
  readonly duration: number;
  readonly delivery: EffectDelivery;
}>('mesmer.mirage-cloak-granted', [TRAIT.RENEWING_OASIS, TRAIT.DUNE_CLOAK, TRAIT.INFINITE_HORIZON]);
/** The accepted ambush retains its cast weapon and consumes primed trait state before its window closes. */
export const mirageAmbushAccepted = defineTriggerPoint<{
  readonly ambush: MesmerAmbushAttack;
  readonly impactAt: number;
  readonly delivery: EffectDelivery;
}>('mesmer.mirage-ambush-accepted', [TRAIT.RIDDLE_OF_SAND, TRAIT.MIRAGE_MANTLE]);
/** The listener admits clone execution once, before mechanic-owned packets are materialized. */
export const mirageCloneAmbushRequested = defineTriggerPoint<{
  readonly at: number;
  readonly weapon: string;
  readonly delivery: EffectDelivery;
  readonly clones: readonly MesmerClone[];
  readonly ambushAttacks: Readonly<Record<string, MesmerAmbushAttack>>;
  readonly cloneAttacks: Readonly<Record<string, MesmerCloneAttack>>;
}>('mesmer.mirage-clone-ambush-requested', [TRAIT.INFINITE_HORIZON]);
/** Committed gains retain their source identity and captured clone list. */
export const mirageResourcesGained = defineTriggerPoint<{
  readonly gain: MesmerResourceGain;
}>('mesmer.mirage-resources-gained', [TRAIT.INFINITE_HORIZON]);
/** Initialization establishes readiness even when the trait is absent. */
export const mirageInitialized = defineTriggerPoint<Record<string, never>>('mesmer.mirage-initialized', [
  TRAIT.RIDDLE_OF_SAND
]);
/** Deception rewards observe the committed cast and captured resource and weapon facts. */
export const mirageCastCommitted = defineTriggerPoint<{
  readonly cast: RuntimeCast<MesmerSkill>;
  readonly at: number;
  readonly currentResource: number;
  readonly weapon: string;
}>('mesmer.mirage-cast-committed', [TRAIT.SELF_DECEPTION]);
