# lgpd field

Adicione o campo informado em $ARGUMENTS a uma tabela existente, seguindo todas as convenções LGPD do projeto.

O argumento deve ser fornecido no formato: `nomeDoCampo:tipoDrizzle:nomeTabela`
Exemplo: `/lgpd-field consentRevokedAt:timestamp:consents`

Siga rigorosamente estas etapas na ordem:

1. **Classificação LGPD**: Antes de adicionar o campo, determine se ele contém dado pessoal (Art. 5º, I) ou dado sensível (Art. 5º, II). Se for sensível, verifique se a tabela pertence ao schema `private`. Se a tabela for do schema `public` e o campo for sensível, sinalize e questione antes de prosseguir.

2. **Schema Drizzle** (`src/db/schema/[tabela].ts`): Adicione o campo com o comentário obrigatório na linha anterior:
   - Dado pessoal: `// LGPD: dado pessoal — Art. 5º, I`
   - Dado sensível: `// LGPD: dado sensível — Art. 5º, II`
   - Campo de conformidade: `// LGPD: [princípio ou artigo aplicável]`

3. **Migration**: Gere a migration com `drizzle-kit generate`. Não execute `drizzle-kit migrate` — deixe isso para o desenvolvedor confirmar.

4. **Schema Zod**: Atualize o schema Zod correspondente em `src/modules/[módulo]/schema.ts`. Se o campo foi gerado via `drizzle-zod`, regenere o schema. Se foi definido manualmente, adicione a validação Zod correspondente com a restrição mais restritiva aplicável (princípio da necessidade — Art. 6º, III).

5. **Criptografia**: Se o campo contiver CPF, dados de saúde, biometria ou qualquer dado do schema `private`, adicione a instrução de criptografia via `pgcrypto` no serviço correspondente e sinalize que o campo deve ser descriptografado na leitura.

Ao final, liste as alterações feitas em cada arquivo e confirme qual artigo LGPD se aplica ao novo campo.
