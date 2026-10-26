import { HttpErrorResponse } from '@angular/common/http';

export function apiErrorMessage(err: HttpErrorResponse, fallback: string): string {
  const message = err.error?.message;
  return (Array.isArray(message) ? message.join(', ') : message) ?? fallback;
}
