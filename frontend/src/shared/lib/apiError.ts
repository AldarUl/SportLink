import axios from "axios";

export type ApiErrorPayload = {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  code?: string;
  path?: string;
};

export function getApiErrorMessage(err: unknown, fallback = "Произошла ошибка") {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorPayload | undefined;
    return data?.message || data?.error || err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
