/** The shared service is the only public packet/application/reporting capability. */
import type { AnnouncementEmission, PacketEmission, ProfileEmission } from '#gw2/platform/effects/emission.js';
import type { BoonEffect } from '#gw2/platform/effects/types.js';
import type { Gw2SigilProc } from '#gw2/platform/equipment/sigils/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';

declare const runtime: Gw2Runtime;
declare const packet: PacketEmission;
declare const profile: ProfileEmission;
declare const announcement: AnnouncementEmission;
declare function retain(event: SimulationEvent): void;
declare function retainAll(events: readonly SimulationEvent[]): void;
const receipt = runtime.effects.emit({ ...packet, receipt: true });
const receipts = runtime.effects.emit({ ...profile, receipt: true });
runtime.effects.emit(announcement);
// Receipts are opt-in: only requested receipts can be retained, so ordinary emissions skip detaching a copy.
retain(receipt);
retainAll(receipts);
retain(runtime.effects.emit({ ...announcement, receipt: true }));
// @ts-expect-error Packet emissions without a requested receipt return nothing to retain.
retain(runtime.effects.emit(packet));
// @ts-expect-error Profile emissions without a requested receipt return no receipt collection.
retainAll(runtime.effects.emit(profile));
// @ts-expect-error Announcements without a requested receipt return nothing to retain.
retain(runtime.effects.emit(announcement));
// @ts-expect-error Emission receipts cannot rewrite queued time.
receipt.at = 3;
// @ts-expect-error Profile receipt collections are immutable.
receipts.push(receipt);
// @ts-expect-error Raw emission no longer exists.
runtime.emit(packet.event);
// @ts-expect-error Derived packets use explicit service delivery.
runtime.emitDerived(receipt, packet.event);
// @ts-expect-error Procedural effects use the same service.
runtime.emitProcedural(packet.event);
// @ts-expect-error Direct condition application is an internal engine capability.
runtime.applyCondition(packet.event);
// @ts-expect-error Reporting uses announcements on the shared service.
runtime.recordProc('trait', 'Fixture', 0);

// Boon payload identity is required and cannot use a display label or generic buff kind.
declare function retainBoon(effect: BoonEffect): void;
retainBoon({ type: 'boon', boon: 'might', name: 'Opening reward', duration: 5 });
// @ts-expect-error Display names are not boon IDs.
retainBoon({ type: 'boon', boon: 'Might', duration: 5 });
// @ts-expect-error A kind cannot replace the required boon ID.
retainBoon({ type: 'boon', kind: 'might', duration: 5 });

// Static sigil tables cannot defer missing or invalid boon identity until a combat proc fires.
declare function retainSigil(proc: Gw2SigilProc): void;
retainSigil({ trigger: 'crit', cooldown: 1, effect: 'boon', boon: 'might' });
// @ts-expect-error Boon procs require their boon ID in the declaration.
retainSigil({ trigger: 'crit', cooldown: 1, effect: 'boon' });
// @ts-expect-error Sigils use canonical IDs, not displayed boon names.
retainSigil({ trigger: 'crit', cooldown: 1, effect: 'boon', boon: 'Might' });
