# Doctor Web Dashboard

React (Vite) desktop dashboard for clinicians — wound alerts, patient review, teleconsults, prescriptions, and hospital B2B stats.

## Prerequisites

Flask API from `../backend` on port **5001**:

```bash
cd ../backend
source venv/bin/activate
export PORT=5001
PYTHONPATH=. python app.py
```

Demo doctor (seeded on startup):

- Email: `doctor@demo.in`
- Password: `doctor123`

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 — API calls proxy to `http://127.0.0.1:5001` via Vite.

## Screens

| ID | Route | Screen |
|----|-------|--------|
| D1 | `/login` | DoctorLogin |
| D2 | `/` | DoctorDashboard |
| D3 | `/patients/:id` | PatientWoundDetail (Recharts area trend) |
| D5 | `/alerts/:id` | AlertManagement |
| D6 | `/teleconsults` | TeleconsultScheduler |
| D7 | `/prescriptions/:patientId` | PrescriptionWriter |
| D9 | `/department` | DepartmentDashboard |

Colours follow CURSOR_MASTER_PROMPT Section 10 (navy `#1A3A5C`, etc.).
