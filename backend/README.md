# Backend API - HydroPulse (Quản lý Hồ Chứa)

Node.js + Express + PostgreSQL + PostGIS backend.

## 🛠️ Tech Stack
- **Runtime**: Node.js + Express
- **Database**: PostgreSQL + PostGIS (spatial queries)
- **Auth**: JWT (Access + Refresh tokens)
- **Storage**: Azure Blob (report photos)
- **API Docs**: Swagger UI
- **Dev**: Nodemon (auto-restart)

---

## 🚀 Khởi Chạy Nhanh

```bash
# 1. Cài dependencies
npm install

# 2. Kiểm tra .env (cấu hình DB)
cat .env
# Cần: PGHOST, PGUSER, PGPASSWORD, PGDATABASE

# 3. Chạy development server
npm run dev
# Expected: "HydroPulse API listening on port 4000"

# 4. Kiểm tra health
curl http://localhost:4000/health
```

---

## 📋 Available Commands

```bash
# Development
npm run dev                    # Auto-restart on file change
npm start                      # Production run

# Database
npm run db:init               # Initialize schema from sql/
npm run seed:admin            # Create admin test account

# Utilities
npm run check                 # Check Node.js syntax
```

---

## 🗄️ Database Configuration

### Prerequisites

```bash
# PostgreSQL service running on localhost:5432
# Default user: postgres, password: 12345

# Verify connection:
psql -U postgres -h localhost -c "SELECT version();"

# Create database if not exists:
createdb -U postgres hydropulse
```

### Schema Setup

```bash
# Option 1: Auto-init via npm script (recommended)
npm run db:init
# Runs: sql/001_init.sql + 002_add_supporting_indexes.sql

# Option 2: Manual SQL
psql -U postgres -d hydropulse -f sql/001_init.sql
```

### Key Tables
- `users` - Admin & worker accounts
- `reservoirs` - Lake/water body boundaries (PostGIS geometry)
- `boundary_markers` - Boundary markers with location
- `tasks` - Inspection tasks assigned to workers
- `task_reports` - Field reports with location
- `report_photos` - Photos uploaded with reports (Azure Blob)
- `auth_sessions` - JWT session management

---

## 🔌 API Endpoints

### Authentication
```bash
POST   /api/auth/login              - Login (returns JWT)
POST   /api/auth/logout             - Logout (revoke session)
POST   /api/auth/refresh            - Refresh access token
POST   /api/auth/forgot-password    - Request password reset
POST   /api/auth/reset-password     - Reset password with token
```

### Reservoirs (Lakes)
```bash
GET    /api/reservoirs              - List all lakes
POST   /api/reservoirs              - Create lake (admin)
PATCH  /api/reservoirs/:id          - Update lake (admin)
DELETE /api/reservoirs/:id          - Delete lake (admin)

GET    /api/lakes                   - Alias for mobile compatibility
```

### Tasks
```bash
GET    /api/tasks                   - List tasks (filter by status, assignee)
POST   /api/tasks                   - Create task (admin)
PATCH  /api/tasks/:id               - Update task (admin)
PATCH  /api/tasks/:id/status        - Update task status
```

### Reports
```bash
POST   /api/reports                 - Submit field report (multipart)
GET    /api/reports/task/:taskId    - Get reports for task
GET    /api/reports/:id/photos      - List report photos
POST   /api/reports/:id/photos      - Upload photo to report
```

### Users
```bash
GET    /api/users                   - List users (admin)
POST   /api/users                   - Create user (admin)
PATCH  /api/users/:id               - Update user (admin)
DELETE /api/users/:id               - Soft-delete user (admin)
```

---

## 🧪 Test API Endpoints

### 1. Health Check
```bash
curl http://localhost:4000/health
# Response: { "status": "ok" }
```

### 2. Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hydropulse.vn",
    "password": "Admin@123456",
    "platform": "web"
  }'
```

### 3. Get Reservoirs (with token)
```bash
TOKEN="your-access-token-here"
curl http://localhost:4000/api/reservoirs \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Create Task (Admin)
```bash
curl -X POST http://localhost:4000/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reservoirId": "uuid-here",
    "title": "Kiểm tra hàng tuần",
    "description": "Khảo sát tính năng chất lượng nước",
    "priority": "high",
    "assignedTo": "worker-uuid"
  }'
```

### 5. Submit Report with Photos
```bash
curl -X POST http://localhost:4000/api/reports \
  -H "Authorization: Bearer $TOKEN" \
  -F "taskId=task-uuid" \
  -F "description=Báo cáo hoàn tất" \
  -F "conditionStatus=good" \
  -F "locationGeoJSON={\"type\":\"Point\",\"coordinates\":[105.5, 20.5]}" \
  -F "photo=@/path/to/photo1.jpg" \
  -F "photo=@/path/to/photo2.jpg"
```

---

## 🔐 Environment Variables

```env
# Server
PORT=4000
NODE_ENV=development

# PostgreSQL Connection
PGHOST=localhost
PGUSER=postgres
PGPASSWORD=12345
PGPORT=5432
PGDATABASE=hydropulse
PGSSLMODE=disable

# JWT Auth
JWT_SECRET=change-this-secret-in-production
JWT_EXPIRES_IN=1d

# Azure Blob Storage (report photos)
AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true
AZURE_STORAGE_CONTAINER=report-photos
AZURE_BLOB_READ_SAS_MINUTES=60

# Firebase Cloud Messaging (notifications, optional)
FCM_USE_V1=true
FCM_PROJECT_ID=
FCM_CLIENT_EMAIL=
FCM_PRIVATE_KEY=

# Planet API (satellite imagery, optional)
PLANET_API_KEY=
```

---

## 👥 User Management

### Create Admin Account
```bash
# Using npm script (PowerShell)
$env:ADMIN_EMAIL="admin@hydropulse.vn"
$env:ADMIN_PASSWORD="SecurePassword123!"
npm run seed:admin

# Or Linux/Mac
ADMIN_EMAIL=admin@hydropulse.vn ADMIN_PASSWORD=SecurePassword123! npm run seed:admin
```

### Create Worker Account (via API)
```bash
curl -X POST http://localhost:4000/api/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Tran Tran",
    "email": "worker@hydropulse.vn",
    "password": "Worker@12345",
    "role": "worker"
  }'
```

---

## 🐛 Troubleshooting

### PostgreSQL Connection Failed
```bash
# Check service running
sudo systemctl status postgresql    # Linux
brew services list                 # macOS

# Verify connection
psql -U postgres -h localhost -c "SELECT version();"

# Check env variables
env | grep PG
```

### Port 4000 Already in Use
```bash
# Find process using port
netstat -tlnp | grep 4000    # Linux
lsof -i :4000                # macOS

# Kill process
kill -9 <PID>
```

### Cannot Upload to Azure Blob
- Verify `AZURE_STORAGE_CONNECTION_STRING` is set
- Check container `report-photos` exists
- For dev, use `UseDevelopmentStorage=true`

### JWT Token Invalid/Expired
- Token expires in 1 day (configurable via `JWT_EXPIRES_IN`)
- Use `POST /api/auth/refresh` to get new access token
- Include `refreshToken` in request body

---

## 📚 Setup Seeding (Data)

```bash
# Create admin user
npm run seed:admin

# Seed sample lakes (if script exists)
# node src/scripts/addLake.js
```

---

## 🎯 Mobile Integration

Flutter app expects compatibility endpoints:

| Mobile Call | Endpoint | Response |
|-----------|----------|----------|
| `LakeService.fetchLakeBoundaries()` | `GET /api/lakes` | `{ data: [{ _id, name, boundary }] }` |
| `TaskService.fetchTasks()` | `GET /api/tasks` | `{ data: [{ _id, coordinates, status }] }` |
| `ReportService.syncReport()` | `POST /api/reports` (multipart) | Created report |

All mobile endpoints require `Authorization: Bearer <token>`

---

## 🔗 Additional Resources

- **Swagger UI**: http://localhost:4000/api-docs
- **DB Scripts**: `/sql` directory
- **Health Check**: http://localhost:4000/health

---

## ✅ Checklist Before Deployment

- [ ] JWT_SECRET changed from default
- [ ] Database password updated
- [ ] PostgreSQL running & accessible
- [ ] NODE_ENV set to "production"
- [ ] Azure Blob configured (if using)
- [ ] FCM keys added (if using notifications)
- [ ] CORS whitelisted properly
- [ ] All API tests pass

---

**Status**: Development Ready ✨  
**Created**: May 10, 2026
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
