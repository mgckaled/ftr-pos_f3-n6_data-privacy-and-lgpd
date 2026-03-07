-- LGPD: Art. 5º, II — schema private exclusivo para dados sensíveis de saúde
CREATE SCHEMA IF NOT EXISTS private;

-- Habilitar pgcrypto para criptografia em repouso (utilizado na Fase 4)
-- LGPD: Art. 6º, VII — segurança — proteção de dados em repouso
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Configurar variáveis de sessão para RLS contextual
-- LGPD: Art. 6º, VII — segurança — controle de acesso granular por sessão
ALTER DATABASE medagenda SET app.current_role TO '';
ALTER DATABASE medagenda SET app.current_user_id TO '';
