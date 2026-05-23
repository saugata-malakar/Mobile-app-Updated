# HealthScreen Flask API (local dev)

Runs on **port 5001** and binds to **0.0.0.0** so the **Android emulator** can reach it via `http://10.0.2.2:5001`.

## Quick start

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

You should see: `Listening on http://0.0.0.0:5001`

Optional: `export JWT_SECRET='your-long-random-secret'` (defaults to an insecure dev value).

## Health check

```bash
curl -s http://127.0.0.1:5001/api/v1/health
```

## Register / login (JWT)

```bash
curl -s -X POST http://127.0.0.1:5001/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"phone_number":"9876543210","password":"1234","full_name":"Test","role":"patient"}'

curl -s -X POST http://127.0.0.1:5001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone_number":"9876543210","password":"1234"}'
```

Response shape matches the app: `{ "success": true, "data": { "token", "refresh_token", ... }, "error": null }`.

## SQLite

Development data is stored in `backend/dev.sqlite` (created automatically).

## Subscriptions & payments (Phase D1)

The minimal `backend/app.py` in this repo does **not** include subscription routes. For P28/P29 (tiers, Razorpay verify, session gate), run the full API from **HealthScreeningApp** on the same port:

```bash
cd ../HealthScreeningApp/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export RAZORPAY_MOCK=1
export PORT=5001
PYTHONPATH=. python app.py
```

Patient auth: `POST /api/v1/auth/patient/register`. Razorpay uses TEST keys in dev (`RAZORPAY_MOCK=1` accepts `mock_sig_ok` / `pay_success_test`).
