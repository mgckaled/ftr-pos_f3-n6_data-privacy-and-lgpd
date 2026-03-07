import { SignJWT, jwtVerify } from 'jose'

// LGPD: Art. 6º, VII — segurança — token JWT com expiração de 1h, sem refresh tokens
// Expiração curta minimiza janela de exposição de dados pessoais em caso de vazamento

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export interface JWTPayload {
  sub: string
  role: string
}

export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}

export async function verifyJWT(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret)
  return {
    sub: payload.sub as string,
    role: payload['role'] as string,
  }
}
