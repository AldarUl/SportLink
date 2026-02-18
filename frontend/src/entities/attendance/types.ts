export type AttendanceStatus = "ATTENDED" | "ABSENT";

export type Attendance = {
  id: string;
  eventId: string;
  userId: string;
  status: AttendanceStatus;
  markedBy?: string | null;
  markedAt: string;
};
