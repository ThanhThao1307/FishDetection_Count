import { spawn } from "node:child_process";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BACKEND_ROOT = path.resolve(PROJECT_ROOT, "backend");
const AI_SERVICE_ROOT = path.join(BACKEND_ROOT, "ai-service");
dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

const aiServiceUrl = new URL(process.env.AI_SERVICE_URL || "http://127.0.0.1:8000");
const healthUrl = new URL("/health", aiServiceUrl);
const isLocalAIService = ["localhost", "127.0.0.1"].includes(aiServiceUrl.hostname);
const virtualEnvPython = path.join(
  AI_SERVICE_ROOT,
  ".venv",
  process.platform === "win32" ? "Scripts" : "bin",
  process.platform === "win32" ? "python.exe" : "python"
);
const python = process.env.PYTHON_EXECUTABLE ||
  (fs.existsSync(virtualEnvPython) ? virtualEnvPython : process.platform === "win32" ? "python" : "python3");

let aiProcess;
let shuttingDown = false;

async function checkAIHealth() {
  const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
  if (!response.ok) return false;

  const health = await response.json();
  if (!health.ok) return false;
  if (!health.weights?.yoloExists || !health.weights?.cnnExists) {
    throw new Error("AI service không tìm thấy checkpoint trong backend/ai-service/weights.");
  }
  return true;
}

async function startAIService() {
  try {
    if (await checkAIHealth()) {
      console.log(`AI service đã chạy tại ${aiServiceUrl.origin}`);
      return;
    }
  } catch (error) {
    if (error.message.includes("checkpoint")) throw error;
  }

  if (!isLocalAIService) {
    throw new Error(`Không kết nối được AI service tại ${healthUrl}.`);
  }

  const entrypoint = path.join(AI_SERVICE_ROOT, "main.py");
  if (!fs.existsSync(entrypoint)) {
    throw new Error(`Không tìm thấy AI service: ${entrypoint}`);
  }

  const port = aiServiceUrl.port || (aiServiceUrl.protocol === "https:" ? "443" : "80");
  aiProcess = spawn(
    python,
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", port],
    { cwd: AI_SERVICE_ROOT, stdio: "inherit" }
  );

  let spawnError;
  aiProcess.on("error", error => { spawnError = error; });

  for (let attempt = 0; attempt < 90; attempt++) {
    if (spawnError) {
      throw new Error(`Không khởi chạy được AI service bằng Python (${python}): ${spawnError.message}`);
    }
    if (aiProcess.exitCode !== null) {
      throw new Error(`AI service đã dừng với mã lỗi ${aiProcess.exitCode}. Kiểm tra Python và dependencies trong backend/ai-service/.venv.`);
    }

    try {
      if (await checkAIHealth()) {
        console.log(`AI service sẵn sàng tại ${aiServiceUrl.origin}`);
        return;
      }
    } catch (error) {
      if (error.message.includes("checkpoint")) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`AI service không khởi động kịp. Kiểm tra log phía trên và địa chỉ ${healthUrl}.`);
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (aiProcess && aiProcess.exitCode === null) aiProcess.kill();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
process.once("SIGUSR2", shutdown);

try {
  await startAIService();
  if (aiProcess) {
    aiProcess.once("exit", (code, signal) => {
      if (!shuttingDown) {
        console.error(`AI service đã dừng (code=${code}, signal=${signal}). Khởi động lại backend để thử lại.`);
        process.exit(1);
      }
    });
  }
  await import("./app.js");
} catch (error) {
  if (aiProcess && aiProcess.exitCode === null) aiProcess.kill();
  console.error(`Backend không thể khởi động: ${error.message}`);
  process.exit(1);
}
