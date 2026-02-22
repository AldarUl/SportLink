// src/entities/attendance/api.ts

import { http } from "@/api/http";
import type { AttendanceResponse, AttendanceStatus } from "./types";

// Backend routes (см. AttendanceController):
// GET  /api/v1/event/{eventId}/attendance/me
// POST /api/v1/event/{eventId}/attendance/me?status=...
// POST /api/v1/event/{eventId}/attendance   (body: { userId, status })
// GET  /api/v1/event/{eventId}/attendance   (organizer only)
// GET  /api/v1/event/{eventId}/attendance/rateable (organizer or participant after organizer marked attendance)

export const getMyAttendance = async (eventId: string): Promise<AttendanceResponse> => {
  const res = await http.get(`/event/${eventId}/attendance/me`);
  return res.data;
};

export const setMyAttendance = async (
  eventId: string,
  status: AttendanceStatus
): Promise<AttendanceResponse> => {
  const res = await http.post(`/event/${eventId}/attendance/me`, null, {
    params: { status },
  });
  return res.data;
};

export const setAttendanceForUser = async (
  eventId: string,
  userId: string,
  status: AttendanceStatus
): Promise<AttendanceResponse> => {
  const res = await http.post(`/event/${eventId}/attendance`, { userId, status });
  return res.data;
};

export const listAttendance = async (eventId: string): Promise<AttendanceResponse[]> => {
  const res = await http.get(`/event/${eventId}/attendance`);
  return res.data;
};

export const listRateableUserIds = async (eventId: string): Promise<string[]> => {
  const res = await http.get(`/event/${eventId}/attendance/rateable`);
  return res.data;
};
