export class HandlerRegistry {
  #handlers = new Map();

  register(type, handler, { required = false } = {}) {
    const eventType = String(type || "");
    if (!eventType || typeof handler !== "function") {
      throw new TypeError("Event handler registration requires a type and function.");
    }
    if (this.#handlers.has(eventType)) {
      throw new Error(`Duplicate event handler registration: ${eventType}`);
    }
    this.#handlers.set(eventType, { handler, required: Boolean(required) });
    return this;
  }

  registerAll(handlers, options = {}) {
    for (const [type, handler] of Object.entries(handlers || {})) {
      this.register(type, handler, options);
    }
    return this;
  }

  has(type) {
    return this.#handlers.has(type);
  }

  require(types) {
    for (const type of types || []) {
      if (!this.has(type)) {
        throw new Error(`Missing required event handler: ${type}`);
      }
    }
    return this;
  }

  dispatch(event, context) {
    const registration = this.#handlers.get(event?.type);
    if (!registration) {
      throw new Error(`No event handler registered for required type: ${event?.type}`);
    }
    return registration.handler(context, event);
  }

  entries() {
    return [...this.#handlers.entries()]
      .map(([type, registration]) => [type, registration.handler]);
  }
}

export function createHandlerRegistry(entries = {}) {
  return new HandlerRegistry().registerAll(entries);
}
