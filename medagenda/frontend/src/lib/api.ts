import axios from 'axios'

// LGPD: Art. 6º, VII — toda comunicação com o backend passa por instância centralizada
// withCredentials: true garante envio automático do cookie httpOnly em toda requisição
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  withCredentials: true,
})
