// src/entities/application/types.ts
export type ApplicationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "DECLINED"
  | "WAITLISTED"
  | "WITHDRAWN"; // на всякий случай, если бэк такое вернёт

export type Application = {
  id: string;
  eventId: string;
  userId: string;
  status: ApplicationStatus;
  createdAt?: string | null;
};

// удобный тип для стора (заявка + вложенное событие)
export type ApplicationWithEvent<E = any> = Application & { event?: E | null };

// берём Page из событий, чтобы не дублировать тип
export type { Page } from "@/entities/event/types";
