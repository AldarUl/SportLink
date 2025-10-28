// src/entities/application/api.ts
import { http } from "@/api/http";
import type { Application } from "./types";

const norm = (a: any): Application => ({
  id: String(a.id),
  eventId: String(a.eventId ?? a.event_id),
  userId: String(a.userId ?? a.user_id),
  status: a.status,
  createdAt: a.createdAt ?? a.created_at,
  updatedAt: a.updatedAt ?? a.updated_at,
});

export async function myApplications(): Promise<Application[]> {
  const { data } = await http.get("/application/my");
  return (Array.isArray(data) ? data : data?.content ?? []).map(norm);
}

export async function applyToEvent(eventId: string): Promise<Application> {
  const { data } = await http.post("/application", { eventId });
  return norm(data);
}

export async function withdrawApplication(applicationId: string): Promise<void> {
  await http.post(`/application/${applicationId}/withdraw`);
}
