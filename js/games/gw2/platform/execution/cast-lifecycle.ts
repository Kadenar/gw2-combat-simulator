/** Reservations are allocated once per accepted cast and retained until its one completion consumes them. */
export function createCastReservations<T extends object>() {
  let reservations = new Map<string, T & { id: string }>();
  let sequence = 0;
  return {
    // Reservation objects and cast-owned facts are copied in the same graph as queued work.
    snapshot: () => ({ reservations, sequence }),
    restore(saved: { reservations: typeof reservations; sequence: number }) {
      reservations = saved.reservations;
      sequence = saved.sequence;
    },
    reserve(details: T): T & { id: string } {
      const reservation = { ...details, id: `cast:${++sequence}` };
      reservations.set(reservation.id, reservation);
      return reservation;
    },
    get: (id: string) => reservations.get(id),
    delete: (id: string) => reservations.delete(id)
  };
}
