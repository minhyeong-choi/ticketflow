import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store'
import type { UserRole } from '@/features/auth/types'

interface ProtectedRouteProps {
  children: ReactNode
  role?: UserRole
}

export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (role && user?.role !== role) {
    return <Navigate to="/" replace />
  }

  return children
}
