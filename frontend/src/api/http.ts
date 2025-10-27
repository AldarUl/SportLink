import axios from "axios";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // например http://localhost:8080/api
});
