# Audit

Adicione middleware de auditoria LGPD ao endpoint ou módulo informado em $ARGUMENTS.

Siga rigorosamente estas regras:

1. Importe e aplique o middleware `auditMiddleware` do arquivo `src/middleware/audit.ts` na rota indicada.

2. O registro em `audit_logs` deve usar `patientToken` — nunca `patientId` diretamente. Obtenha o token via lookup na tabela `patient_tokens`. Se não houver paciente envolvido na operação, o campo `patientToken` deve ser `null`.

3. Cada inserção em `audit_logs` deve obrigatoriamente preencher os campos: `userId` (extraído do payload JWT), `action` (use o enum `auditActionEnum`), `resource` (nome da tabela afetada), `resourceId`, `legalBasis` (base legal que justifica a operação) e `ipAddress` (extraído do request).

4. Adicione o comentário LGPD na linha anterior a cada bloco de auditoria:
   `// LGPD: Art. 6º, X — responsabilização e prestação de contas`

5. O registro em `audit_logs` deve ocorrer APÓS a operação principal ser confirmada com sucesso. Em caso de erro na operação principal, não registre o log — não polua a trilha de auditoria com operações que não se completaram.

6. Para operações de `update`, preencha o campo `metadata` em JSONB com `{ before: { campo: valorAntigo }, after: { campo: valorNovo } }`, listando apenas os campos que foram efetivamente alterados.

Após implementar, mostre o trecho de código relevante e confirme qual `auditActionEnum` foi utilizado.
