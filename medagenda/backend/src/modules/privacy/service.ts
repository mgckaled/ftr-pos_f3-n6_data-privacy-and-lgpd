// LGPD: Art. 18 — serviço do painel do titular: visualizar, corrigir, revogar, exportar
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { pool } from '../../db/index.js'
import * as schema from '../../db/schema/index.js'
import {
  auditLogs,
  consents,
  dataRequests,
  patientTokens,
  patients,
} from '../../db/schema/index.js'
import type { UpdatePrivacyMeBody } from './schema.js'

// LGPD: Art. 18, I — titular visualiza os próprios dados pessoais
// CPF NUNCA retornado — princípio da necessidade (Art. 6º, III)
export async function getPrivacyMeService(
  actorUserId: string,
  actorRole: string,
  ipAddress: string,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    const patient = await tx.query.patients.findFirst({
      where: (p, { eq: eqFn }) => eqFn(p.userId, actorUserId),
      columns: {
        id: true,
        name: true,
        email: true,
        phone: true,
        birthDate: true,
        legalBasis: true,
        retentionExpiresAt: true,
        createdAt: true,
        // LGPD: Art. 6º, III — necessidade — CPF não retornado ao titular via API
        // cpf: excluído intencionalmente (dado pessoal sensível, criptografado)
      },
    })

    if (!patient) throw new Error('Paciente não encontrado para este usuário')

    const patientConsents = await tx.query.consents.findMany({
      where: (c, { eq: eqFn }) => eqFn(c.patientId, patient.id),
      columns: {
        id: true,
        purpose: true,
        granted: true,
        grantedAt: true,
        revokedAt: true,
        policyVersion: true,
      },
    })

    // LGPD: Art. 5º, XI — pseudonimização — audit log usa patientToken, nunca patientId
    const tokenRow = await tx.query.patientTokens.findFirst({
      where: (pt, { eq: eqFn }) => eqFn(pt.patientId, patient.id),
    })

    // LGPD: Art. 6º, X — responsabilização — registra acesso do titular aos próprios dados
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'read',
      resource: 'patients',
      resourceId: patient.id,
      patientToken: tokenRow?.token ?? null,
      legalBasis: 'legal_obligation',
      ipAddress,
      metadata: { source: 'privacy_panel' },
    })

    await client.query('COMMIT')

    return {
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email ?? null,
        phone: patient.phone ?? null,
        birthDate: patient.birthDate ?? null,
        legalBasis: patient.legalBasis,
        retentionExpiresAt: patient.retentionExpiresAt ? String(patient.retentionExpiresAt) : null,
        createdAt: String(patient.createdAt),
      },
      consents: patientConsents.map((c) => ({
        id: c.id,
        purpose: c.purpose,
        granted: c.granted,
        grantedAt: String(c.grantedAt),
        revokedAt: c.revokedAt ? String(c.revokedAt) : null,
        policyVersion: c.policyVersion,
      })),
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 18, III — titular corrige dados pessoais incompletos, inexatos ou desatualizados
// Princípio da necessidade (Art. 6º, III): apenas campos corrigíveis pelo titular
export async function updatePrivacyMeService(
  actorUserId: string,
  actorRole: string,
  ipAddress: string,
  body: UpdatePrivacyMeBody,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    const patient = await tx.query.patients.findFirst({
      where: (p, { eq: eqFn }) => eqFn(p.userId, actorUserId),
      columns: { id: true },
    })

    if (!patient) throw new Error('Paciente não encontrado para este usuário')

    const updateData: Partial<typeof patients.$inferInsert> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email || null
    if (body.phone !== undefined) updateData.phone = body.phone || null

    if (Object.keys(updateData).length === 0) {
      await client.query('ROLLBACK')
      throw new Error('Nenhum campo válido para atualização')
    }

    const [updated] = await tx
      .update(patients)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(patients.id, patient.id))
      .returning({
        id: patients.id,
        name: patients.name,
        email: patients.email,
        phone: patients.phone,
        birthDate: patients.birthDate,
        legalBasis: patients.legalBasis,
        retentionExpiresAt: patients.retentionExpiresAt,
        createdAt: patients.createdAt,
      })

    const tokenRow = await tx.query.patientTokens.findFirst({
      where: (pt, { eq: eqFn }) => eqFn(pt.patientId, patient.id),
    })

    // LGPD: Art. 6º, X — responsabilização — registra quais campos foram corrigidos
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'update',
      resource: 'patients',
      resourceId: patient.id,
      patientToken: tokenRow?.token ?? null,
      legalBasis: 'legal_obligation',
      ipAddress,
      metadata: { fields: Object.keys(updateData), source: 'privacy_panel' },
    })

    await client.query('COMMIT')

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email ?? null,
      phone: updated.phone ?? null,
      birthDate: updated.birthDate ?? null,
      legalBasis: updated.legalBasis,
      retentionExpiresAt: updated.retentionExpiresAt ? String(updated.retentionExpiresAt) : null,
      createdAt: String(updated.createdAt),
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 18, IX — titular revoga consentimento a qualquer momento
// Implementação: o service verifica propriedade com RLS patient, depois eleva para admin no UPDATE
// (consents_patient_self é apenas FOR SELECT — UPDATE requer permissão admin interna)
export async function revokeConsentService(
  actorUserId: string,
  actorRole: string,
  ipAddress: string,
  purpose: string,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    // Passo 1: verificar propriedade com RLS de patient
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    const patient = await tx.query.patients.findFirst({
      where: (p, { eq: eqFn }) => eqFn(p.userId, actorUserId),
      columns: { id: true },
    })

    if (!patient) throw new Error('Paciente não encontrado para este usuário')

    // Busca o consentimento ativo para a finalidade (RLS patient permite SELECT)
    const existingConsent = await tx.query.consents.findFirst({
      where: (c, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
        andFn(eqFn(c.patientId, patient.id), eqFn(c.purpose, purpose as never), isNullFn(c.revokedAt)),
    })

    if (!existingConsent || !existingConsent.granted) {
      await client.query('ROLLBACK')
      throw new Error('Consentimento ativo não encontrado para esta finalidade')
    }

    // Passo 2: elevar para admin internamente para executar o UPDATE
    // O service já verificou a propriedade — elevação interna é segura
    await client.query(`SELECT set_config('app.current_role', 'admin', true)`)

    const now = new Date()
    const [revokedConsent] = await tx
      .update(consents)
      .set({ revokedAt: now })
      .where(eq(consents.id, existingConsent.id))
      .returning()

    const tokenRow = await tx.query.patientTokens.findFirst({
      where: (pt, { eq: eqFn }) => eqFn(pt.patientId, patient.id),
    })

    // LGPD: Art. 6º, X — responsabilização — registra revogação de consentimento
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'consent_revoke',
      resource: 'consents',
      resourceId: revokedConsent.id,
      patientToken: tokenRow?.token ?? null,
      legalBasis: 'consent',
      ipAddress,
      metadata: { purpose, revokedAt: now.toISOString() },
    })

    await client.query('COMMIT')

    return {
      id: revokedConsent.id,
      purpose: revokedConsent.purpose,
      granted: revokedConsent.granted,
      grantedAt: String(revokedConsent.grantedAt),
      revokedAt: String(revokedConsent.revokedAt),
      policyVersion: revokedConsent.policyVersion,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 18, V e VI — portabilidade: titular exporta os próprios dados
// NOTA: medical_records NÃO incluídos — dados sensíveis (Art. 11) exigem tratamento diferenciado
export async function exportPrivacyDataService(
  actorUserId: string,
  actorRole: string,
  ipAddress: string,
  format: 'json' | 'csv',
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    const patient = await tx.query.patients.findFirst({
      where: (p, { eq: eqFn }) => eqFn(p.userId, actorUserId),
      columns: {
        id: true, name: true, email: true, phone: true,
        birthDate: true, legalBasis: true, retentionExpiresAt: true, createdAt: true,
      },
    })

    if (!patient) throw new Error('Paciente não encontrado para este usuário')

    const patientConsents = await tx.query.consents.findMany({
      where: (c, { eq: eqFn }) => eqFn(c.patientId, patient.id),
    })

    const patientDataRequests = await tx.query.dataRequests.findMany({
      where: (dr, { eq: eqFn }) => eqFn(dr.patientId, patient.id),
    })

    const tokenRow = await tx.query.patientTokens.findFirst({
      where: (pt, { eq: eqFn }) => eqFn(pt.patientId, patient.id),
    })

    // LGPD: Art. 6º, X — responsabilização — registra exportação de dados pelo titular
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'export',
      resource: 'patients',
      resourceId: patient.id,
      patientToken: tokenRow?.token ?? null,
      legalBasis: 'legal_obligation',
      ipAddress,
      metadata: { format, source: 'privacy_panel' },
    })

    await client.query('COMMIT')

    const exportData = {
      exportedAt: new Date().toISOString(),
      // LGPD: Art. 18, V — portabilidade: dados pessoais em formato interoperável
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        birthDate: patient.birthDate,
        legalBasis: patient.legalBasis,
        retentionExpiresAt: patient.retentionExpiresAt ? String(patient.retentionExpiresAt) : null,
        createdAt: String(patient.createdAt),
      },
      // LGPD: Art. 8º — histórico completo de consentimentos por finalidade
      consents: patientConsents.map((c) => ({
        purpose: c.purpose,
        granted: c.granted,
        grantedAt: String(c.grantedAt),
        revokedAt: c.revokedAt ? String(c.revokedAt) : null,
        policyVersion: c.policyVersion,
      })),
      // LGPD: Art. 18 — histórico de exercício de direitos do titular
      dataRequests: patientDataRequests.map((dr) => ({
        type: dr.type,
        status: dr.status,
        reason: dr.reason,
        response: dr.response,
        requestedAt: String(dr.requestedAt),
        deadlineAt: String(dr.deadlineAt),
        resolvedAt: dr.resolvedAt ? String(dr.resolvedAt) : null,
      })),
      // LGPD: Art. 5º, II — dados sensíveis de saúde (prontuários) NÃO incluídos
      // medical_records: excluídos — Art. 11 exige tratamento diferenciado para dados sensíveis
    }

    if (format === 'json') {
      return { data: exportData, contentType: 'application/json', filename: 'meus-dados.json' }
    }

    // Serialização CSV em seções legíveis
    const csvLines: string[] = [
      '## EXPORTACAO DE DADOS PESSOAIS - LGPD Art. 18',
      `## Gerado em: ${exportData.exportedAt}`,
      '',
      '## DADOS PESSOAIS',
      'campo,valor',
      `id,${exportData.patient.id}`,
      `nome,${exportData.patient.name}`,
      `email,${exportData.patient.email ?? ''}`,
      `telefone,${exportData.patient.phone ?? ''}`,
      `data_nascimento,${exportData.patient.birthDate ?? ''}`,
      `base_legal,${exportData.patient.legalBasis}`,
      `retencao_ate,${exportData.patient.retentionExpiresAt ?? ''}`,
      `cadastrado_em,${exportData.patient.createdAt}`,
      '',
      '## CONSENTIMENTOS',
      'finalidade,concedido,concedido_em,revogado_em,versao_politica',
      ...exportData.consents.map(
        (c) =>
          `${c.purpose},${c.granted},${c.grantedAt},${c.revokedAt ?? ''},${c.policyVersion}`,
      ),
      '',
      '## SOLICITACOES DE DIREITOS',
      'tipo,status,motivo,resposta,solicitado_em,prazo,resolvido_em',
      ...exportData.dataRequests.map(
        (dr) =>
          `${dr.type},${dr.status},"${dr.reason ?? ''}","${dr.response ?? ''}",${dr.requestedAt},${dr.deadlineAt},${dr.resolvedAt ?? ''}`,
      ),
      '',
      '## NOTA: Prontuarios medicos (dados sensiveis - Art. 11 LGPD) nao incluidos nesta exportacao',
    ]

    return {
      data: csvLines.join('\n'),
      contentType: 'text/csv',
      filename: 'meus-dados.csv',
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

