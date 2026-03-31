import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { Skeleton } from '@/components/ui/skeleton'

const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CreateTenant = lazy(() => import('./pages/CreateTenant'))
const Pricing = lazy(() => import('./pages/Pricing'))
const Billing = lazy(() => import('./pages/Billing'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
const AddonDetail = lazy(() => import('./pages/AddonDetail'))
const PublisherDashboard = lazy(() => import('./pages/PublisherDashboard'))
const Upgrades = lazy(() => import('./pages/Upgrades'))
const Support = lazy(() => import('./pages/Support'))
const Admin = lazy(() => import('./pages/Admin'))

function RouteFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
      <Skeleton className="h-[28rem] rounded-3xl" />
    </div>
  )
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
    </Layout>
  )
}
