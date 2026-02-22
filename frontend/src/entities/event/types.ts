export type EventKind = "TRAINING" | "EVENT";
export type EventAccess = "PUBLIC" | "PRIVATE";
export type EventAdmission = "AUTO" | "MANUAL";
export type EventStatus = "DRAFT" | "PUBLISHED" | "STARTED" | "FINISHED" | "CANCELLED";

export type Event = {
  id: string;
  kind: EventKind;
  title: string;
  sport: string;
  description?: string | null;
  startsAt: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  durationMin: number;
  capacity?: number;
  waitlistEnabled?: boolean;
  access: EventAccess;
  admission: EventAdmission;
  recurrenceRule?: string | null;
  registrationDeadline?: string | null;
  organizerId: string;
  status: EventStatus;
  levelMin?: number | null;
  levelMax?: number | null;
  launchedAt?: string | null;
  launchedBy?: string | null;
  locationLat?: number | null;
  locationLon?: number | null;
};

export type Page<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

export type EventQuery = {
  kind?: "TRAINING" | "EVENT";
  sport?: string;
  from?: string;
  to?: string;
  access?: "PUBLIC" | "PRIVATE";
  admission?: "AUTO" | "MANUAL";
  page?: number;
  size?: number;
};

export type Bbox = {
  swLat: number;
  swLon: number;
  neLat: number;
  neLon: number;
  centerLat?: number;
  centerLon?: number;
};
