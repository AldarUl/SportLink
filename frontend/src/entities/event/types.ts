export type EventKind = "TRAINING" | "EVENT";
export type EventAccess = "PUBLIC" | "CLUB_ONLY";
export type EventAdmission = "AUTO" | "MANUAL";
export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";

export type Event = {
  id: string;
  kind: EventKind;
  title: string;
  sport: string;
  description?: string | null;
  startsAt: string;
  durationMin: number;
  capacity?: number;
  waitlistEnabled?: boolean;
  access: EventAccess;
  admission: EventAdmission;
  recurrenceRule?: string | null;
  registrationDeadline?: string | null;
  organizerId: string;
  clubId?: string | null;
  status: EventStatus;
  locationLat?: number | null;
  locationLon?: number | null;
};

export type Page<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last?: boolean;
};

export type EventQuery = {
  page?: number;
  size?: number;
  from?: string;
  to?: string;
  sport?: string;
  status?: EventStatus;
  clubId?: string;
  kind?: EventKind;
};

export type Bbox = { swLat: number; swLon: number; neLat: number; neLon: number };
