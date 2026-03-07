import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api } from '@/lib/api'

type Role = 'admin' | 'doctor' | 'receptionist' | 'patient'

// LGPD: Art. 6º, VII — armazena apenas o mínimo necessário para controle de acesso
// JWT nunca fica em memória — vive exclusivamente no cookie httpOnly gerenciado pelo browser
interface AuthUser {
  userId: string
  role: Role
  name: string
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Inicializa sessão a partir do cookie existente
  useEffect(() => {
    api
      .get<AuthUser>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  async function login(email: string, password: string): Promise<AuthUser> {
    const res = await api.post<AuthUser>('/auth/login', { email, password })
    setUser(res.data)
    return res.data
  }

  async function logout(): Promise<void> {
    await api.post('/auth/logout')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
