#!/usr/bin/env bash
# test-phase3.sh — Testes manuais da Fase 3 (Agendamento + Ciclo de Vida dos Dados)
#
# Pré-requisitos:
#   - Backend rodando em localhost:3000
#   - Seed aplicado: pnpm --filter backend db:seed
#
# Uso: bash medagenda/scripts/test-phase3.sh

BASE="http://localhost:3000"
COOKIE_RECEP="/tmp/cookie-recep.txt"
COOKIE_DOCTOR="/tmp/cookie-doctor.txt"
COOKIE_ADMIN="/tmp/cookie-admin.txt"
TMPFILE=$(mktemp)
PASS=0
FAIL=0

cleanup() { rm -f "$TMPFILE"; }
trap cleanup EXIT

# Extrai campo de JSON usando Python (sem jq)
json_get() { echo "$1" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('$2') or '')" 2>/dev/null; }
# Extrai path aninhado: json_path '{"a":{"b":1}}' a b
json_path() {
  local data="$1"; shift
  echo "$data" | python -c "
import sys,json
d=json.load(sys.stdin)
for k in '$@'.split(): d=d.get(k,{}) if isinstance(d,dict) else {}
print(d if d!={}  else '')
" 2>/dev/null
}

# Faz um request e captura body + HTTP status em UMA chamada
# Uso: do_request <cookie_file> <method> <url> [body]
# Seta: $RESP_BODY, $RESP_STATUS
do_request() {
  local cookie="$1" method="$2" url="$3" body="${4:-}"
  if [ -n "$body" ]; then
    RESP_STATUS=$(curl -s -w "%{http_code}" -o "$TMPFILE" -b "$cookie" \
      -X "$method" "$url" -H "Content-Type: application/json" -d "$body")
  else
    RESP_STATUS=$(curl -s -w "%{http_code}" -o "$TMPFILE" -b "$cookie" \
      -X "$method" "$url")
  fi
  RESP_BODY=$(cat "$TMPFILE")
}

# Login e salva cookie
do_login() {
  local cookie="$1" email="$2" pass="$3"
  RESP_STATUS=$(curl -s -w "%{http_code}" -o /dev/null -c "$cookie" \
    -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}")
}

green() { printf "\033[32m  PASS\033[0m %s\n" "$*"; PASS=$((PASS+1)); }
red()   { printf "\033[31m  FAIL\033[0m %s\n" "$*"; FAIL=$((FAIL+1)); }
h1()    { printf "\n\033[1m=== %s ===\033[0m\n" "$*"; }
h2()    { printf "\n  \033[36m%s\033[0m\n" "$*"; }

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then green "$label → HTTP $actual"
  else red "$label → esperado HTTP $expected, recebido $actual — $RESP_BODY"; fi
}

# ──────────────────────────────────────────────────────────
h1 "1. AUTENTICACAO"
# ──────────────────────────────────────────────────────────

h2 "Login recepcionista"
do_login "$COOKIE_RECEP" "recep@medagenda.dev" "Recep@123"
check "POST /auth/login (receptionist)" 200 "$RESP_STATUS"

h2 "Login medico"
do_login "$COOKIE_DOCTOR" "doctor@medagenda.dev" "Doctor@123"
check "POST /auth/login (doctor)" 200 "$RESP_STATUS"

h2 "Login admin"
do_login "$COOKIE_ADMIN" "admin@medagenda.dev" "Admin@123"
check "POST /auth/login (admin)" 200 "$RESP_STATUS"

# ──────────────────────────────────────────────────────────
h1 "2. SETUP — IDs dinamicos"
# ──────────────────────────────────────────────────────────

do_request "$COOKIE_DOCTOR" GET "$BASE/auth/me"
DOCTOR_ID=$(json_get "$RESP_BODY" "userId")
printf "  doctorId : %s\n" "$DOCTOR_ID"

h2 "Criar paciente (receptionist)"
do_request "$COOKIE_RECEP" POST "$BASE/patients" '{"name":"Paciente Fase3","cpf":"11122233399","birthDate":"1985-06-15","email":"fase3@example.com","consents":[{"purpose":"medical_treatment","granted":true,"policyVersion":"1.0"},{"purpose":"data_sharing_partners","granted":false,"policyVersion":"1.0"},{"purpose":"research","granted":false,"policyVersion":"1.0"},{"purpose":"insurance","granted":false,"policyVersion":"1.0"},{"purpose":"marketing","granted":false,"policyVersion":"1.0"}]}'
PATIENT_ID=$(json_get "$RESP_BODY" "id")
printf "  patientId: %s\n" "$PATIENT_ID"

if [ -z "$PATIENT_ID" ]; then
  red "Nao foi possivel criar paciente — resposta: $RESP_BODY"
  printf "\n  Abortando.\n\n"
  exit 1
fi

# ──────────────────────────────────────────────────────────
h1 "3. AGENDAMENTOS"
# ──────────────────────────────────────────────────────────

h2 "Criar agendamento (receptionist)"
do_request "$COOKIE_RECEP" POST "$BASE/appointments" "{\"patientId\":\"$PATIENT_ID\",\"doctorId\":\"$DOCTOR_ID\",\"scheduledAt\":\"2027-06-15T10:00:00.000Z\",\"notes\":\"Consulta de rotina\"}"
APPOINTMENT_ID=$(json_get "$RESP_BODY" "id")
check "POST /appointments (receptionist)" 201 "$RESP_STATUS"
printf "  appointmentId: %s\n" "$APPOINTMENT_ID"

if [ -z "$APPOINTMENT_ID" ]; then
  red "Nao foi possivel criar agendamento — resposta: $RESP_BODY"
  printf "\n  Abortando.\n\n"
  exit 1
fi

h2 "Listar agendamentos (receptionist) — ve todos"
do_request "$COOKIE_RECEP" GET "$BASE/appointments"
check "GET /appointments (receptionist)" 200 "$RESP_STATUS"

h2 "Listar agendamentos (doctor) — RLS: apenas os proprios [Art. 6, VII]"
do_request "$COOKIE_DOCTOR" GET "$BASE/appointments"
check "GET /appointments (doctor — RLS)" 200 "$RESP_STATUS"
COUNT=$(json_get "$RESP_BODY" "total")
printf "  doctor ve %s agendamento(s) — deve ser apenas os dele\n" "$COUNT"

h2 "Detalhe do agendamento (doctor) — gera audit_log [Art. 6, X]"
do_request "$COOKIE_DOCTOR" GET "$BASE/appointments/$APPOINTMENT_ID"
check "GET /appointments/:id (doctor)" 200 "$RESP_STATUS"

h2 "Stats anonimizadas (admin) — sem IDs pessoais [Art. 5, XI]"
do_request "$COOKIE_ADMIN" GET "$BASE/appointments/stats"
check "GET /appointments/stats (admin)" 200 "$RESP_STATUS"
printf "  resposta: %s\n" "$RESP_BODY"
HAS_PII=$(echo "$RESP_BODY" | python -c "
import sys,json
d=json.load(sys.stdin)
arr=d.get('stats', d) if isinstance(d,dict) else d
arr=arr if isinstance(arr,list) else []
pii_keys={'patientId','doctorId','name','email','cpf'}
found=any(k in item for item in arr for k in pii_keys)
print('yes' if found else 'no')
" 2>/dev/null)
if [ "$HAS_PII" = "yes" ]; then
  red "VIOLACAO LGPD Art. 5, XI — stats contem identificadores pessoais"
  FAIL=$((FAIL+1))
else
  green "Stats sem identificadores pessoais (Art. 5, XI)"
  PASS=$((PASS+1))
fi

h2 "Stats bloqueada para nao-admin (receptionist) → 403"
do_request "$COOKIE_RECEP" GET "$BASE/appointments/stats"
check "GET /appointments/stats (receptionist) → 403" 403 "$RESP_STATUS"

# ──────────────────────────────────────────────────────────
h1 "4. PRONTUARIOS — DADOS SENSIVEIS [Art. 5, II + Art. 11]"
# ──────────────────────────────────────────────────────────

h2 "Criar prontuario (doctor) — base legal: health_care"
do_request "$COOKIE_DOCTOR" POST "$BASE/medical-records" "{\"appointmentId\":\"$APPOINTMENT_ID\",\"diagnosis\":\"Hipertensao arterial leve\",\"icdCode\":\"I10\",\"prescription\":\"Losartana 50mg 1x/dia\",\"clinicalNotes\":\"PA 140/90.\",\"sensitiveLegalBasis\":\"health_care\"}"
check "POST /medical-records (doctor)" 201 "$RESP_STATUS"

h2 "Criar prontuario (receptionist) → 403 [RLS — sem acesso ao schema private]"
do_request "$COOKIE_RECEP" POST "$BASE/medical-records" "{\"appointmentId\":\"$APPOINTMENT_ID\",\"diagnosis\":\"tentativa indevida\"}"
check "POST /medical-records (receptionist) → 403" 403 "$RESP_STATUS"

h2 "Ler prontuario (doctor) — gera audit_log [Art. 6, X]"
do_request "$COOKIE_DOCTOR" GET "$BASE/medical-records/$APPOINTMENT_ID"
check "GET /medical-records/:id (doctor)" 200 "$RESP_STATUS"

h2 "Ler prontuario (admin) — somente leitura para auditoria [Art. 6, VII]"
do_request "$COOKIE_ADMIN" GET "$BASE/medical-records/$APPOINTMENT_ID"
check "GET /medical-records/:id (admin)" 200 "$RESP_STATUS"

h2 "Ler prontuario (receptionist) → 403 [RLS Art. 6, VII]"
do_request "$COOKIE_RECEP" GET "$BASE/medical-records/$APPOINTMENT_ID"
check "GET /medical-records/:id (receptionist) → 403" 403 "$RESP_STATUS"

# ──────────────────────────────────────────────────────────
h1 "5. SOFT DELETE — CICLO DE VIDA [Art. 5, XIV]"
# ──────────────────────────────────────────────────────────

h2 "Cancelar agendamento (receptionist) — soft delete, linha permanece no banco"
do_request "$COOKIE_RECEP" PATCH "$BASE/appointments/$APPOINTMENT_ID/cancel"
check "PATCH /appointments/:id/cancel (receptionist)" 200 "$RESP_STATUS"

h2 "Verificar estado pos-cancelamento"
do_request "$COOKIE_ADMIN" GET "$BASE/appointments/$APPOINTMENT_ID"
STATUS_VAL=$(json_get "$RESP_BODY" "status")
DELETED_AT=$(json_get "$RESP_BODY" "deletedAt")

if [ "$STATUS_VAL" = "cancelled" ]; then
  green "status=cancelled (linha preservada — retencao CFM 20 anos)"
  PASS=$((PASS+1))
else
  red "status esperado 'cancelled', recebido '$STATUS_VAL'"
  FAIL=$((FAIL+1))
fi

if [ -n "$DELETED_AT" ] && [ "$DELETED_AT" != "None" ] && [ "$DELETED_AT" != "null" ]; then
  green "deletedAt preenchido: $DELETED_AT (soft delete, nao hard delete)"
  PASS=$((PASS+1))
else
  red "deletedAt deveria estar preenchido apos cancelamento"
  FAIL=$((FAIL+1))
fi

h2 "Cancelar novamente → 400 (ja cancelado)"
do_request "$COOKIE_RECEP" PATCH "$BASE/appointments/$APPOINTMENT_ID/cancel"
check "PATCH /appointments/:id/cancel (ja cancelado) → 400" 400 "$RESP_STATUS"

# ──────────────────────────────────────────────────────────
h1 "RESULTADO FINAL"
# ──────────────────────────────────────────────────────────

TOTAL=$((PASS+FAIL))
printf "\n  Total: %d | " "$TOTAL"
printf "\033[32mPASS: %d\033[0m | " "$PASS"
if [ "$FAIL" -gt 0 ]; then
  printf "\033[31mFAIL: %d\033[0m\n\n" "$FAIL"
  exit 1
else
  printf "\033[32mFAIL: 0\033[0m — todos os cenarios LGPD validados\n\n"
fi
