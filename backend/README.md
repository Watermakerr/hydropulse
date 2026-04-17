# HydroPulse Boundary OS - Backend API

Backend service cho hệ thống quản lý ranh giới hồ chứa.

## Tech stack
- Node.js + Express
- PostgreSQL + PostGIS
- JWT Auth
- Azure Blob Storage (upload ảnh)
- Swagger UI

## 1) Cài đặt

```bash
npm install
```

Copy file env:

```bash
cp .env.example .env
```

## 2) Khởi tạo database

Bạn có thể chạy SQL theo 1 trong 2 cách:

- Dùng psql thủ công:

```bash
psql -f sql/001_init.sql
```

- Hoặc dùng script npm (đọc `PGHOST`, `PGUSER`, `PGPORT`, `PGDATABASE`, `PGPASSWORD` từ môi trường):

```bash
npm run db:init
```

## 3) Tạo admin mặc định

```bash
ADMIN_EMAIL=admin@hydropulse.vn ADMIN_PASSWORD=Admin@123456 npm run seed:admin
```

Trên PowerShell:

```powershell
$env:ADMIN_EMAIL="admin@hydropulse.vn"
$env:ADMIN_PASSWORD="Admin@123456"
npm run seed:admin
```

## 4) Chạy server

```bash
npm run dev
```

Mặc định server chạy tại `http://localhost:4000`.

## 5) Swagger test API

Mở trình duyệt:

- `http://localhost:4000/api-docs`

Bạn login ở endpoint `/api/auth/login`, lấy `accessToken`, sau đó bấm **Authorize** trong Swagger và nhập:

```text
Bearer <accessToken>
```

## Cấu trúc API chính
- Auth: `/api/auth/*`
- Users: `/api/users/*`
- Reservoirs + Markers: `/api/reservoirs/*`
- Tasks: `/api/tasks/*`
- Reports + Photo Upload: `/api/reports/*`
- Dashboard: `/api/dashboard/summary`

## Lưu ý bảo mật
- Không commit secret thật vào source code.
- Dùng biến môi trường cho `AZURE_STORAGE_CONNECTION_STRING`.
- Nên dùng SAS token hoặc Managed Identity trên môi trường production.
