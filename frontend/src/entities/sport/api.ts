import { http } from "@/api/http";
export type Sport = { code: string; name: string };
export async function listSports(): Promise<Sport[]> {
  const { data } = await http.get("/sport");
  return data as Sport[];
}
