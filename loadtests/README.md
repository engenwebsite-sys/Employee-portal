# Nemilink Load Testing (Locust)

## 1. Install Locust (inside `backend/.venv` or globally)
```powershell
pip install locust
```

## 2. Run with Web UI
Make sure the backend is running (ideally without `--reload` and with multiple workers, e.g. `uvicorn app.main:app --workers 4`):
```powershell
locust -f loadtests/locustfile.py --host http://127.0.0.1:8000
```
Open http://localhost:8089 and start with e.g. **50 users**, **spawn rate 10/s**.

## 3. Run Headless (CLI summary)
```powershell
locust -f loadtests/locustfile.py --host http://127.0.0.1:8000 --headless -u 50 -r 10 -t 30s
```

## Custom credentials (optional)
Set `LOCUST_EMP_EMAIL`, `LOCUST_EMP_PASSWORD`, `LOCUST_HR_EMAIL`, `LOCUST_HR_PASSWORD`.

