export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

export type AdminSummary = {
  userCount: number;
  eventCount: number;
  applicationCount: number;
};

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  blocked: boolean;
  createdAt: string;
};

export type AdminEvent = {
  id: string;
  kind: "TRAINING" | "EVENT";
  title: string;
  sport: string;
  startsAt: string;
  capacity?: number | null;
  status: "DRAFT" | "PUBLISHED" | "STARTED" | "FINISHED" | "CANCELLED";
  organizerId: string;
};
