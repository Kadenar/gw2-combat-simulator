/**
 * Registry for resolver event handlers. Keeps event-type ownership explicit and
 * rejects duplicate registrations so shared GW2 handlers and profession handlers
 * cannot silently shadow each other, and verifies required types are present
 * before resolution dispatches events.
 */
export type EventHandler<TContext, TEvent extends { type: string }> = (context: TContext, event: TEvent) => unknown;

/** Explicit shared marker for observable events that require no resolver mutation. */
export const OBSERVABLE_EVENT_HANDLER: EventHandler<unknown, { type: string }> = () => undefined;

/**
 * Registry for resolver event handlers. It keeps event-type ownership explicit
 * and rejects duplicate registrations so common GW2 handlers and profession
 * handlers cannot silently shadow each other.
 */
export class HandlerRegistry<TContext = unknown, TEvent extends { type: string } = { type: string }> {
  readonly #handlers = new Map<string, EventHandler<TContext, TEvent>>();

  /**
   * Registers a handler for one event type.
   */
  register(type: string, handler: EventHandler<TContext, TEvent>): this {
    const eventType = String(type || '');
    if (!eventType || typeof handler !== 'function') {
      throw new TypeError('Event handler registration requires a type and function.');
    }

    if (this.#handlers.has(eventType)) {
      throw new Error(`Duplicate event handler registration: ${eventType}`);
    }

    this.#handlers.set(eventType, handler);
    return this;
  }

  /**
   * Registers every entry in a plain object map.
   */
  registerAll(handlers: Readonly<Record<string, EventHandler<TContext, TEvent>>>): this {
    for (const [type, handler] of Object.entries(handlers || {})) {
      this.register(type, handler);
    }

    return this;
  }

  /**
   * Returns true when the event type already has a handler.
   */
  has(type: string): boolean {
    return this.#handlers.has(type);
  }

  /**
   * Verifies that every listed type is registered before resolution begins.
   */
  require(types: Iterable<string>): this {
    for (const type of types || []) {
      if (!this.has(type)) {
        throw new Error(`Missing required event handler: ${type}`);
      }
    }

    return this;
  }

  /**
   * Dispatches one event to its registered handler.
   */
  dispatch(event: TEvent, context: TContext): unknown {
    const handler = this.#handlers.get(event.type);
    if (!handler) {
      throw new Error(`No event handler registered for required type: ${event.type}`);
    }

    return handler(context, event);
  }
}
