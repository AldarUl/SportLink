// src/entities/application/types.ts
export type ApplicationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "DECLINED"
  | "WITHDRAWN"
  | "CANCELLED";

export type Application = {
  id: string;
  eventId: string;
  userId: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt?: string;
};
