#!/usr/bin/env node
/**
 * check-lgpd-comments.js
 *
 * Hook PostToolUse — verifica se arquivos de schema editados contêm
 * comentários LGPD obrigatórios em campos de dados pessoais ou sensíveis.
 *
 * Disparado automaticamente pelo Claude Code após Write ou Edit em qualquer arquivo.
 * Filtra internamente apenas arquivos dentro de src/db/schema/.
 *
 * Retorna exit 2 (erro bloqueante) quando detecta campos sem comentário // LGPD:
 * O Claude Code interpreta exit 2 como erro e envia o stderr de volta ao agente,
 * que então corrige o problema antes de continuar.
 *
 * LGPD: Art. 6º, VIII — prevenção — adoção de medidas para prevenir danos
 * no tratamento de dados pessoais, aplicada aqui ao processo de desenvolvimento.
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')

// Lê o input JSON enviado pelo Claude Code via stdin
let inputData = ''
process.stdin.on('data', (chunk) => { inputData += chunk })

process.stdin.on('end', async () => {
  let input = {}

  try {
    input = JSON.parse(inputData)
  } catch {
    // Se o JSON for inválido, encerra silenciosamente — não bloqueia
    process.exit(0)
  }

  // Extrai o caminho do arquivo afetado (o campo varia por tipo de tool)
  const filePath =
    input?.tool_input?.file_path ||
    input?.tool_input?.path ||
    null

  if (!filePath) process.exit(0)

  // Normaliza separadores de caminho para compatibilidade Windows/Unix
  const normalizedPath = filePath.replace(/\\/g, '/')

  // Aplica apenas a arquivos dentro do diretório de schemas Drizzle
  if (!normalizedPath.includes('src/db/schema/')) process.exit(0)

  // Verifica se o arquivo existe antes de tentar ler
  if (!fs.existsSync(filePath)) process.exit(0)

  // Padrão que identifica declarações de campo Drizzle
  // Cobre os tipos mais comuns: text, uuid, timestamp, boolean, integer, jsonb, date, serial
  const fieldDeclarationPattern = /^\s+\w+:\s+(text|uuid|timestamp|boolean|integer|jsonb|date|serial|pgEnum)\(/

  // Padrão de comentário LGPD válido
  const lgpdCommentPattern = /\/\/ LGPD:/

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
  const violations = []

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i]

    // Detecta declaração de campo Drizzle
    if (fieldDeclarationPattern.test(currentLine)) {
      const previousLine = i > 0 ? lines[i - 1] : ''

      // Verifica se a linha anterior tem comentário LGPD
      if (!lgpdCommentPattern.test(previousLine)) {
        violations.push({
          lineNumber: i + 1,  // +1 porque o array é zero-indexed
          content: currentLine.trim()
        })
      }
    }
  }

  if (violations.length > 0) {
    const fileName = path.basename(filePath)

    process.stderr.write(`\n⚠️  Violação de convenção LGPD detectada em: ${fileName}\n`)
    process.stderr.write(`   Arquivo: ${filePath}\n\n`)
    process.stderr.write(`   Campos sem comentário // LGPD: na linha anterior:\n`)

    for (const v of violations) {
      process.stderr.write(`   Linha ${v.lineNumber}: ${v.content}\n`)
    }

    process.stderr.write(`\n   Adicione o comentário adequado antes de cada campo:\n`)
    process.stderr.write(`   // LGPD: dado pessoal — Art. 5º, I\n`)
    process.stderr.write(`   // LGPD: dado sensível — Art. 5º, II\n`)
    process.stderr.write(`   // LGPD: [princípio ou artigo aplicável — ex: Art. 6º, VII]\n\n`)

    // exit 2 = erro bloqueante no Claude Code
    // O stderr acima será enviado de volta ao agente como mensagem de erro
    process.exit(2)
  }

  // Nenhuma violação — encerra silenciosamente
  process.exit(0)
})