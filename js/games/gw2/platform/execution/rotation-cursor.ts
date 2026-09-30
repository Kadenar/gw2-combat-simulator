import { canonicalTime } from '#kernel/core/clock.js';
import type { CastCommand, RotationCommand } from '#gw2/platform/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Owns authored progression and lanes only; combat outcomes never live in a predicted cursor state. */
export class RotationCursor {
  index = 0;
  private previousCastStart = 0;
  private hasPreviousCast = false;
  private serialReadyAt = 0;
  private instantReadyAt = 0;
  private independentReadyAt = 0;
  private blockingEnd = 0;
  private reservedEnd = 0;
  private waitUntil = 0;
  private requestedAt: number | null = null;
  selfStunUntil = 0;

  constructor(readonly commands: readonly RotationCommand[]) {}

  /** Copy all lane reservations and the current request together with authored commands. */
  snapshot() {
    return {
      commands: [...this.commands],
      index: this.index,
      previousCastStart: this.previousCastStart,
      hasPreviousCast: this.hasPreviousCast,
      serialReadyAt: this.serialReadyAt,
      instantReadyAt: this.instantReadyAt,
      independentReadyAt: this.independentReadyAt,
      blockingEnd: this.blockingEnd,
      reservedEnd: this.reservedEnd,
      waitUntil: this.waitUntil,
      requestedAt: this.requestedAt,
      selfStunUntil: this.selfStunUntil
    };
  }

  restore(saved: ReturnType<RotationCursor['snapshot']>): void {
    Object.assign(this, saved);
  }

  /** Read a choice without reserving it; enumeration must not copy the growing authored rotation. */
  requestFor(command: RotationCommand, now: number, skill?: Skill): number {
    return now < this.waitUntil ? this.waitUntil : this.requestTime(command, now, skill);
  }

  concurrentOffsetAt(now: number): number {
    return Math.max(0, (now - this.previousCastStart) * 1000);
  }

  get command(): RotationCommand | undefined {
    return this.commands[this.index];
  }

  /** Lane completion remains a wake after the final command; recurring combat work cannot extend it. */
  endTime(): number {
    return Math.max(this.serialReadyAt, this.reservedEnd, this.waitUntil);
  }

  /** Compute an authored request once, then let actual readiness delay it without backdating an overlap. */
  requestAt(now: number, skill?: Skill): number {
    if (now < this.waitUntil) return this.waitUntil;
    if (this.requestedAt != null) return Math.max(now, this.requestedAt, this.waitUntil);
    this.requestedAt = this.requestTime(this.command, now, skill);
    return this.requestedAt;
  }

  private requestTime(command: RotationCommand | undefined, now: number, skill?: Skill): number {
    let at = Math.max(now, this.waitUntil);
    if (command?.type === 'cast' && skill) {
      const independent = skill.independentCast === true;
      const instant = Number(skill.castTimeMs) === 0;
      if (command.concurrentOffsetMs != null) {
        at = this.previousCastStart + command.concurrentOffsetMs / 1000;
        if (instant || independent) at = Math.max(at, now);
      } else if (independent) {
        if (!skill.independentCastCanOverlap) at = Math.max(at, this.independentReadyAt);
      } else if (instant) at = Math.max(at, this.instantReadyAt);
      else at = Math.max(at, this.serialReadyAt, this.blockingEnd, skill.stunbreak ? 0 : this.selfStunUntil);
      if (independent && !skill.independentCastCanOverlap) at = Math.max(at, this.independentReadyAt);
    } else if (command?.type === 'combat-start' && command.concurrentOffsetMs != null && this.hasPreviousCast) {
      at = Math.max(at, this.previousCastStart + command.concurrentOffsetMs / 1000);
    } else at = Math.max(at, this.endTime());
    return canonicalTime(at);
  }

  /** Accepted independent casts occupy only their own lane; authored waits still join every outstanding cast. */
  acceptCast(skill: Skill, command: CastCommand, start: number, effectiveEnd: number, laneEnd: number): void {
    this.reservedEnd = Math.max(this.reservedEnd, laneEnd);
    if (skill.independentCast) {
      if (!skill.independentCastCanOverlap) this.independentReadyAt = Math.max(this.independentReadyAt, laneEnd);
    } else {
      this.previousCastStart = start;
      this.hasPreviousCast = true;
      this.instantReadyAt = Math.max(this.instantReadyAt, effectiveEnd);
      this.blockingEnd = Math.max(this.blockingEnd, laneEnd);
      if (command.concurrentOffsetMs == null) this.serialReadyAt = laneEnd;
      if (skill.stunbreak) this.selfStunUntil = start;
    }

    this.consume();
  }

  acceptWait(end: number): void {
    this.waitUntil = end;
    this.serialReadyAt = end;
    this.consume();
  }

  consume(): void {
    this.index++;
    this.requestedAt = null;
  }
}
