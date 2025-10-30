// src/entities/application/api.ts
import { http } from "@/api/http";
import type { Application, ApplicationStatus, Page } from "./types";

function norm(a: any): Application {
  return {
    id: String(a.id),
    eventId: String(a.eventId ?? a.event_id),
    userId: String(a.userId ?? a.user_id),
    status: (a.status ?? "PENDING") as ApplicationStatus,
    createdAt: a.createdAt ?? a.created_at ?? undefined,
  };
}

// === ИМЕНОВАННЫЕ ЭКСПОРТЫ ===

export async function apply(eventId: string): Promise<Application> {
  const { data } = await http.post("/application", { eventId });
  return norm(data);
}

export async function withdraw(applicationId: string): Promise<void | Application> {
  const { data } = await http.post(`/application/${applicationId}/withdraw`);
  return data ? norm(data) : undefined;
}

export async function confirm(applicationId: string): Promise<Application> {
  const { data } = await http.post(`/application/${applicationId}/confirm`);
  return norm(data);
}

export async function decline(applicationId: string): Promise<Application> {
  const { data } = await http.post(`/application/${applicationId}/decline`);
  return norm(data);
}

export async function myApplications(page = 0, size = 20): Promise<Page<Application>> {
  const { data } = await http.get("/application/my", { params: { page, size } });
  const content = (data?.content ?? data?.items ?? []).map(norm);
  return {
    content,
    totalElements: data?.totalElements ?? content.length,
    totalPages: data?.totalPages ?? 1,
    size: data?.size ?? content.length,
    number: data?.number ?? data?.page ?? 0,
  };
}

export async function applicationsByEvent(
  eventId: string,
  page = 0,
  size = 20
): Promise<Page<Application>> {
  const { data } = await http.get(`/application/by-event/${eventId}`, { params: { page, size } });
  const content = (data?.content ?? data?.items ?? []).map(norm);
  return {
    content,
    totalElements: data?.totalElements ?? content.length,
    totalPages: data?.totalPages ?? 1,
    size: data?.size ?? content.length,
    number: data?.number ?? data?.page ?? 0,
  };
}
