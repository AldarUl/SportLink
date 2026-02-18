import { http } from "@/api/http";
import type { ReviewCreate, ReviewPage } from "./types";

export async function createReview(payload: ReviewCreate) {
  const { data } = await http.post(`/review`, payload);
  return data;
}

export async function listReviewsByEvent(eventId: string, targetUserId: string, page = 0, size = 20): Promise<ReviewPage> {
  const { data } = await http.get(`/review/by-event/${eventId}`, { params: { targetUserId, page, size } });
  return data;
}
