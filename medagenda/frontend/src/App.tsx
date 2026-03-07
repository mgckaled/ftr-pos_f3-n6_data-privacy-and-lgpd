import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ConsentProvider } from '@/contexts/ConsentContext'
import { Login } from '@/pages/Login'

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      {label} — em desenvolvimento
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ConsentProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/admin"
              element={<Placeholder label="Dashboard Admin" />}
            />
            <Route
              path="/appointments"
              element={<Placeholder label="Agendamentos" />}
            />
            <Route
              path="/privacy"
              element={<Placeholder label="Painel do Titular" />}
            />
            <Route
              path="/unauthorized"
              element={<Placeholder label="Acesso negado" />}
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ConsentProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
