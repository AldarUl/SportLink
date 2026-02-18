import { http } from "@/api/http";
import type { UserPublic } from "./types";

export async function getUser(id: string): Promise<UserPublic> {
  const { data } = await http.get(`/user/${id}`);
  return data;
}
