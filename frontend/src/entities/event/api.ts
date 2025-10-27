import { http } from "@/api/http";
import type { Event } from "./types";

export async function fetchEventsByBbox(b: {
  minLat: number; minLon: number; maxLat: number; maxLon: number;
}): Promise<Event[]> {
  const { data } = await http.get<Event[]>("/events/bbox", { params: b });
  return data.filter((e: Event) => e.locationLat !== null && e.locationLon !== null);
}
