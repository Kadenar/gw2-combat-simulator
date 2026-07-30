export type EventHandler<
  TContext,
  TEvent extends { type: string },
> = (context: TContext, event: TEvent) => unknown;

interface HandlerRegistration<
  TContext,
  TEvent extends { type: string },
> {
  readonly handler: EventHandler<TContext, TEvent>;
  readonly required: boolean;
}

interface HandlerRegistrationOptions {
  readonly required?: boolean;
}

/**
 * Registry for resolver event handlers. It keeps event-type ownership explicit
 * and rejects duplicate registrations so common GW2 handlers and profession
 * handlers cannot silently shadow each other.
 *
 * @template TContext
 * @template {{type: string}} TEvent
 */
export class HandlerRegistry<
  TContext = unknown,
  TEvent extends { type: string } = { type: string },
> {
  readonly #handlers = new Map<
    string,
    HandlerRegistration<TContext, TEvent>
  >();

  /**
   * Registers a handler for one event type.
   *
   * @param {string} type
   * @param {EventHandler<TContext, TEvent>} handler
   * @param {{required?: boolean}} [options]
   */
  register(
    type: string,
    handler: EventHandler<TContext, TEvent>,
    { required = false }: HandlerRegistrationOptions = {},
  ): this {
    const eventType = String(type || "");
    if (!eventType || typeof handler !== "function") {
      throw new TypeError(
        "Event handler registration requires a type and function.",
      );
    }
    if (this.#handlers.has(eventType)) {
      throw new Error(`Duplicate event handler registration: ${eventType}`);
    }
    this.#handlers.set(eventType, { handler, required: Boolean(required) });
    return this;
  }

  /**
   * Registers every entry in a plain object map.
   *
   * @param {Readonly<Record<string, EventHandler<TContext, TEvent>>>} handlers
   * @param {{required?: boolean}} [options]
   */
  registerAll(
    handlers: Readonly<Record<string, EventHandler<TContext, TEvent>>>,
    options: HandlerRegistrationOptions = {},
  ): this {
    for (const [type, handler] of Object.entries(handlers || {})) {
      this.register(type, handler, options);
    }
    return this;
  }

  /**
   * Returns true when the event type already has a handler.
   *
   * @param {string} type
   */
  has(type: string): boolean {
    return this.#handlers.has(type);
  }

  /**
   * Verifies that every listed type is registered before resolution begins.
   *
   * @param {Iterable<string>} types
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
   *
   * @param {TEvent} event
   * @param {TContext} context
   */
  dispatch(event: TEvent, context: TContext): unknown {
    const registration = this.#handlers.get(event.type);
    if (!registration) {
      throw new Error(
        `No event handler registered for required type: ${event.type}`,
      );
    }
    return registration.handler(context, event);
  }

  /**
   * Returns the registered handler map as `[type, handler]` tuples.
   *
   * @returns {[string, EventHandler<TContext, TEvent>][]}
   */
  entries(): Array<[string, EventHandler<TContext, TEvent>]> {
    return [...this.#handlers.entries()].map(([type, registration]) => [
      type,
      registration.handler,
    ]);
  }
}

/**
 * Convenience constructor for object-literal handler maps.
 *
 * @template TContext
 * @template {{type: string}} TEvent
 * @param {Readonly<Record<string, EventHandler<TContext, TEvent>>>} [entries]
 */
export function createHandlerRegistry<
  TContext,
  TEvent extends { type: string },
>(
  entries: Readonly<Record<string, EventHandler<TContext, TEvent>>> = {},
): HandlerRegistry<TContext, TEvent> {
  const registry = new HandlerRegistry<TContext, TEvent>();
  return registry.registerAll(entries);
}
