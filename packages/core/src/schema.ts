import { z } from 'zod';

/**
 * Data model for Nittany Rooms. Each record carries provenance: which source(s) back it,
 * when it was last verified, and how confident we are. Shapes mirror the target
 * PostgreSQL schema in docs/ARCHITECTURE.md so the JSON can be loaded into tables later.
 */

export const CAMPUS_TIMEZONE = 'America/New_York';

/** How much we trust a record or field. */
export const VerificationStatus = z.enum([
  /** Read directly from an official source. */
  'verified',
  /** Derived from verified data by a stated rule (e.g. floor from room number). */
  'inferred',
  /** Plausible, listed for review, never shown as fact. */
  'candidate',
]);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

const isoDate = z.iso.date();
const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lowercase kebab-case');

export const Verification = z.object({
  status: VerificationStatus,
  sourceIds: z.array(id).min(1),
  /** Date (campus local) the record was last checked against its sources. */
  verifiedAt: isoDate,
  note: z.string().optional(),
});
export type Verification = z.infer<typeof Verification>;

export const DataSource = z.object({
  id,
  name: z.string().min(1),
  owner: z.string().min(1),
  url: z.url(),
  accessMethod: z.enum(['public-page', 'api', 'download', 'manual', 'approved-integration']),
  retrievedAt: isoDate,
  license: z.string().optional(),
  notes: z.string().optional(),
});
export type DataSource = z.infer<typeof DataSource>;

export const ReservationProvider = z.object({
  id,
  name: z.string().min(1),
  owner: z.string().min(1),
  system: z.enum(['libcal', 'outlook', '25live', 'other']),
  /** Official entry point students use. Always required. */
  portalUrl: z.url(),
  /**
   * How we hand a student off:
   * - room-link: each room has its own official booking URL
   * - portal-with-instructions: no per-room link; open portal and show steps
   */
  handoffMode: z.enum(['room-link', 'portal-with-instructions']),
  handoffSteps: z.array(z.string().min(1)).min(1),
  /** Whether booking is instant or a request that must be approved. */
  confirmation: z.enum(['instant-email', 'approval-email']),
  /** What permitted programmatic availability access exists right now. */
  availabilityAccess: z.enum(['none', 'approved-api', 'approved-public-feed']),
  supportContact: z.string().optional(),
  verification: Verification,
});
export type ReservationProvider = z.infer<typeof ReservationProvider>;

export const ReservationPolicy = z.object({
  id,
  providerId: id,
  /** Shortest booking the provider allows. */
  minDurationMinutes: z.number().int().positive(),
  /** Longest single booking (null = unknown / not stated). */
  maxDurationMinutes: z.number().int().positive().nullable(),
  /** Bookings must start on multiples of this many minutes past the hour. */
  startIncrementMinutes: z.number().int().positive(),
  /** Minimum time between now and a booking's start. */
  leadTimeMinutes: z.number().int().min(0),
  /** How many days ahead booking opens (null = unknown). */
  bookingHorizonDays: z.number().int().positive().nullable(),
  /** Gaps shorter than this are hidden by default (configurable, 30 min starting point). */
  minUsefulGapMinutes: z.number().int().positive(),
  /** Each numeric field's provenance. Fields not listed are configurable defaults. */
  verifiedFields: z.array(
    z.enum([
      'minDurationMinutes',
      'maxDurationMinutes',
      'startIncrementMinutes',
      'leadTimeMinutes',
      'bookingHorizonDays',
    ]),
  ),
  rules: z.array(z.string()),
  verification: Verification,
});
export type ReservationPolicy = z.infer<typeof ReservationPolicy>;

export const FloorplanState = z.enum([
  /** Verified floor plan with verified room geometry. */
  'verified',
  /** Floor plan available, room geometry partially verified. */
  'partial',
  /** Approximate schematic, clearly labeled. */
  'approximate',
  /** No usable floor plan: show a room list / number-order tiles. */
  'none',
]);
export type FloorplanState = z.infer<typeof FloorplanState>;

export const Floor = z.object({
  id,
  /** Label as students would say it, e.g. "1", "G". */
  label: z.string().min(1),
  /**
   * True when the source doesn't say which floor these rooms are on.
   * Rooms are grouped here instead of being guessed onto a real floor.
   */
  unlisted: z.boolean().optional(),
  /** Sort order, lowest first. */
  level: z.number().int(),
  floorplan: FloorplanState,
  verification: Verification,
});
export type Floor = z.infer<typeof Floor>;

export const Building = z.object({
  id,
  name: z.string().min(1),
  shortName: z.string().min(1),
  aliases: z.array(z.string()),
  /** What the student is looking for here (e.g. "Engineering Library"). */
  headline: z.string().min(1),
  /** Short marker label for the map; one of the aliases. Defaults to headline. */
  mapLabel: z.string().min(1).optional(),
  address: z.string().nullable(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    source: z.literal('openstreetmap'),
    osmElement: z.string().regex(/^(node|way|relation)\/\d+$/),
  }),
  hoursUrl: z.url().nullable(),
  /** verified = has ≥1 verified reservable room via an official process. */
  status: z.enum(['verified', 'candidate']),
  /** Is our room list for this building complete? */
  roomInventory: z.enum(['complete', 'partial', 'none']),
  providerIds: z.array(id).min(1),
  floors: z.array(Floor),
  notes: z.array(z.string()),
  verification: Verification,
});
export type Building = z.infer<typeof Building>;

/** Room features we recognise. Only ever set from a verified source. */
export const RoomFeature = z.enum([
  'accessible',
  'whiteboard',
  'screen-monitor',
  'power',
  'desktop-pc',
  'solstice',
]);
export type RoomFeature = z.infer<typeof RoomFeature>;

export const FEATURE_LABELS: Record<RoomFeature, string> = {
  accessible: 'Accessible',
  whiteboard: 'Whiteboard',
  'screen-monitor': 'Screen monitor',
  power: 'Power outlets',
  'desktop-pc': 'Desktop PC',
  solstice: 'Solstice wireless display',
};

export const Room = z.object({
  id,
  /** The provider's own identifier (LibCal space id, mailbox, …) when known. */
  providerRoomId: z.string().nullable(),
  buildingId: id,
  floorId: id,
  /** Official label exactly as published, e.g. "248" or "Pattee W120 - Knowledge Commons". */
  officialLabel: z.string().min(1),
  /** Compact label for tiles and lists, e.g. "W120". Defaults to officialLabel. */
  shortLabel: z.string().min(1).optional(),
  displayName: z.string().min(1),
  /** Named area within the building, e.g. "Knowledge Commons". */
  area: z.string().nullable().optional(),
  type: z.enum(['group-study', 'individual-study', 'conference', 'other']),
  capacity: z.number().int().positive().nullable(),
  /** Only verified features. Empty when unknown. */
  features: z.array(RoomFeature),
  eligibility: z.string().min(1),
  providerId: id,
  policyId: id,
  /** Room-specific official booking URL; null when provider has no per-room link. */
  bookingUrl: z.url().nullable(),
  floorplanLocation: z.enum(['known', 'approximate', 'unknown']),
  /** Provenance for the floor assignment specifically. */
  floorVerification: VerificationStatus,
  verification: Verification,
});
export type Room = z.infer<typeof Room>;

export const Dataset = z.object({
  sources: z.array(DataSource),
  providers: z.array(ReservationProvider),
  policies: z.array(ReservationPolicy),
  buildings: z.array(Building),
  rooms: z.array(Room),
});
export type Dataset = z.infer<typeof Dataset>;
