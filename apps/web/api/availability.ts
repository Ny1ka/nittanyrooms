/**
 * GET /api/availability?date=YYYY-MM-DD
 * Live availability for every University Park LibCal room on a campus date.
 *
 * Env:
 *   LIBCAL_LIVE=off          kill switch (returns 503; the app falls back to "Check on PSU site")
 *   LIBCAL_USER_AGENT=...    identifier sent to LibCal (see TEMP_BROWSER_UA note)
 */
import { handleAvailability } from './_lib/libcal.js';

export function GET(request: Request): Promise<Response> {
  return handleAvailability(request, { fetch, env: process.env });
}
