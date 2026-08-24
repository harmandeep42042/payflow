export type ActiveRequest = { id: number; controller: AbortController };
export type RequestRef = { current: ActiveRequest | null };

export function beginLatestRequest(ref: RequestRef): ActiveRequest {
  ref.current?.controller.abort();
  const request = {
    id: (ref.current?.id ?? 0) + 1,
    controller: new AbortController(),
  };
  ref.current = request;
  return request;
}

export function isLatestRequest(ref: RequestRef, request: ActiveRequest): boolean {
  return !request.controller.signal.aborted && ref.current?.id === request.id;
}
