import { http } from "@/api/http";
import type { Attendance, AttendanceStatus } from "./types";

export async function getMyAttendance(eventId: string): Promise<Attendance | null> {
  const { data } = await http.get(`/attendance/event/${eventId}/me`);
  return data ?? null;
}

export async function setMyAttendance(eventId: string, status: AttendanceStatus): Promise<Attendance> {
  const { data } = await http.post(`/attendance/event/${eventId}/me`, { status });
  return data;
}

export async function setAttendanceForUser(eventId: string, userId: string, status: AttendanceStatus): Promise<Attendance> {
  const { data } = await http.post(`/attendance/event/${eventId}/user/${userId}`, { status });
  return data;
}
