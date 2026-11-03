import axios from "axios";
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api" });
api.interceptors.request.use(config => { const token = localStorage.getItem("fish_token"); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
export async function uploadVideo(file, onUploadProgress) { const form = new FormData(); form.append("video", file); const { data } = await api.post("/analyses", form, { onUploadProgress }); return data; }
export async function getAnalysis(id) { return (await api.get(`/analyses/${id}`)).data; }
export async function getProcessedVideoUrl(id) {
  const { data } = await api.get(`/analyses/${id}/video-access`);
  const videoUrl = new URL(api.getUri({ url: `/analyses/${id}/video` }), window.location.origin);
  videoUrl.searchParams.set("token", data.token);
  return videoUrl.href;
}
export async function getHistory(page=1) { return (await api.get(`/analyses?page=${page}&limit=10`)).data; }
export async function deleteAnalysis(id) { return (await api.delete(`/analyses/${id}`)).data; }
export async function authenticate(mode, payload) { return (await api.post(`/auth/${mode}`, payload)).data; }
export async function updateProfile(payload) { return (await api.patch("/auth/me", payload)).data; }
