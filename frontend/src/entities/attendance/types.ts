export type AttendanceStatus = "ATTENDED" | "ABSENT";

export type AttendanceResponse = {
  id: string;
  eventId: string;
  userId: string;
  status: AttendanceStatus;
  markedBy: string | null;
  createdAt: string;
  updatedAt: string;
};
