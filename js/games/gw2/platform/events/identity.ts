/** The packet fields that decide identity and causal parentage, shared by events and condition drafts. */
export interface PacketIdentity {
  readonly type: string;
  readonly kind?: unknown;
  readonly eventOrder?: unknown;
  readonly causalOrder?: unknown;
  readonly parentEventOrder?: unknown;
  readonly activationId?: unknown;
  readonly actorType?: unknown;
  readonly skillId?: unknown;
  readonly sourceId?: unknown;
}
