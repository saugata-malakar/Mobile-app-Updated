# Doctor Dashboard

Vite + React web dashboard for clinicians. Talks to the Flask API in `backend/legacy/`.

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **Backend** running on `http://127.0.0.1:8000`

## Quick start

**Terminal A — API**

```bash
cd backend/legacy
source venv/bin/activate
export DATABASE_URL="sqlite:///$(pwd)/instance/healthscreen_dev.db"
export FLASK_ENV=development
export PORT=8000
export PYTHONPATH=.
python app.py
```

**Terminal B — Dashboard**

```bash
cd doctor-dashboard
npm install
npm run dev
```

Open **http://localhost:5173/login**

**Demo credentials** (seeded on backend startup in development):

| Field | Value |
|-------|--------|
| Email | `doctor@demo.in` |
| Password | `doctor123` |

## Configuration

| Setting | Location | Notes |
|---------|----------|--------|
| Dev server port | `vite.config.js` → `server.port` | Default **5173** |
| API proxy | `vite.config.js` → `server.proxy['/api']` | Proxies to **`http://127.0.0.1:8000`** |
| Direct API URL (optional) | `.env.development` → `VITE_API_BASE_URL` | Leave empty to use Vite proxy |

## API endpoints used

| Method | Path |
|--------|------|
| POST | `/api/v1/auth/doctor/login` |
| POST | `/api/v1/auth/refresh` |
| GET | `/api/v1/doctors/me` |
| GET | `/api/v1/doctors/me/alerts` |
| GET | `/api/v1/doctors/me/patients` |
| GET | `/api/v1/doctors/me/stats` |
| GET | `/api/v1/doctors/me/teleconsults` |
| GET | `/api/v1/doctors/patients/:id` |
| GET | `/api/v1/doctors/patients/:id/wound-detail` |
| PUT | `/api/v1/doctors/alerts/:id/acknowledge` |
| PUT | `/api/v1/doctors/teleconsults/:id/schedule` |
| POST | `/api/v1/doctors/prescriptions` |
| GET | `/api/v1/doctors/department/dashboard` |

Auth: **JWT Bearer** token in `Authorization` header (stored in `localStorage` as `doctor_dashboard_token`).

## Smoke test (curl)

```bash
export API=http://127.0.0.1:8000
curl -s "$API/health" | python3 -m json.tool

LOGIN=$(curl -s -X POST "$API/api/v1/auth/doctor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"doctor@demo.in","password":"doctor123"}')
export TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

curl -s "$API/api/v1/doctors/me" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
curl -s "$API/api/v1/doctors/me/patients" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

## Manual testing checklist

### UI / UX

- [ ] Open http://localhost:5173 — login page loads without errors
- [ ] DevTools Console — no red errors on load
- [ ] Sign in → dashboard — header shows doctor name
- [ ] Nav: Teleconsults, Department — pages load
- [ ] Mobile viewport (~375px) — layout usable
- [ ] Sign out — returns to login, token cleared

### Authentication

- [ ] Wrong password — error message, stay on login
- [ ] Demo login — dashboard loads
- [ ] Local Storage — `doctor_dashboard_token` present
- [ ] Page refresh while logged in — stays on dashboard

### Patient & wound data

- [ ] Patient table loads (may be empty if no assignments/alerts in DB)
- [ ] Open patient — wound detail page loads
- [ ] Chart or “No submitted wound sessions” message
- [ ] Confidence % and Wagner grade when session data exists
- [ ] Wound site links update `?woundSiteId=` chart

> **Note:** Wound **photos** are not shown in the UI yet (charts/metrics only).

### Alerts

- [ ] RED/AMBER badges visible on dashboard
- [ ] Manage alert — form loads
- [ ] Acknowledge with note — success message
- [ ] Dashboard — resolved alert removed from open list

### API connectivity (DevTools → Network)

- [ ] `POST /api/v1/auth/doctor/login` → **200**
- [ ] `GET /api/v1/doctors/me/*` → **200**
- [ ] No CORS errors (proxy mode uses same origin on :5173)
- [ ] API errors show red panel, not blank screen

### Performance

- [ ] Login → dashboard &lt; 3s locally
- [ ] No 401 refresh loops in console

## Common issues

| Symptom | Fix |
|---------|-----|
| `ECONNREFUSED` on `/api/*` | Start Flask on port **8000** |
| Proxy still hits wrong port | Confirm `vite.config.js` proxy target is `http://127.0.0.1:8000` |
| `Invalid credentials` | Restart backend so demo doctor is seeded |
| Empty patient list | Add patients with open alerts or `DoctorPatientAssignment` for demo doctor |
| Port 5173 in use | `kill $(lsof -t -iTCP:5173 -sTCP:LISTEN)` then `npm run dev` |
| Stale auth | DevTools → Application → Clear site data, or `localStorage.clear()` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server on :5173 |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |

## Related

- Backend routes: `../backend/legacy/routes/doctors.py`
- Demo doctor seed: `../backend/legacy/migrations/seed_doctor_demo.py`
- Monorepo: https://github.com/dkg-diabetescare-ai/diabetescare-ai
