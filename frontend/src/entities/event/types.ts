export type Event = {
  id: string;
  kind: string;               // "EVENT" | "TRAINING" | "USER" (если понадобится)
  title: string;
  sport: string;
  description?: string | null;
  startsAt: string;
  durationMin: number;
  capacity: number;
  waitlistEnabled: boolean;
  access: string;
  admission: string;
  recurrenceRule?: string | null;
  registrationDeadline?: string | null;
  organizerId: string;
  clubId?: string | null;
  status: string;
  locationLat: number | null;
  locationLon: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
};

export type EventQuery = {
  page?: number;
  size?: number;
  from?: string;   // ISO start
  to?: string;     // ISO end
  sport?: string;
  status?: string; // e.g. "PUBLISHED"
  clubId?: string;
  kind?: string;
};

// BBox в формате SW/NE (как использует api.ts)
export type Bbox = {
  swLat: number; swLon: number;
  neLat: number; neLon: number;
};
