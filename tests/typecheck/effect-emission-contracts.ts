/** The shared service is the only public packet/application/reporting capability. */
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type {
  PacketEmission,
  ProfileEmission,
  AnnouncementEmission
} from '#gw2/platform/simulation/effect-emission.js';
declare const runtime: Gw2Runtime;
declare const packet: PacketEmission;
declare const profile: ProfileEmission;
declare const announcement: AnnouncementEmission;
const receipt = runtime.effects.emit(packet);
const receipts = runtime.effects.emit(profile);
runtime.effects.emit(announcement);
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
