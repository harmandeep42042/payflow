import { createHash } from 'node:crypto';

const CACHE_MILLISECONDS = 5_000;
const refreshFlights = new Map<string, Promise<unknown>>();

export function singleFlightRefresh<T>(
  refreshToken: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = createHash('sha256')
    .update(refreshToken)
    .digest('hex');
  const existing = refreshFlights.get(key);

  if (existing) return existing as Promise<T>;

  const flight = operation();
  refreshFlights.set(key, flight);

  const scheduleRemoval = () => {
    const timer = setTimeout(() => {
      if (refreshFlights.get(key) === flight) refreshFlights.delete(key);
    }, CACHE_MILLISECONDS);
    timer.unref?.();
  };
  void flight.then(scheduleRemoval, scheduleRemoval);

  return flight;
}

export function resetRefreshFlightsForTests(): void {
  refreshFlights.clear();
}
