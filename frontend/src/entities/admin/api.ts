import { http } from "@/api/http";
import type { AdminEvent, AdminSummary, AdminUser, PageResponse } from "./types";

export async function adminSummary(): Promise<AdminSummary> {
  const { data } = await http.get("/admin/summary");
  return data;
}

export async function adminListUsers(page = 0, size = 20): Promise<PageResponse<AdminUser>> {
  const { data } = await http.get("/admin/user", { params: { page, size } });
  return data;
}

export async function adminBlockUser(userId: string) {
  await http.post(`/admin/user/${userId}/block`);
}

export async function adminUnblockUser(userId: string) {
  await http.post(`/admin/user/${userId}/unblock`);
}

export async function adminListEvents(status?: string, page = 0, size = 20): Promise<PageResponse<AdminEvent>> {
  const params: any = { page, size };
  if (status) params.status = status;
  const { data } = await http.get("/admin/event", { params });
  return data;
}

export async function adminHideEvent(eventId: string) {
  await http.post(`/admin/event/${eventId}/hide`);
}

export async function adminPublishEvent(eventId: string) {
  await http.post(`/admin/event/${eventId}/publish`);
}

export async function adminDeleteEvent(eventId: string) {
  await http.delete(`/admin/event/${eventId}`);
}
