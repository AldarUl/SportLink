export type AttendanceStatus = "ATTENDED" | "ABSENT";

export type Attendance = {
  id: string;
  eventId: string;
  userId: string;
  status: AttendanceStatus;
  markedBy?: string | null;
  markedAt: string;
};

/**
 * Если бэкенд возвращает Attendance как есть — можешь оставить так.
 * Если у тебя на бэке другой формат (например DTO), подстрой тут.
 */
export type AttendanceResponse = Attendance;
