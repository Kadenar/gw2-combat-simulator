/** Reservations are allocated once per accepted cast and retained until its one completion consumes them. */
export function createCastReservations<T extends object>() {
  const reservations = new Map<string, T & { id: string }>();
  let sequence = 0;
  return {
    reserve(details: T): T & { id: string } {
      const reservation = { ...details, id: `cast:${++sequence}` };
      reservations.set(reservation.id, reservation);
      return reservation;
    },
    get: (id: string) => reservations.get(id),
    delete: (id: string) => reservations.delete(id)
  };
}
