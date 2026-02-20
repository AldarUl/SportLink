import { http } from "@/api/http";
import type { ReviewCreate, ReviewPage } from "./types";

export async function createReview(payload: ReviewCreate) {
  const { data } = await http.post(`/review`, payload);
  return data;
}

export async function listReviewsByEvent(eventId: string, targetId: string, page = 0, size = 20): Promise<ReviewPage> {
  const { data } = await http.get(`/review/by-event/${eventId}`, { params: { targetId, page, size } });
  return data;
}
