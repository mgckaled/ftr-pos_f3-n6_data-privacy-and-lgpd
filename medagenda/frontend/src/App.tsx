import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ConsentProvider } from '@/contexts/ConsentContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Login } from '@/pages/Login'
import { NewPatient } from '@/pages/patients/NewPatient'
import { PatientDetail } from '@/pages/patients/PatientDetail'
import { AppointmentList } from '@/pages/appointments/AppointmentList'
import { NewAppointment } from '@/pages/appointments/NewAppointment'
import { AppointmentDetail } from '@/pages/appointments/AppointmentDetail'
// LGPD: Art. 18 — painel do titular e dashboard DPO
import { Privacy } from '@/pages/privacy/Privacy'
import { Admin } from '@/pages/admin/Admin'

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

            {/* LGPD: Art. 8º — cadastro com consentimento por finalidade */}
            <Route
              path="/patients/new"
              element={
                <ProtectedRoute roles={['admin', 'receptionist']}>
                  <NewPatient />
                </ProtectedRoute>
              }
            />

            {/* LGPD: Art. 6º, X — cada acesso registra audit_log */}
            <Route
              path="/patients/:id"
              element={
                <ProtectedRoute roles={['admin', 'doctor', 'receptionist']}>
                  <PatientDetail />
                </ProtectedRoute>
              }
            />

            {/* LGPD: Art. 6º, I — finalidade de atenção à saúde */}
            <Route
              path="/appointments"
              element={
                <ProtectedRoute roles={['admin', 'doctor', 'receptionist']}>
                  <AppointmentList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments/new"
              element={
                <ProtectedRoute roles={['admin', 'receptionist']}>
                  <NewAppointment />
                </ProtectedRoute>
              }
            />
            {/* LGPD: Art. 6º, X — acesso a dado pessoal e sensível auditado */}
            <Route
              path="/appointments/:id"
              element={
                <ProtectedRoute roles={['admin', 'doctor', 'receptionist']}>
                  <AppointmentDetail />
                </ProtectedRoute>
              }
            />

            {/* LGPD: Art. 18 — dashboard DPO: fila data_requests, incidents, audit_logs, ROPA */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['admin']}>
                  <Admin />
                </ProtectedRoute>
              }
            />
            {/* LGPD: Art. 18 — painel do titular: visualizar, corrigir, exportar, revogar */}
            <Route
              path="/privacy"
              element={
                <ProtectedRoute roles={['patient']}>
                  <Privacy />
                </ProtectedRoute>
              }
            />

            <Route path="/unauthorized" element={<Placeholder label="Acesso negado" />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ConsentProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
