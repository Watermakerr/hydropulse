# HydroPulse Backend API - FE/Mobile Handoff Guide

Tai lieu nay cap nhat theo API backend hien tai (Auth refresh, push notification, reports/photos private blob, task detail theo reservoir).

## 1. Tong quan

- Base URL local: `http://localhost:4000`
- Swagger UI: `http://localhost:4000/api-docs`
- Health check: `GET /health`
- Kieu auth: JWT Bearer token

Header cho endpoint can auth:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

## 2. Chuan response

Success:

```json
{
  "success": true,
  "data": {}
}
```

Hoac:

```json
{
  "success": true,
  "message": "..."
}
```

Error:

```json
{
  "success": false,
  "message": "..."
}
```

Validation error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "path": "email",
      "msg": "Invalid value"
    }
  ]
}
```

## 3. Auth va phan quyen

Role:

- `admin`: full endpoint quan tri
- `worker`: gioi han theo logic backend

Rule quan trong:

- Worker chi duoc login voi `platform = mobile`.
- Worker chi duoc doi status task neu task do duoc assign cho chinh worker.
- Users APIs la admin only.

JWT payload:

```json
{
  "sub": "<user_uuid>",
  "role": "admin|worker",
  "fullName": "...",
  "email": "..."
}
```

## 4. Enum contract

- `user_role`: `admin`, `worker`
- `app_platform`: `web`, `mobile`
- `reservoir_status`: `active`, `inactive`, `under_review`
- `marker_status`: `normal`, `damaged`, `missing`, `needs_inspection`
- `task_status`: `pending`, `in_progress`, `completed`, `cancelled`
- `task_priority`: `low`, `medium`, `high`, `urgent`
- `condition_status`: `good`, `minor_damage`, `major_damage`, `destroyed`
- `sync_status`: `pending`, `synced`, `failed`
- `upload_status`: `pending`, `uploaded`, `failed`

## 5. Du lieu khong gian (Geo)

- SRID 4326
- `boundary_geojson`: Polygon GeoJSON
- `location_geojson`: Point GeoJSON

Vi du Point:

```json
{
  "type": "Point",
  "coordinates": [105.823, 20.998]
}
```

Vi du Polygon:

```json
{
  "type": "Polygon",
  "coordinates": [
    [
      [105.8, 21.0],
      [105.81, 21.0],
      [105.81, 20.99],
      [105.8, 20.99],
      [105.8, 21.0]
    ]
  ]
}
```

Luu y: marker bi trigger DB buoc nam trong boundary cua reservoir (neu reservoir co boundary).

## 6. API chi tiet

### 6.1 System

#### GET /health

- Auth: khong can

Response:

```json
{
  "success": true,
  "message": "API is running"
}
```

### 6.2 Auth APIs

#### POST /api/auth/login

Body:

```json
{
  "email": "admin@hydropulse.vn",
  "password": "Password123!",
  "platform": "web",
  "deviceInfo": {
    "deviceId": "optional",
    "os": "optional"
  }
}
```

Success 200: tra `accessToken`, `refreshToken`, `sessionId`, `user`.

Error:

- 401: sai email/mat khau hoac user inactive
- 403: worker login khong dung mobile

#### POST /api/auth/refresh

Body:

```json
{
  "refreshToken": "..."
}
```

Logic:

- Kiem tra session con han, chua revoke
- Rotate refresh token (refresh token moi)
- Gia han session them 30 ngay

Success 200: tra bo token moi (`accessToken`, `refreshToken`, `sessionId`, `user`).

#### POST /api/auth/logout

- Auth: can bearer token

Body:

```json
{
  "sessionId": "uuid"
}
```

#### POST /api/auth/forgot-password

Body:

```json
{
  "email": "admin@hydropulse.vn"
}
```

#### POST /api/auth/reset-password

Body:

```json
{
  "token": "raw_token",
  "newPassword": "NewPassword123!"
}
```

### 6.3 Users APIs (Admin only)

Tat ca endpoint nhom nay can:

- Bearer token
- role = admin

#### GET /api/users

Query optional:

- `role`: `admin|worker`
- `isActive`: `true|false`

#### POST /api/users

```json
{
  "fullName": "Nguyen Van A",
  "email": "a@hydropulse.vn",
  "password": "Password123!",
  "role": "worker"
}
```

#### PATCH /api/users/:id

Body optional:

```json
{
  "fullName": "Nguyen Van B",
  "role": "worker",
  "isActive": true
}
```

#### PATCH /api/users/:id/password

Body:

```json
{
  "newPassword": "Password123!"
}
```

#### DELETE /api/users/:id

Xoa mem (set `deleted_at`, `is_active = false`).

### 6.4 Reservoirs va Markers

#### GET /api/reservoirs

Query optional:

- `status`: `active|inactive|under_review`

#### POST /api/reservoirs

Co 2 cach gui boundary:

1) JSON body voi `boundaryGeoJSON`
2) `multipart/form-data` voi file `geojsonFile`

Body JSON mau:

```json
{
  "name": "Ho Thuy dien Hoa Binh",
  "description": "Mo ta",
  "status": "active",
  "boundaryGeoJSON": {
    "type": "Polygon",
    "coordinates": [[[105.8, 21.0], [105.81, 21.0], [105.81, 20.99], [105.8, 20.99], [105.8, 21.0]]]
  }
}
```

#### PATCH /api/reservoirs/:id

Field optional:

- `name`
- `description`
- `status`
- `boundaryGeoJSON` hoac `geojsonFile`

#### DELETE /api/reservoirs/:id

Xoa reservoir va cleanup task/notification lien quan.

#### GET /api/reservoirs/:id/markers

#### POST /api/reservoirs/:id/markers

```json
{
  "code": "CM-001",
  "name": "Cot moc 1",
  "orderIndex": 1,
  "status": "normal",
  "locationGeoJSON": {
    "type": "Point",
    "coordinates": [105.823, 20.998]
  }
}
```

#### PATCH /api/reservoirs/markers/:markerId

Field optional:

- `name`
- `orderIndex`
- `status`
- `locationGeoJSON`

#### DELETE /api/reservoirs/markers/:markerId

### 6.5 Tasks

#### GET /api/tasks

Role:

- admin: xem duoc tat ca
- worker: backend auto filter task assigned cho worker login

Query optional:

- `status`: `pending|in_progress|completed|cancelled`
- `assignedTo`: uuid
- `reservoirId`: uuid

Tra ve co them:

- `reservoir_name`
- `marker_code`
- `assigned_to_name`

#### POST /api/tasks (admin)

```json
{
  "reservoirId": "uuid",
  "markerId": "uuid_optional",
  "assignedTo": "uuid_optional",
  "title": "Kiem tra cot moc A12",
  "description": "Noi dung",
  "status": "pending",
  "priority": "high",
  "dueDate": "2026-04-01"
}
```

Push side effect:

- Neu co `assignedTo`, backend gui push den dung worker do (token mobile dang active).

#### PATCH /api/tasks/:id (admin)

Cap nhat field task (title, description, status, priority, assignedTo, markerId, dueDate).

Push side effect:

- Neu doi `assignedTo`, backend gui push den nguoi moi duoc giao.

#### PATCH /api/tasks/:id/status

- admin: doi status moi task
- worker: chi doi task cua minh

Body:

```json
{
  "status": "in_progress"
}
```

### 6.6 Reports va Photos

#### POST /api/reports

```json
{
  "taskId": "uuid",
  "description": "Bao cao hien truong",
  "conditionStatus": "good",
  "locationGeoJSON": {
    "type": "Point",
    "coordinates": [105.823, 20.998]
  }
}
```

#### GET /api/reports/task/:taskId

Lay danh sach report cua task.

- Worker chi duoc xem task cua minh.

#### POST /api/reports/:id/photos

- Content-Type: `multipart/form-data`
- Field bat buoc: `photo` (max 10MB)
- Field optional: `caption`

#### GET /api/reports/:id/photos

Lay danh sach anh theo report.

Luu y private blob:

- API tra `url` dang signed URL (SAS) de FE/mobile xem duoc anh khi storage account tat public access.

### 6.7 Notifications (push + in-app)

#### POST /api/notifications/devices

Dang ky hoac cap nhat token thiet bi mobile.

```json
{
  "deviceToken": "fcm_token_here",
  "platform": "android"
}
```

#### DELETE /api/notifications/devices

Huy token dang ky:

```json
{
  "deviceToken": "fcm_token_here"
}
```

#### GET /api/notifications

Lay danh sach notification cua user hien tai (toi da 100 ban ghi gan nhat).

### 6.8 Dashboard

#### GET /api/dashboard/summary

- Auth: can
- Role: admin

### 6.9 Satellite Analysis (PlanetScope)

He thong tich hop Planet Data API de phan tich dien tich mat nuoc va canh bao thay doi bat thuong. Role admin bat buoc voi tich hop he thong.

#### POST /api/satellite/analyze/:reservoirId

Kich hoat quet va tinh toan ve tinh thu cong cho 1 ho chua.
- Auth: can
- Role: admin (chu yeu tu dong chay qua cron hoac thao tac tren web)

Body optional:
```json
{
  "date": "2026-04-12" // mac dinh la hom nay (se quet 30 ngay gan nhat tu ngay nay)
}
```

Response: Tra ve ket qua phan tich (dien tich, do che phu may, percent thay doi, alert_level).

#### POST /api/satellite/analyze-all

Kich hoat quet tu dong toan bo ho chua trong DB. Thuong dung cho Cron job.

#### GET /api/satellite/history/:reservoirId

Lay lich su phan tich ve tinh cua 1 ho chua de render UI/Bieu do.
- Auth: can

Response: 
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "reservoir_id": "uuid",
      "capture_date": "2026-04-12",
      "water_surface_area": 39229300,
      "change_percentage": 0,
      "alert_level": "LOW",
      "raw_response": {
        "scene_id": "20260412_041031_85_250b",
        "cloud_cover": 0.0,
        "clear_percent": 100.0,
        "acquired": "2026-04-12T04:10:31Z",
        "pixel_resolution": 3,
        "scenes_found": 20
      },
      "created_at": "2026-04-14T06:00:00Z"
    }
  ]
}
```

#### GET /api/satellite/thumbnail/:sceneId

Proxy endpoint dung de render hinh anh ve tinh tu Planet len tren web ma khong lo API KEY ra FE.
- Tra ve raw image stream (`image/png` hoac `image/jpeg`).
- Su dung truc tiep trong the `<img src="http://api/satellite/thumbnail/..." />`.

Query optional:
- `width`: Kich thuoc anh (mac dinh 256, toi da 512 do gioi han tu Planet). VD: `?width=512`.

## 7. Ma loi HTTP thuong gap

- `200` OK
- `201` Created
- `400` Validation failed / bad input
- `401` Unauthorized / Invalid token / refresh token het han
- `403` Forbidden
- `404` Not found
- `502` Upload service ben ngoai loi (Azure Blob)
- `500` Loi he thong

## 8. Luu y contract quan trong

- `users` response la snake_case (`full_name`) trong khi request la camelCase (`fullName`). FE can map ro rang.
- `login` va `refresh` deu tra `accessToken` + `refreshToken` + `sessionId`.
- API reports hien tai cho phep moi user da auth tao report (worker_id lay tu token). Neu can rule chat hon, can bo sung backend.
- URL anh tra ve la signed URL co han (khong phai permanent public URL).

## 9. Luong tich hop goi y cho mobile worker

1. Login mobile (`platform = mobile`) -> luu `accessToken`, `refreshToken`, `sessionId`.
2. Goi `POST /api/notifications/devices` de dang ky FCM token.
3. Dung `GET /api/tasks` de lay task duoc giao.
4. Het han access token -> goi `POST /api/auth/refresh` lay bo token moi.
5. Update status task (`PATCH /api/tasks/:id/status`).
6. Tao report (`POST /api/reports`) + upload anh (`POST /api/reports/:id/photos`).
7. Logout -> `POST /api/auth/logout` + `DELETE /api/notifications/devices`.

## 10. Tai lieu lien quan

- SQL schema + trigger: `backend/sql/001_init.sql`
- Route wiring: `backend/src/app.js`
- Swagger docs: `/api-docs`

## 11. FCM HTTP v1 setup (Push cho mobile)

Backend da ho tro FCM HTTP v1 (uu tien) va co fallback legacy.

Khai bao env trong backend:

```env
FCM_USE_V1=true
FCM_PROJECT_ID=your_firebase_project_id
FCM_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Ghi chu:

- `FCM_PRIVATE_KEY` phai giu nguyen dinh dang key va newline dang `\n`.
- Neu dung file service account qua `GOOGLE_APPLICATION_CREDENTIALS`, ban van can set `FCM_PROJECT_ID`.
- Legacy key `FCM_SERVER_KEY` chi de fallback, khong khuyen nghi cho project moi.
