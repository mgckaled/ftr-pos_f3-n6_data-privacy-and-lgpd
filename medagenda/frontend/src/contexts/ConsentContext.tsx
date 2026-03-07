import { createContext, useContext, useState, type ReactNode } from 'react'

// LGPD: Art. 8º — consentimento específico por finalidade (implementado na Fase 2)
// Esqueleto para controle do fluxo de consentimento em andamento

type ConsentPurpose =
  | 'medical_treatment'
  | 'data_sharing_partners'
  | 'research'
  | 'insurance'
  | 'marketing'

interface ConsentState {
  consents: Partial<Record<ConsentPurpose, boolean>>
  setConsent: (purpose: ConsentPurpose, granted: boolean) => void
  reset: () => void
}

const ConsentContext = createContext<ConsentState | null>(null)

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consents, setConsents] = useState<
    Partial<Record<ConsentPurpose, boolean>>
  >({})

  function setConsent(purpose: ConsentPurpose, granted: boolean) {
    setConsents((prev) => ({ ...prev, [purpose]: granted }))
  }

  function reset() {
    setConsents({})
  }

  return (
    <ConsentContext.Provider value={{ consents, setConsent, reset }}>
      {children}
    </ConsentContext.Provider>
  )
}

export function useConsent(): ConsentState {
  const ctx = useContext(ConsentContext)
  if (!ctx)
    throw new Error('useConsent deve ser usado dentro de <ConsentProvider>')
  return ctx
}
