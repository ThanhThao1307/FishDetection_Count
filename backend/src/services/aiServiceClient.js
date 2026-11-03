import axios from "axios";

const baseURL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
const token = process.env.AI_SERVICE_TOKEN || "change-this-local-secret";

const client = axios.create({
  baseURL,
  timeout: 15000,
  headers: token ? { "x-service-token": token } : {}
});

export async function startInference({ analysisId, videoPath }) {
  const { data } = await client.post("/tasks", { analysisId, videoPath });
  return data;
}
export async function getInferenceTask(taskId) {
  const { data } = await client.get(`/tasks/${encodeURIComponent(taskId)}`);
  return data;
}

