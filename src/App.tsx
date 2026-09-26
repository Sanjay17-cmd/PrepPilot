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
import { AdminAIUsagePage } from './pages/admin/AdminAIUsagePage'
import { NotFoundPage } from './pages/PageShells'
import { AssessmentPage } from './pages/assessment/AssessmentConfigPage'
import { AssessmentActivePage } from './pages/assessment/AssessmentActivePage'
import { AssessmentResultPage } from './pages/assessment/AssessmentResultPage'
import { RoadmapPage } from './pages/roadmap/RoadmapPage'
import { DailyPlanPage } from './pages/daily/DailyPlanPage'
import { ProgressPage } from './pages/progress/ProgressPage'
import { AICoachPage } from './pages/coach/AICoachPage'
import { ResumePage } from './pages/resume/ResumePage'
import { DSAPage } from './pages/dsa/DSAPage'

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
                Onboarding — protected but onboarding-completed not required
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
                Assessment active + result — standalone (no sidebar, fullscreen)
                Must be BEFORE the AppLayout routes so they don't inherit sidebar
            ---------------------------------------------------------------- */}
            <Route
              path="/assessment/active/:assessmentId/:attemptId"
              element={<ProtectedRoute><AssessmentActivePage /></ProtectedRoute>}
            />
            <Route
              path="/assessment/result/:attemptId"
              element={<ProtectedRoute><AssessmentResultPage /></ProtectedRoute>}
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
              <Route path="/dsa"        element={<DSAPage />} />
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
                <Route index               element={<AdminOverviewPage />} />
                <Route path="role-requests" element={<AdminRoleRequestsPage />} />
                <Route path="roles"         element={<AdminRolesPage />} />
                <Route path="ai-usage"      element={<AdminAIUsagePage />} />
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
