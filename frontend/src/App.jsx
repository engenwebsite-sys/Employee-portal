import { lazy, Suspense } from "react";
import { MotionConfig } from "motion/react";
import { Navigate, Route, Routes } from "react-router-dom";
import PageLoader from "./components/PageLoader";
import ProtectedRoute from "./components/ProtectedRoute";

const Login = lazy(() => import("./pages/Login"));
const MicrosoftCallback = lazy(() => import("./pages/MicrosoftCallback"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Timesheets = lazy(() => import("./pages/Timesheets"));
const Leaves = lazy(() => import("./pages/Leaves"));
const Team = lazy(() => import("./pages/Team"));
const Employees = lazy(() => import("./pages/Employees"));
const Departments = lazy(() => import("./pages/Departments"));
const Forbidden = lazy(() => import("./pages/Forbidden"));
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/microsoft/callback" element={<MicrosoftCallback />} />

          {/* Any signed-in user */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/timesheets" element={<Timesheets />} />
            <Route path="/leaves" element={<Leaves />} />
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>

          {/* Manager & HR */}
          <Route element={<ProtectedRoute roles={["manager", "hr"]} />}>
            <Route path="/team" element={<Team />} />
          </Route>

          {/* HR only */}
          <Route element={<ProtectedRoute roles={["hr"]} />}>
            <Route path="/employees" element={<Employees />} />
            <Route path="/departments" element={<Departments />} />
          </Route>

          <Route path="/403" element={<Forbidden />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </MotionConfig>
  );
}
