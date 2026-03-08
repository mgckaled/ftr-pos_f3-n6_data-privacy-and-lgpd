#!/usr/bin/env bash
# test-phase4.sh — Testes manuais da Fase 4 (Segurança avançada e incidentes)
#
# Cenários cobertos:
#   - Criptografia em repouso via pgcrypto (CPF e prontuário)
#   - Módulo incidents: CRUD + alerta de prazo 72h (Resolução CD/ANPD nº 15/2024)
#   - Endpoint DPIA (Art. 38 LGPD)
#   - RBAC: nenhum role além de admin acessa /incidents ou /dpia
#
# Pré-requisitos:
#   - Backend rodando em localhost:3000
#   - Migration aplicada: pnpm --filter backend db:migrate
#   - Seed aplicado:      pnpm --filter backend db:seed
#   - Dados migrados:     pnpm --filter backend db:encrypt-existing
#
# Uso: bash medagenda/scripts/test-phase4.sh

BASE="http://localhost:3000"
COOKIE_ADMIN="/tmp/cookie-admin.txt"
COOKIE_DOCTOR="/tmp/cookie-doctor.txt"
COOKIE_RECEP="/tmp/cookie-recep.txt"
TMPFILE=$(mktemp)
PASS=0
FAIL=0

cleanup() { rm -f "$TMPFILE"; }
trap cleanup EXIT

# ── Helpers ────────────────────────────────────────────────────────────────────

json_get() {
  echo "$1" | python -c "
import sys,json
d=json.load(sys.stdin)
print(d.get('$2') if d.get('$2') is not None else '')
" 2>/dev/null
}

json_path() {
  local data="$1"; shift
  echo "$data" | python -c "
import sys,json
d=json.load(sys.stdin)
for k in '$*'.split():
  d=d.get(k,{}) if isinstance(d,dict) else {}
print(d if d!={} else '')
" 2>/dev/null
}

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

check_field() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then green "$label = '$actual'"
  else red "$label — esperado '$expected', recebido '$actual'"; fi
}

# Timestamps relativos ao momento de execução (usa Python para portabilidade Linux/macOS)
OVERDUE_AT=$(python -c "from datetime import datetime,timedelta,timezone; \
  print((datetime.now(timezone.utc)-timedelta(hours=73)).strftime('%Y-%m-%dT%H:%M:%SZ'))")
URGENT_AT=$(python -c "from datetime import datetime,timedelta,timezone; \
  print((datetime.now(timezone.utc)-timedelta(hours=65)).strftime('%Y-%m-%dT%H:%M:%SZ'))")
PENDING_AT=$(python -c "from datetime import datetime,timedelta,timezone; \
  print((datetime.now(timezone.utc)-timedelta(hours=10)).strftime('%Y-%m-%dT%H:%M:%SZ'))")

# ──────────────────────────────────────────────────────────────────────────────
h1 "1. AUTENTICACAO"
# ──────────────────────────────────────────────────────────────────────────────

h2 "Login admin"
do_login "$COOKIE_ADMIN" "admin@medagenda.dev" "Admin@123"
check "POST /auth/login (admin)" 200 "$RESP_STATUS"

h2 "Login medico"
do_login "$COOKIE_DOCTOR" "doctor@medagenda.dev" "Doctor@123"
check "POST /auth/login (doctor)" 200 "$RESP_STATUS"

h2 "Login recepcionista"
do_login "$COOKIE_RECEP" "recep@medagenda.dev" "Recep@123"
check "POST /auth/login (receptionist)" 200 "$RESP_STATUS"

# ──────────────────────────────────────────────────────────────────────────────
h1 "2. SETUP — IDs dinamicos"
# ──────────────────────────────────────────────────────────────────────────────

do_request "$COOKIE_DOCTOR" GET "$BASE/auth/me"
DOCTOR_ID=$(json_get "$RESP_BODY" "userId")
printf "  doctorId : %s\n" "$DOCTOR_ID"

h2 "Criar paciente com CPF (receptionist)"
do_request "$COOKIE_RECEP" POST "$BASE/patients" \
  '{"name":"Paciente Fase4","cpf":"99988877766","birthDate":"1990-03-10",
    "email":"fase4@example.com",
    "consents":[
      {"purpose":"medical_treatment","granted":true,"policyVersion":"1.0"},
      {"purpose":"data_sharing_partners","granted":false,"policyVersion":"1.0"},
      {"purpose":"research","granted":false,"policyVersion":"1.0"},
      {"purpose":"insurance","granted":false,"policyVersion":"1.0"},
      {"purpose":"marketing","granted":false,"policyVersion":"1.0"}
    ]}'
check "POST /patients (receptionist)" 201 "$RESP_STATUS"
PATIENT_ID=$(json_get "$RESP_BODY" "id")
printf "  patientId: %s\n" "$PATIENT_ID"

if [ -z "$PATIENT_ID" ]; then
  red "Nao foi possivel criar paciente — abortando"
  exit 1
fi

h2 "Criar agendamento (receptionist)"
do_request "$COOKIE_RECEP" POST "$BASE/appointments" \
  "{\"patientId\":\"$PATIENT_ID\",\"doctorId\":\"$DOCTOR_ID\",
    \"scheduledAt\":\"2027-08-20T14:00:00.000Z\",\"notes\":\"Consulta Fase 4\"}"
check "POST /appointments (receptionist)" 201 "$RESP_STATUS"
APPOINTMENT_ID=$(json_get "$RESP_BODY" "id")
printf "  appointmentId: %s\n" "$APPOINTMENT_ID"

if [ -z "$APPOINTMENT_ID" ]; then
  red "Nao foi possivel criar agendamento — abortando"
  exit 1
fi

DIAGNOSIS_TEXT="Diabetes mellitus tipo 2"
PRESCRIPTION_TEXT="Metformina 850mg 2x/dia"

h2 "Criar prontuario com campos sensiveis (doctor)"
do_request "$COOKIE_DOCTOR" POST "$BASE/medical-records" \
  "{\"appointmentId\":\"$APPOINTMENT_ID\",
    \"diagnosis\":\"$DIAGNOSIS_TEXT\",
    \"prescription\":\"$PRESCRIPTION_TEXT\",
    \"clinicalNotes\":\"Hemoglobina glicada 8.2%.\",
    \"icdCode\":\"E11\",
    \"sensitiveLegalBasis\":\"health_care\"}"
check "POST /medical-records (doctor)" 201 "$RESP_STATUS"

# ──────────────────────────────────────────────────────────────────────────────
h1 "3. CRIPTOGRAFIA EM REPOUSO [Art. 6, VII + Art. 46]"
# ──────────────────────────────────────────────────────────────────────────────
# Valida que: (a) CPF nunca aparece nas respostas de API; (b) campos sensiveis
# do prontuario sao retornados descriptografados (texto legivel, nao base64).

h2 "GET /patients/:id — CPF nao deve aparecer na resposta [Art. 6, III]"
do_request "$COOKIE_RECEP" GET "$BASE/patients/$PATIENT_ID"
check "GET /patients/:id (receptionist)" 200 "$RESP_STATUS"
HAS_CPF=$(echo "$RESP_BODY" | python -c "
import sys,json
d=json.load(sys.stdin)
print('yes' if 'cpf' in d else 'no')
" 2>/dev/null)
if [ "$HAS_CPF" = "yes" ]; then
  red "VIOLACAO LGPD Art. 6, III — CPF exposto na resposta de GET /patients/:id"
else
  green "CPF ausente da resposta — principio da necessidade (Art. 6, III)"
fi

h2 "GET /patients — CPF nao deve aparecer em nenhum item da lista [Art. 6, III]"
do_request "$COOKIE_RECEP" GET "$BASE/patients"
check "GET /patients (receptionist)" 200 "$RESP_STATUS"
HAS_CPF_LIST=$(echo "$RESP_BODY" | python -c "
import sys,json
body=json.load(sys.stdin)
items=body if isinstance(body,list) else body.get('patients', body.get('data', []))
print('yes' if any('cpf' in p for p in items) else 'no')
" 2>/dev/null)
if [ "$HAS_CPF_LIST" = "yes" ]; then
  red "VIOLACAO LGPD Art. 6, III — CPF exposto em GET /patients"
else
  green "CPF ausente de toda listagem de pacientes (Art. 6, III)"
fi

h2 "GET /medical-records — campos descriptografados corretamente [Art. 6, VII]"
do_request "$COOKIE_DOCTOR" GET "$BASE/medical-records/$APPOINTMENT_ID"
check "GET /medical-records/:appointmentId (doctor)" 200 "$RESP_STATUS"

DIAG_RETURNED=$(json_get "$RESP_BODY" "diagnosis")
PRESC_RETURNED=$(json_get "$RESP_BODY" "prescription")

check_field "diagnosis descriptografado" "$DIAGNOSIS_TEXT" "$DIAG_RETURNED"
check_field "prescription descriptografada" "$PRESCRIPTION_TEXT" "$PRESC_RETURNED"

# Verifica que nao e base64 (texto puro nao comeca com 'hQ')
IS_ENCRYPTED=$(echo "$DIAG_RETURNED" | python -c "
import sys
val=sys.stdin.read().strip()
print('yes' if val.startswith('hQ') else 'no')
" 2>/dev/null)
if [ "$IS_ENCRYPTED" = "yes" ]; then
  red "FALHA DE CRIPTOGRAFIA — diagnosis retornado ainda em base64 (nao descriptografou)"
else
  green "diagnosis retornado em texto claro (pgp_sym_decrypt funcionou)"
fi

# ──────────────────────────────────────────────────────────────────────────────
h1 "4. INCIDENTES [Art. 48 + Resolucao CD/ANPD n 15/2024]"
# ──────────────────────────────────────────────────────────────────────────────

# ── 4a. Criacao ────────────────────────────────────────────────────────────────

h2 "POST /incidents — overdue (detectedAt 73h atras) → anpdAlertStatus: overdue"
do_request "$COOKIE_ADMIN" POST "$BASE/incidents" \
  "{\"title\":\"Vazamento de logs de acesso\",
    \"description\":\"Logs do servidor expostos por erro de configuracao nginx.\",
    \"severity\":\"high\",
    \"detectedAt\":\"$OVERDUE_AT\",
    \"affectedCount\":120,
    \"affectedResources\":[\"audit_logs\",\"users\"],
    \"containmentMeasures\":\"Acesso bloqueado e regras de firewall atualizadas.\"}"
check "POST /incidents (admin — overdue)" 201 "$RESP_STATUS"
INCIDENT_OVERDUE_ID=$(json_get "$RESP_BODY" "id")
ALERT_OVERDUE=$(json_get "$RESP_BODY" "anpdAlertStatus")
check_field "anpdAlertStatus (overdue)" "overdue" "$ALERT_OVERDUE"
printf "  incidentId (overdue): %s\n" "$INCIDENT_OVERDUE_ID"

h2 "POST /incidents — urgent (detectedAt 65h atras) → anpdAlertStatus: urgent"
do_request "$COOKIE_ADMIN" POST "$BASE/incidents" \
  "{\"title\":\"Acesso indevido a prontuarios\",
    \"severity\":\"critical\",
    \"detectedAt\":\"$URGENT_AT\",
    \"affectedCount\":3,
    \"affectedResources\":[\"medical_records\"]}"
check "POST /incidents (admin — urgent)" 201 "$RESP_STATUS"
INCIDENT_URGENT_ID=$(json_get "$RESP_BODY" "id")
ALERT_URGENT=$(json_get "$RESP_BODY" "anpdAlertStatus")
check_field "anpdAlertStatus (urgent)" "urgent" "$ALERT_URGENT"

h2 "POST /incidents — pending (detectedAt 10h atras) → anpdAlertStatus: pending"
do_request "$COOKIE_ADMIN" POST "$BASE/incidents" \
  "{\"title\":\"Tentativa de brute-force no login\",
    \"severity\":\"medium\",
    \"detectedAt\":\"$PENDING_AT\"}"
check "POST /incidents (admin — pending)" 201 "$RESP_STATUS"
ALERT_PENDING=$(json_get "$RESP_BODY" "anpdAlertStatus")
check_field "anpdAlertStatus (pending)" "pending" "$ALERT_PENDING"

# ── 4b. Listagem ───────────────────────────────────────────────────────────────

h2 "GET /incidents — lista com urgentCount [dashboard DPO]"
do_request "$COOKIE_ADMIN" GET "$BASE/incidents"
check "GET /incidents (admin)" 200 "$RESP_STATUS"
URGENT_COUNT=$(json_get "$RESP_BODY" "urgentCount")
TOTAL_COUNT=$(json_get "$RESP_BODY" "total")
printf "  total=%s | urgentCount=%s (deve ser >= 2: overdue + urgent)\n" \
  "$TOTAL_COUNT" "$URGENT_COUNT"
URGENT_OK=$(python -c "print('yes' if int('${URGENT_COUNT:-0}') >= 2 else 'no')" 2>/dev/null)
if [ "$URGENT_OK" = "yes" ]; then
  green "urgentCount >= 2 (overdue + urgent contabilizados)"
else
  red "urgentCount esperado >= 2, recebido $URGENT_COUNT"
fi

# ── 4c. Detalhe ────────────────────────────────────────────────────────────────

h2 "GET /incidents/:id — detalhe do incidente overdue"
do_request "$COOKIE_ADMIN" GET "$BASE/incidents/$INCIDENT_OVERDUE_ID"
check "GET /incidents/:id (admin)" 200 "$RESP_STATUS"
DETAIL_ALERT=$(json_get "$RESP_BODY" "anpdAlertStatus")
REMAINING_H=$(json_get "$RESP_BODY" "anpdDeadlineRemainingHours")
check_field "anpdAlertStatus no detalhe" "overdue" "$DETAIL_ALERT"
printf "  anpdDeadlineRemainingHours: %s (deve ser negativo — prazo vencido)\n" "$REMAINING_H"
IS_NEGATIVE=$(python -c "print('yes' if float('${REMAINING_H:-0}') < 0 else 'no')" 2>/dev/null)
if [ "$IS_NEGATIVE" = "yes" ]; then
  green "anpdDeadlineRemainingHours negativo — prazo de 72h confirmado como vencido"
else
  red "anpdDeadlineRemainingHours deveria ser negativo para incidente overdue"
fi

# ── 4d. Notificacao ANPD ───────────────────────────────────────────────────────

h2 "PATCH /incidents/:id/notify-anpd — registra notificacao à ANPD"
do_request "$COOKIE_ADMIN" PATCH "$BASE/incidents/$INCIDENT_OVERDUE_ID/notify-anpd"
check "PATCH /incidents/:id/notify-anpd (admin)" 200 "$RESP_STATUS"
NOTIFIED_ALERT=$(json_get "$RESP_BODY" "anpdAlertStatus")
NOTIFIED_STATUS=$(json_get "$RESP_BODY" "status")
NOTIFIED_AT=$(json_get "$RESP_BODY" "notifiedAnpdAt")
check_field "anpdAlertStatus apos notificacao" "compliant" "$NOTIFIED_ALERT"
check_field "status apos notificacao" "notified" "$NOTIFIED_STATUS"
if [ -n "$NOTIFIED_AT" ] && [ "$NOTIFIED_AT" != "None" ] && [ "$NOTIFIED_AT" != "null" ]; then
  green "notifiedAnpdAt preenchido: $NOTIFIED_AT (prova do cumprimento do prazo)"
else
  red "notifiedAnpdAt nao foi preenchido apos PATCH notify-anpd"
fi

h2 "PATCH /incidents/:id/notify-anpd — idempotente (ja notificado)"
do_request "$COOKIE_ADMIN" PATCH "$BASE/incidents/$INCIDENT_OVERDUE_ID/notify-anpd"
check "PATCH /incidents/:id/notify-anpd (idempotente) → 200" 200 "$RESP_STATUS"
IDEMPOTENT_ALERT=$(json_get "$RESP_BODY" "anpdAlertStatus")
check_field "anpdAlertStatus permanece compliant" "compliant" "$IDEMPOTENT_ALERT"

# ── 4e. RBAC — nao-admin bloqueado ────────────────────────────────────────────

h2 "POST /incidents (doctor) → 403 [apenas admin acessa incidents]"
do_request "$COOKIE_DOCTOR" POST "$BASE/incidents" \
  "{\"title\":\"Tentativa indevida\",\"severity\":\"low\",\"detectedAt\":\"$PENDING_AT\"}"
check "POST /incidents (doctor) → 403" 403 "$RESP_STATUS"

h2 "GET /incidents (receptionist) → 403"
do_request "$COOKIE_RECEP" GET "$BASE/incidents"
check "GET /incidents (receptionist) → 403" 403 "$RESP_STATUS"

h2 "GET /incidents/:id (doctor) → 403"
do_request "$COOKIE_DOCTOR" GET "$BASE/incidents/$INCIDENT_OVERDUE_ID"
check "GET /incidents/:id (doctor) → 403" 403 "$RESP_STATUS"

h2 "PATCH /incidents/:id/notify-anpd (receptionist) → 403"
do_request "$COOKIE_RECEP" PATCH "$BASE/incidents/$INCIDENT_OVERDUE_ID/notify-anpd"
check "PATCH /incidents/:id/notify-anpd (receptionist) → 403" 403 "$RESP_STATUS"

h2 "GET /incidents (nao autenticado) → 401"
RESP_STATUS=$(curl -s -w "%{http_code}" -o /dev/null -X GET "$BASE/incidents")
check "GET /incidents (sem cookie) → 401" 401 "$RESP_STATUS"

# ──────────────────────────────────────────────────────────────────────────────
h1 "5. DPIA [Art. 38 LGPD]"
# ──────────────────────────────────────────────────────────────────────────────

h2 "GET /dpia (admin) — documento estruturado"
do_request "$COOKIE_ADMIN" GET "$BASE/dpia"
check "GET /dpia (admin)" 200 "$RESP_STATUS"

DOC_TITLE=$(json_get "$RESP_BODY" "documentTitle")
GENERATED_AT=$(json_get "$RESP_BODY" "generatedAt")
ACTIVITIES=$(echo "$RESP_BODY" | python -c "
import sys,json
d=json.load(sys.stdin)
print(len(d.get('processingActivities', [])))
" 2>/dev/null)
NEXT_REVIEW=$(json_get "$RESP_BODY" "nextReviewAt")

if [ -n "$DOC_TITLE" ]; then
  green "documentTitle presente: '$DOC_TITLE'"
else
  red "documentTitle ausente no DPIA"
fi

if [ -n "$GENERATED_AT" ]; then
  green "generatedAt presente: $GENERATED_AT (evidencia auditavel — Art. 38)"
else
  red "generatedAt ausente — documento DPIA deve ter timestamp de geracao"
fi

ACTIVITIES_OK=$(python -c "print('yes' if int('${ACTIVITIES:-0}') >= 5 else 'no')" 2>/dev/null)
if [ "$ACTIVITIES_OK" = "yes" ]; then
  green "processingActivities com $ACTIVITIES atividades de tratamento documentadas"
else
  red "processingActivities esperado >= 5 atividades, recebido $ACTIVITIES"
fi

if [ -n "$NEXT_REVIEW" ]; then
  green "nextReviewAt presente: $NEXT_REVIEW"
else
  red "nextReviewAt ausente"
fi

h2 "GET /dpia (doctor) → 403 [DPIA restrito ao DPO/admin]"
do_request "$COOKIE_DOCTOR" GET "$BASE/dpia"
check "GET /dpia (doctor) → 403" 403 "$RESP_STATUS"

h2 "GET /dpia (receptionist) → 403"
do_request "$COOKIE_RECEP" GET "$BASE/dpia"
check "GET /dpia (receptionist) → 403" 403 "$RESP_STATUS"

# ──────────────────────────────────────────────────────────────────────────────
h1 "RESULTADO FINAL"
# ──────────────────────────────────────────────────────────────────────────────

TOTAL=$((PASS+FAIL))
printf "\n  Total: %d | " "$TOTAL"
printf "\033[32mPASS: %d\033[0m | " "$PASS"
if [ "$FAIL" -gt 0 ]; then
  printf "\033[31mFAIL: %d\033[0m\n\n" "$FAIL"
  exit 1
else
  printf "\033[32mFAIL: 0\033[0m — todos os cenarios LGPD Fase 4 validados\n\n"
fi
