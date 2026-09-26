import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import { ProtectedRoute, PublicRoute } from './components/routing/ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'
import { OnboardingLayout } from './pages/onboarding/OnboardingLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { CanvasPage } from './pages/canvas/CanvasPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import {
  AdminLayout, AdminOverviewPage, AdminRoleRequestsPage, AdminRolesPage,
} from './pages/admin/AdminPages'
import {
  AssessmentPage, RoadmapPage, DailyPlanPage, ProgressPage,
  AICoachPage, ResumePage, NotFoundPage,
} from './pages/PageShells'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* ----------------------------------------------------------------
                Public routes — redirect to dashboard if already logged in
            ---------------------------------------------------------------- */}
            <Route path="/login"  element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />

            {/* ----------------------------------------------------------------
                Onboarding — protected but not onboarding-completed required
            ---------------------------------------------------------------- */}
            <Route
              path="/onboarding/*"
              element={
                <ProtectedRoute>
                  <OnboardingLayout />
                </ProtectedRoute>
              }
            />

            {/* ----------------------------------------------------------------
                Student app — requires auth + onboarding completed
            ---------------------------------------------------------------- */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard"  element={<DashboardPage />} />
              <Route path="/assessment" element={<AssessmentPage />} />
              <Route path="/roadmap"    element={<RoadmapPage />} />
              <Route path="/daily"      element={<DailyPlanPage />} />
              <Route path="/progress"   element={<ProgressPage />} />
              <Route path="/canvas"     element={<CanvasPage />} />
              <Route path="/coach"      element={<AICoachPage />} />
              <Route path="/resume"     element={<ResumePage />} />
              <Route path="/settings"   element={<SettingsPage />} />
            </Route>

            {/* ----------------------------------------------------------------
                Admin — requires auth + admin user_type
            ---------------------------------------------------------------- */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route element={<AdminLayout />}>
                <Route index           element={<AdminOverviewPage />} />
                <Route path="role-requests" element={<AdminRoleRequestsPage />} />
                <Route path="roles"    element={<AdminRolesPage />} />
              </Route>
            </Route>

            {/* ----------------------------------------------------------------
                Root redirect + 404
            ---------------------------------------------------------------- */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
