import { z } from 'zod'

export const loginBodySchema = z.object({
  email: z.string().email(),
  // LGPD: Art. 6º, VII — senha mínima de 8 chars reduz risco de comprometimento de conta
  password: z.string().min(8),
})

export const meResponseSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'doctor', 'receptionist', 'patient']),
  name: z.string(),
})

export type LoginBody = z.infer<typeof loginBodySchema>
export type MeResponse = z.infer<typeof meResponseSchema>
