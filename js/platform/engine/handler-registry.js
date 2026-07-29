/**
 * Registry for resolver event handlers. It keeps event-type ownership explicit
 * and rejects duplicate registrations so common GW2 handlers and profession
 * handlers cannot silently shadow each other.
 */
export class HandlerRegistry {
  #handlers = new Map();

  /**
   * Registers a handler for one event type.
   */
  register(type, handler, { required = false } = {}) {
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
   */
  registerAll(handlers, options = {}) {
    for (const [type, handler] of Object.entries(handlers || {})) {
      this.register(type, handler, options);
    }
    return this;
  }

  /**
   * Returns true when the event type already has a handler.
   */
  has(type) {
    return this.#handlers.has(type);
  }

  /**
   * Verifies that every listed type is registered before resolution begins.
   */
  require(types) {
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
  dispatch(event, context) {
    const registration = this.#handlers.get(event?.type);
    if (!registration) {
      throw new Error(
        `No event handler registered for required type: ${event?.type}`,
      );
    }
    return registration.handler(context, event);
  }

  /**
   * Returns the registered handler map as `[type, handler]` tuples.
   */
  entries() {
    return [...this.#handlers.entries()].map(([type, registration]) => [
      type,
      registration.handler,
    ]);
  }
}

/**
 * Convenience constructor for object-literal handler maps.
 */
export function createHandlerRegistry(entries = {}) {
  return new HandlerRegistry().registerAll(entries);
}
