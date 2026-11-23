import { FEATURE_LABELS, type Building, type Floor, type ReservationProvider, type Room } from '@nittany-rooms/core';

export const roomShort = (r: Room) => r.shortLabel ?? r.officialLabel;

export const floorName = (f: Floor | undefined) =>
  !f ? 'Floor not verified' : f.unlisted ? 'Floor not listed' : f.label === 'G' ? 'Ground floor' : `Floor ${f.label}`;

/** "floors G, 1 and 3" / "floor 1" / "" — listed floors only. */
export function floorsPhrase(b: Building): string {
  const labels = [...b.floors]
    .filter((f) => !f.unlisted)
    .sort((x, y) => x.level - y.level)
    .map((f) => f.label);
  const some = b.floors.some((f) => f.unlisted) ? ' (some with no floor listed)' : '';
  if (labels.length === 0) return '';
  if (labels.length === 1) return `floor ${labels[0]}${some}`;
  return `floors ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}${some}`;
}

export function roomCountPhrase(n: number) {
  return `${n} reservable room${n === 1 ? '' : 's'}`;
}

/** "In Deike Building." — only when the building differs from the headline. */
export function buildingPhrase(b: Building): string {
  // Library buildings named after the library ("Pattee Library and Paterno Library") add nothing.
  if (b.headline === b.name || /Librar/.test(b.name)) return '';
  return `In the ${b.name}${!b.name.includes(b.shortName) ? ` (${b.shortName})` : ''}.`;
}

export const featureList = (r: Room) => r.features.map((f) => FEATURE_LABELS[f]);

/** Why availability isn't shown, worded for the provider. */
export function unknownReason(p: ReservationProvider): string {
  if (p.system === 'outlook') {
    return `${p.owner} doesn't publish these rooms' schedules publicly. You'll see which rooms are free when you search in Outlook.`;
  }
  return "Live availability isn't connected yet. Open times are on Penn State's booking page.";
}
