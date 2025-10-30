// src/entities/application/types.ts
export type ApplicationStatus = "PENDING" | "CONFIRMED" | "DECLINED" | "WAITLISTED";

export type Application = {
  id: string;
  eventId: string;
  userId: string;
  status: ApplicationStatus;
  createdAt?: string;
};

// берём Page из событий, чтобы не дублировать тип
export type { Page } from "@/entities/event/types";
