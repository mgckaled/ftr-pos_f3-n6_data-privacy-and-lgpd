import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

type Role = 'admin' | 'doctor' | 'receptionist' | 'patient'

interface ProtectedRouteProps {
  roles: Role[]
  children: React.ReactNode
}

// LGPD: Art. 6º, VII — acesso a dados pessoais restrito por role (RBAC no frontend)
// Redirecionamentos por falta de permissão devem gerar log no backend (via API call)
export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) return null

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
