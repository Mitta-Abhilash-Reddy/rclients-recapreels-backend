# RecapReels — Backend

Production-ready Node.js + Express backend for the RecapReels SaaS platform.
Implements a strict **contract-first** architecture: the DB schema is fully hidden from the frontend.

---

## Stack

| Layer     | Technology                         |
|-----------|------------------------------------|
| Runtime   | Node.js ≥ 18                       |
| Framework | Express 4                          |
| Database  | Supabase (PostgreSQL)              |
| Storage   | Supabase Storage (`recapreels`)    |
| Auth      | JWT (jsonwebtoken + bcryptjs)      |
| Upload    | Multer (memory storage)            |

---

## Quick Start

```bash
cd backend
cp .env.example .env      # fill in your values
npm install
npm run dev               # nodemon hot-reload
```

---

## Environment Variables

| Variable                    | Description                              |
|-----------------------------|------------------------------------------|
| `PORT`                      | HTTP port (default 4000)                 |
| `NODE_ENV`                  | `development` or `production`            |
| `SUPABASE_URL`              | Your Supabase project URL                |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS)          |
| `JWT_SECRET`                | Secret for signing JWT tokens (≥32 chars)|
| `CORS_ORIGIN`               | Allowed frontend origin                  |

---

## Database Setup

1. Open your Supabase project → **SQL Editor**
2. Run the contents of `supabase-schema.sql`
3. Creates all tables, indexes, and the storage bucket

---

## API Reference

### Client (Public)

| Method  | Path                          | Description                          |
|---------|-------------------------------|--------------------------------------|
| GET     | `/api/p/:uniqueLinkId`        | Full DashboardResponse               |
| PATCH   | `/api/event-details/:eventId` | Update event details                 |
| POST    | `/api/rating`                 | Submit event rating                  |
| POST    | `/api/analytics`              | Track analytics event                |

### Auth

| Method | Path              | Description              |
|--------|-------------------|--------------------------|
| POST   | `/api/auth/login` | Login → returns JWT token|

### Admin (JWT required, role: `admin`)

| Method  | Path                    | Description                   |
|---------|-------------------------|-------------------------------|
| POST    | `/api/admin/client`     | Create client + unique link   |
| POST    | `/api/admin/event`      | Create event                  |
| DELETE  | `/api/admin/event/:id`  | Delete event                  |
| POST    | `/api/admin/assign-creator` | Assign creator to event   |
| POST    | `/api/admin/upload`     | Upload file (multipart/form-data) |
| DELETE  | `/api/admin/file/:id`   | Delete file                   |
| POST    | `/api/admin/payment`    | Add payment entry             |

### Creator (JWT required, role: `creator`)

| Method  | Path                    | Description                   |
|---------|-------------------------|-------------------------------|
| GET     | `/api/creator/events`   | Get assigned events           |
| POST    | `/api/creator/upload`   | Upload picture/raw only       |

---

## Upload Format

All upload endpoints accept `multipart/form-data`:

```
POST /api/admin/upload
Content-Type: multipart/form-data

file:       <binary>
clientId:   <uuid>
eventId:    <uuid>
fileType:   reel | picture | raw
```

---

## Storage Layout

```
recapreels/
  {clientId}/
    {eventId}/
      reels/
      pictures/
      raw/
```

---

## Data Contract

The `GET /api/p/:uniqueLinkId` endpoint returns **exactly**:

```ts
{
  client: { id, name, phone, tncAccepted },
  events: [{ id, name, date, status }],
  eventsFull: [{
    id, name, occasionType, date, status,
    poc: { name, phone },
    otp: { startOtp, endOtp },
    details: { description, musicPreferences, locationLink, clientPoc: { name, phone } },
    payments: { total, paid, due, history: [{ id, amount, method, status, createdAt }] },
    files: { reels, pictures, raw },   // each: [{ id, name, url, thumbnail, size, createdAt }]
    meta: { startTime, endTime, duration },
    rating: { value, comment }
  }]
}
```

---

## Architecture

```
Frontend (React)
      ↓  HTTP/JSON only
Backend (Express)
      ├── Controllers   — HTTP layer, request/response
      ├── Services      — Business logic + DB queries
      ├── Middlewares   — Auth, role guard
      └── Config        — Supabase client
             ↓
Supabase (PostgreSQL + Storage)
```

**Frontend never sees Supabase.** All DB field names (snake_case) are transformed to camelCase contract fields inside `dashboardService.js`.
