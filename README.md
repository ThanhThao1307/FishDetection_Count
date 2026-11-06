# FishCount — Nhận diện và thống kê cá từ video

FishCount là ứng dụng web hỗ trợ phân tích video để nhận diện, phân loại và thống kê cá xuất hiện trong từng khung hình. Người dùng tải video lên, theo dõi tiến độ xử lý, xem số liệu theo loài và xem lại video đã được đánh dấu vị trí cá.

## Công nghệ đang sử dụng

| Thành phần | Công nghệ |
|---|---|
| Giao diện web | React 18, Vite 6, Recharts |
| Backend/API | Node.js, Express 4, Mongoose |
| Dịch vụ AI | Python, FastAPI, Uvicorn |
| Nhận diện và phân loại | Ultralytics YOLO, PyTorch, Torchvision với mô hình ResNet-18 |
| Theo dõi đối tượng và xử lý video | ByteTrack, OpenCV, ImageIO-FFmpeg |
| Cơ sở dữ liệu | MongoDB |

## Chức năng chính

- Tải video lên và theo dõi trạng thái, tiến độ phân tích.
- Phát hiện cá, theo dõi đối tượng qua các khung hình và phân loại thành ba loài mục tiêu (*Diplodus sargus*, *Dentex dentex*, *Diplodus vulgaris*) hoặc nhóm “khác/chưa xác định”.
- Xem số lượng cá theo loài, số lượng đồng thời lớn nhất và biểu đồ số liệu theo thời gian.
- Xem video đầu ra có khung đánh dấu và nhãn nhận diện.
- Đăng ký/đăng nhập, quản lý hồ sơ và xem lịch sử phân tích cá nhân. Có thể dùng thử phân tích mà không đăng nhập.

## Cài đặt môi trường

Mở terminal trong VS Code tại thư mục project.

### Node.js 20 LTS trở lên

Cài đặt:

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

Nếu đã cài, kiểm tra phiên bản:

```powershell
node --version
npm --version
```

Node.js cần phiên bản 20 trở lên.

### Python 3.10–3.12

Cài Python 3.12:

```powershell
winget install --id Python.Python.3.12 -e
```

Nếu đã cài, kiểm tra phiên bản:

```powershell
python --version
```

### MongoDB

Cài MongoDB Community Server:

```powershell
winget install --id MongoDB.Server -e
```

Kiểm tra dịch vụ:

```powershell
Get-Service MongoDB
```

Nếu dịch vụ chưa chạy, mở PowerShell bằng quyền Administrator rồi chạy:

```powershell
Start-Service MongoDB
```

## Cài đặt và chạy project

### Cài thư viện (chỉ làm một lần sau khi tải project)

Các lệnh 'npm install' cài thư viện Node.js cần thiết cho backend/frontend. Đây không phải lệnh chạy ứng dụng; sau này không cần cài lại trừ khi dependencies thay đổi.

```powershell
cd backend
npm install

cd ..\frontend
npm install

cd ..\backend\ai-service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ..\..\requirements.txt
```

Đảm bảo có file ".env" ở thư mục gốc và đã cấu hình kết nối MongoDB. AI service cần các checkpoint trong "backend\ai-service\weights".

### Chạy ứng dụng

Khởi động MongoDB. Mỗi lần chạy project, mở hai terminal tại thư mục gốc project. Không chạy lại 'npm install'.

Terminal 1 — backend và AI service:

```powershell
cd backend
npm run dev
```

Terminal 2 — frontend:

```powershell
cd frontend
npm run dev
```

Mở địa chỉ frontend hiển thị trong terminal, thường là `http://localhost:5173`.
