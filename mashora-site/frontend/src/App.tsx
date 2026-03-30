import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import CreateTenant from './pages/CreateTenant'
import Pricing from './pages/Pricing'
import Billing from './pages/Billing'
import Marketplace from './pages/Marketplace'
import AddonDetail from './pages/AddonDetail'
import PublisherDashboard from './pages/PublisherDashboard'
import Upgrades from './pages/Upgrades'
import Support from './pages/Support'
import Admin from './pages/Admin'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/addons" element={<Marketplace />} />
        <Route path="/addons/:technicalName" element={<AddonDetail />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/tenants/new"
          element={
            <ProtectedRoute>
              <CreateTenant />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/billing"
          element={
            <ProtectedRoute>
              <Billing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/publisher"
          element={
            <ProtectedRoute>
              <PublisherDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/upgrades"
          element={
            <ProtectedRoute>
              <Upgrades />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/support"
          element={
            <ProtectedRoute>
              <Support />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Layout>
  )
}
