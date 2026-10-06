/** The shared service is the only public packet/application/reporting capability. */
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { PacketEmission, ProfileEmission, AnnouncementEmission } from '#gw2/platform/effects/emission.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
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
