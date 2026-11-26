/** Throw these from services/routes. The error handler turns them into safe JSON responses. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, "bad_request", message, details);
export const unauthorized = (message = "Please sign in") => new HttpError(401, "unauthorized", message);
export const forbidden = (message = "You don't have access to this") => new HttpError(403, "forbidden", message);
export const notFound = (message = "Not found") => new HttpError(404, "not_found", message);
export const conflict = (message: string) => new HttpError(409, "conflict", message);
export const tooMany = (message = "Too many attempts. Please wait and try again.") =>
  new HttpError(429, "too_many_requests", message);
