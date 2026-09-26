import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/layout/Layout'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'
import DashboardPage from '@/pages/DashboardPage'
import ClientsPage from '@/pages/ClientsPage'
import DevisPage from '@/pages/DevisPage'
import FacturesPage from '@/pages/FacturesPage'
import ParametresPage from '@/pages/ParametresPage'
import AbonnementPage from '@/pages/AbonnementPage'
import ClientDetailPage from '@/pages/ClientDetailPage'
import LandingPage from '@/pages/LandingPage'
import DevisSignaturePage from '@/pages/DevisSignaturePage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-700 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Chargement…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />}
      />
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/signup"
        element={user ? <Navigate to="/dashboard" replace /> : <SignupPage />}
      />
      <Route path="/devis/signature/:token" element={<DevisSignaturePage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard"   element={<DashboardPage />} />
        <Route path="/clients"     element={<ClientsPage />} />
        <Route path="/devis"       element={<DevisPage />} />
        <Route path="/factures"    element={<FacturesPage />} />
        <Route path="/parametres"  element={<ParametresPage />} />
        <Route path="/abonnement"  element={<AbonnementPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
