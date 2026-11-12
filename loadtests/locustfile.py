import os
from locust import HttpUser, between, task


class EmployeeUser(HttpUser):
    """Simulates regular employees checking profile, balances, and leave history."""

    weight = 3
    wait_time = between(1, 3)

    def on_start(self):
        email = os.getenv("LOCUST_EMP_EMAIL", "employee@nemilink.com")
        password = os.getenv("LOCUST_EMP_PASSWORD", "Welcome@123")
        res = self.client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
            name="/api/v1/auth/login",
        )
        if res.status_code == 200:
            data = res.json()
            self.token = data["access_token"]
            self.refresh_token = data["refresh_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            self.token = None
            self.refresh_token = None
            self.headers = {}

    @task(4)
    def view_profile(self):
        if self.token:
            self.client.get("/api/v1/me", headers=self.headers, name="/api/v1/me")

    @task(3)
    def view_leave_balances(self):
        if self.token:
            self.client.get(
                "/api/v1/leaves/balances",
                headers=self.headers,
                name="/api/v1/leaves/balances",
            )

    @task(3)
    def view_my_leaves(self):
        if self.token:
            self.client.get(
                "/api/v1/leaves/my",
                headers=self.headers,
                name="/api/v1/leaves/my",
            )

    @task(2)
    def list_departments(self):
        if self.token:
            self.client.get(
                "/api/v1/departments",
                headers=self.headers,
                name="/api/v1/departments",
            )

    @task(1)
    def health_db(self):
        self.client.get("/api/v1/health/db", name="/api/v1/health/db")


class HRUser(HttpUser):
    """Simulates HR/Managers browsing directory and pending leave approvals."""

    weight = 1
    wait_time = between(1, 4)

    def on_start(self):
        email = os.getenv("LOCUST_HR_EMAIL", "hr@nemilink.com")
        password = os.getenv("LOCUST_HR_PASSWORD", "Welcome@123")
        res = self.client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
            name="/api/v1/auth/login",
        )
        if res.status_code == 200:
            data = res.json()
            self.token = data["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            self.token = None
            self.headers = {}

    @task(3)
    def list_employees(self):
        if self.token:
            self.client.get(
                "/api/v1/employees",
                headers=self.headers,
                name="/api/v1/employees",
            )

    @task(2)
    def list_approvals(self):
        if self.token:
            self.client.get(
                "/api/v1/leaves/approvals?status=pending",
                headers=self.headers,
                name="/api/v1/leaves/approvals",
            )

    @task(1)
    def view_team(self):
        if self.token:
            self.client.get(
                "/api/v1/manager/team",
                headers=self.headers,
                name="/api/v1/manager/team",
            )

