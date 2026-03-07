<!-- markdownlint-disable -->

# Questionário LGPD — Gabarito Comentado

## Questão 1 — O que é considerado tratamento de dados pela LGPD?

**Alternativa correta: 1 — Qualquer operação como coletar, armazenar, compartilhar ou excluir**

O Art. 5º, X da LGPD define tratamento de dados pessoais de forma deliberadamente abrangente: trata-se de "toda operação realizada com dados pessoais", abrangendo coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação, controle, modificação, comunicação, transferência, difusão e extração. Para profissionais de tecnologia, isso significa que praticamente qualquer interação com dados de usuários — seja um backup automatizado, um log de acesso, uma query de consulta ou uma rotina de exclusão — configura tratamento e, portanto, está sujeito às obrigações da lei.

**Alternativa 2 — Apenas a exclusão de dados:** Incorreta. A exclusão (eliminação) é apenas uma das inúmeras operações que a lei reconhece como tratamento. Restringir o conceito à exclusão ignoraria toda a cadeia de coleta, armazenamento e processamento.

**Alternativa 3 — Apenas a coleta de dados:** Incorreta pelo mesmo raciocínio: a coleta é o ponto de entrada do tratamento, mas não o esgota. Dados já coletados continuam sob o escopo da LGPD em todas as etapas subsequentes de seu ciclo de vida.

**Alternativa 4 — Somente operações realizadas em bancos de dados digitais:** Incorreta. A própria lei define "banco de dados" como qualquer conjunto estruturado de dados em suporte eletrônico ou físico (Art. 5º, IV), o que inclui planilhas, fichários e arquivos físicos organizados. O suporte digital não é requisito para caracterizar tratamento.

---

## Questão 2 — Segundo a LGPD, quem é o titular dos dados?

**Alternativa correta: 3 — O usuário ou pessoa natural a quem os dados se referem**

O Art. 5º, V da LGPD define titular como "a pessoa natural a quem se referem os dados pessoais que são objeto de tratamento". O titular é, portanto, o verdadeiro dono da informação — seja ele um cliente, paciente, funcionário, aluno ou qualquer cidadão vivo cujos dados estejam sendo tratados. É em torno do titular que toda a arquitetura da lei se organiza: ele tem direito de ser informado sobre o uso de seus dados, acessá-los, corrigi-los, solicitar sua eliminação, revogar o consentimento e ser notificado em caso de incidentes de segurança. Para quem desenvolve sistemas, o titular deve ser tratado como o centro de qualquer decisão de design envolvendo dados pessoais.

**Alternativa 1 — O operador do sistema:** Incorreta. O operador é a entidade que realiza tecnicamente o tratamento de dados em nome do controlador. Ele executa, mas não é dono dos dados.

**Alternativa 2 — A empresa que coleta os dados:** Incorreta. A empresa coletora assume o papel de controladora, responsável por decidir a finalidade e os meios do tratamento. Coletar dados não confere propriedade sobre eles.

**Alternativa 4 — O DPO responsável pelo tratamento:** Incorreta. O DPO (Encarregado) é o canal de comunicação entre a organização, os titulares e a ANPD. Sua função é garantir a conformidade, não ser proprietário ou titular de qualquer dado.

---

## Questão 3 — O que caracteriza o princípio da necessidade?

**Alternativa correta: 3 — Reduzir a coleta ao mínimo necessário**

O Art. 6º, III da LGPD define o princípio da necessidade como a "limitação do tratamento ao mínimo necessário para a realização de suas finalidades, com abrangência dos dados pertinentes, proporcionais e não excessivos em relação às finalidades do tratamento". Na prática, esse princípio impõe ao desenvolvedor um exercício de contenção consciente: antes de incluir qualquer campo em um formulário, tabela ou payload de API, a pergunta obrigatória é "esse dado é estritamente essencial para o serviço funcionar?". Se a resposta não for um sim claro e justificável, o dado não deve ser coletado. Um sistema de agendamento, por exemplo, pode legitimamente pedir nome, e-mail e data — mas solicitar CPF, profissão ou endereço completo sem necessidade real viola diretamente esse princípio e expõe a organização a sanções da ANPD.

**Alternativa 1 — Coletar todos os dados disponíveis:** Incorreta. Essa prática é exatamente o oposto do que a lei determina. Coletar dados "por precaução" ou "para uso futuro não definido" configura excesso e pode caracterizar também violação ao princípio da finalidade.

**Alternativa 2 — Manter os dados indefinidamente:** Incorreta. A retenção ilimitada contraria tanto o princípio da necessidade quanto o dever de eliminação previsto no Art. 5º, XIV. Os dados devem ser mantidos apenas pelo tempo necessário ao cumprimento da finalidade declarada.

**Alternativa 4 — Garantir acesso irrestrito aos dados:** Incorreta. Acesso irrestrito contradiz os princípios de segurança e prevenção (Art. 6º, VII e VIII) e as boas práticas de controle de acesso baseado em papéis (RBAC), que limitam o acesso ao mínimo necessário para cada função.

---

## Questão 4 — Qual é a principal função do relatório de impacto à proteção de dados (DPIA)?

**Alternativa correta: 3 — Documentar riscos e medidas de mitigação no tratamento de dados**

O Art. 5º, XVII da LGPD define o DPIA (Data Protection Impact Assessment) como a "documentação do controlador que contém a descrição dos processos de tratamento de dados pessoais que podem gerar riscos às liberdades civis e aos direitos fundamentais, bem como medidas, salvaguardas e mecanismos de mitigação de risco". Em outras palavras, o DPIA é um instrumento de análise preventiva: ele mapeia os riscos que um determinado tratamento de dados representa para os titulares e propõe medidas concretas para reduzi-los. Sua elaboração é exigida em situações de maior sensibilidade — tratamento em larga escala de dados sensíveis, uso de tecnologias invasivas como reconhecimento facial ou geolocalização, transferências internacionais de dados e situações determinadas pela própria ANPD. Um ponto crítico para a equipe de TI é que o DPIA não é um documento exclusivamente jurídico: ele depende da visão técnica dos desenvolvedores e arquitetos de sistemas para ser preciso, completo e efetivamente útil à conformidade da organização.

**Alternativa 1 — Definir o prazo de retenção de backups:** Incorreta. A definição de prazos de retenção faz parte das políticas internas de ciclo de vida dos dados, mas não é a função do DPIA, cujo escopo é a avaliação e mitigação de riscos ao titular.

**Alternativa 2 — Substituir a política de privacidade da empresa:** Incorreta. O DPIA e a política de privacidade são documentos complementares com propósitos distintos. A política de privacidade é voltada à comunicação com o titular; o DPIA é um instrumento interno de gestão de risco.

**Alternativa 4 — Registrar consentimentos coletados dos usuários:** Incorreta. O registro de consentimentos é uma obrigação separada, relacionada à base legal do consentimento (Art. 7º, I), e deve ser mantido pelo controlador como evidência de conformidade — mas isso não é atribuição do DPIA.

---

## Questão 5 — O que a LGPD define como consentimento válido?

**Alternativa correta: 3 — Livre, informado, específico e inequívoco**

O Art. 5º, XII da LGPD define consentimento como a "manifestação livre, informada e inequívoca pela qual o titular concorda com o tratamento de seus dados pessoais para uma finalidade determinada". Cada um desses atributos tem peso próprio e não pode ser dispensado. Livre significa que o titular não pode ser coagido, pressionado ou colocado em situação de desvantagem caso recuse. Informado exige que o titular saiba exatamente quais dados serão coletados, com qual finalidade e com quem serão compartilhados, antes de manifestar sua concordância. Inequívoco determina que a aceitação seja clara e verificável, sem margem para ambiguidade — silêncio, inércia ou caixas pré-marcadas não constituem consentimento válido. Por fim, a exigência de finalidade determinada proíbe o consentimento genérico: cada uso distinto dos dados requer uma autorização específica e separada. Para sistemas web e mobile, isso se traduz em fluxos de onboarding que apresentam opt-ins explícitos para cada finalidade, com registros auditáveis de quando e como o consentimento foi obtido.

**Alternativa 1 — Qualquer aceitação, mesmo implícita:** Incorreta. A lei exige que o consentimento seja inequívoco, o que elimina qualquer forma de aceitação tácita ou presumida. Aceitar os termos de uso de forma passiva não supre esse requisito.

**Alternativa 2 — Apenas uma assinatura física:** Incorreta. A LGPD não exige forma física para o consentimento. O que importa é que ele seja livre, informado e inequívoco — podendo ser obtido digitalmente, desde que haja registro que permita comprovar a manifestação do titular.

**Alternativa 4 — Consentimento genérico para todos os usos:** Incorreta. A lei veda expressamente o consentimento amplo e inespecífico. Termos como "para melhorar sua experiência" ou "para fins internos" não atendem ao requisito de finalidade determinada, tornando o consentimento inválido.

---

## Questão 6 — O que caracteriza o direito de portabilidade do titular?

**Alternativa correta: 3 — Transferir seus dados para outro fornecedor**

O direito de portabilidade, previsto no Art. 18, V da LGPD, garante ao titular a possibilidade de solicitar a transferência de seus dados pessoais para outro fornecedor de serviço ou produto, mediante requisição expressa. Trata-se de um direito com forte viés concorrencial e de autonomia: ele impede que a posse dos dados se torne um mecanismo de aprisionamento do usuário a uma plataforma específica — o chamado lock-in de dados. Na prática, sistemas que tratam dados pessoais precisam estar arquitetados para exportar os dados do titular em formato interoperável e estruturado, de modo que possam ser importados por outro serviço sem perda ou distorção. Para equipes de desenvolvimento, isso implica pensar em endpoints ou funcionalidades de exportação desde a fase de design do sistema, não como adendo posterior.

**Alternativa 1 — Anonimizar seus dados automaticamente:** Incorreta. A anonimização é uma técnica de tratamento que pode ser solicitada pelo titular em certas circunstâncias, mas não define o direito de portabilidade. São direitos e instrumentos distintos no rol do Art. 18.

**Alternativa 2 — Revogar o consentimento:** Incorreta. A revogação do consentimento é um direito autônomo, previsto no Art. 18, IX, e produz efeitos diferentes da portabilidade — ela cessa a base legal para o tratamento, mas não implica necessariamente a transferência dos dados a outro fornecedor.

**Alternativa 4 — Receber indenização por vazamento:** Incorreta. A possibilidade de reparação por danos decorrentes de incidentes de segurança está relacionada à responsabilidade civil dos agentes de tratamento, disciplinada nos Arts. 42 a 45 da LGPD, e não ao direito de portabilidade.

---

## Questão 7 — Qual é a diferença entre dado pessoal e dado sensível?

**Alternativa correta: 3 — Dado pessoal identifica alguém; dado sensível expõe informações mais delicadas, como saúde ou religião**

O Art. 5º, I e II da LGPD estabelece uma distinção clara entre as duas categorias. Dado pessoal é toda informação relacionada a uma pessoa natural identificada ou identificável — nome, CPF, e-mail, endereço IP, localização, entre outros. Dado sensível, por sua vez, é uma subcategoria especial do dado pessoal: refere-se a informações sobre origem racial ou étnica, convicção religiosa, opinião política, filiação sindical ou a organizações de caráter religioso, filosófico ou político, dados referentes à saúde ou à vida sexual, e dados genéticos ou biométricos. A razão para esse tratamento diferenciado é objetiva — a exposição ou uso indevido dessas informações tem potencial direto de causar discriminação, constrangimento, exclusão social ou violação da dignidade humana. Na prática de desenvolvimento, sistemas que lidam com dados sensíveis demandam camadas adicionais de controle: criptografia específica por campo, controle de acesso mais granular e documentação clara da base legal utilizada.

**Alternativa 1 — Dados pessoais não precisam de proteção legal:** Incorreta. Dados pessoais são explicitamente protegidos pela LGPD em seu conjunto. Todo dado que identifique ou permita identificar uma pessoa está sob o escopo da lei e exige tratamento responsável.

**Alternativa 2 — Dado sensível só existe em bancos de saúde:** Incorreta. O rol de dados sensíveis definido no Art. 5º, II é amplo e não se restringe ao setor de saúde. Dados biométricos em controle de acesso corporativo, opiniões políticas em plataformas de debate ou dados de filiação religiosa em sistemas de RH são igualmente sensíveis, independentemente do setor.

**Alternativa 4 — Dados sensíveis não podem ser armazenados:** Incorreta. A lei não proíbe o armazenamento de dados sensíveis; ela impõe condições mais rigorosas para que esse armazenamento seja legítimo, exigindo base legal adequada, finalidade clara e medidas de segurança proporcionais ao risco.

---

## Questão 8 — Qual é a função da ANPD (Autoridade Nacional de Proteção de Dados)?

**Alternativa correta: 3 — Regular, fiscalizar, orientar e educar**

A ANPD é o órgão da administração pública federal responsável por zelar pela proteção dos dados pessoais no Brasil, conforme estabelecido pela própria LGPD. Suas atribuições são deliberadamente amplas e abrangem quatro dimensões complementares. Na dimensão regulatória, a ANPD edita normas e diretrizes sobre proteção de dados, como a Resolução CD/ANPD nº 15/2024, que disciplina a notificação de incidentes de segurança. Na dimensão fiscalizatória, ela monitora o cumprimento da lei pelos agentes de tratamento, podendo instaurar processos administrativos sancionatórios e aplicar penalidades que vão de advertências a multas de até 2% do faturamento da organização, limitadas a R$ 50 milhões por infração. Na dimensão orientativa, a ANPD emite guias, recomendações e responde a consultas sobre a aplicação da lei. Por fim, na dimensão educativa, promove ações de conscientização junto à sociedade, às empresas e ao poder público.

**Alternativa 1 — Criar softwares de segurança:** Incorreta. O desenvolvimento de ferramentas tecnológicas não é atribuição da ANPD. Sua atuação é normativa, fiscalizatória e educacional — não operacional no sentido técnico de produzir soluções de software.

**Alternativa 2 — Substituir a Justiça em processos de dados:** Incorreta. A ANPD atua na esfera administrativa e não substitui o Poder Judiciário. Titulares que sofrerem danos decorrentes do tratamento irregular de seus dados podem buscar reparação tanto pela via administrativa quanto pela via judicial, de forma independente.

**Alternativa 4 — Apenas aplicar multas:** Incorreta. Reduzir o papel da ANPD à aplicação de multas é uma visão parcial e equivocada. A sanção pecuniária é apenas um dos instrumentos disponíveis, e a própria lei prevê que a ANPD deve priorizar orientação e adequação antes de recorrer às penalidades mais severas.

---

## Questão 9 — Qual é a principal diferença entre anonimização e pseudonimização?

**Alternativa correta: 1 — Anonimização é irreversível; pseudonimização pode ser revertida**

A distinção entre anonimização e pseudonimização é uma das mais relevantes para quem desenvolve sistemas sob a LGPD, pois determina se os dados continuam ou não sujeitos às obrigações da lei. O Art. 5º, XI define anonimização como a utilização de meios técnicos razoáveis por meio dos quais um dado perde, de forma definitiva, a possibilidade de associação direta ou indireta a um indivíduo. Quando a anonimização é genuinamente irreversível, os dados saem do escopo da LGPD. Já a pseudonimização substitui os identificadores diretos de um titular — nome, CPF, e-mail — por tokens, códigos ou IDs artificiais, mantendo uma chave separada que permite a reidentificação quando necessário. Por essa razão, dados pseudonimizados permanecem integralmente dentro do escopo da LGPD. Um ponto de atenção crítico é a chamada falsa anonimização — situações em que dados aparentemente anonimizados podem ser reidentificados pelo cruzamento com outras bases, como a combinação de gênero, CEP e profissão.

**Alternativa 2 — Anonimização exige consentimento do usuário:** Incorreta. A anonimização é uma medida técnica de proteção e não uma base legal que dependa de consentimento. Quando bem executada, ela é justamente o mecanismo que libera os dados do regime de proteção da LGPD por eliminar o vínculo com o titular.

**Alternativa 3 — Pseudonimização é usada apenas em bancos de saúde:** Incorreta. A pseudonimização é uma técnica transversal, aplicável a qualquer sistema que trate dados pessoais e necessite proteger identificadores sem perder a capacidade de rastreamento interno.

**Alternativa 4 — Nenhuma, são sinônimos:** Incorreta. As duas técnicas produzem efeitos jurídicos e técnicos fundamentalmente distintos. Confundi-las pode levar uma organização a acreditar que está fora do escopo da LGPD quando, na realidade, continua plenamente sujeita a suas obrigações.

---

## Questão 10 — Qual é a função principal do operador de dados?

**Alternativa correta: 2 — Executar o tratamento conforme instruções do controlador**

O Art. 5º, VII da LGPD define o operador como a "pessoa natural ou jurídica, de direito público ou privado, que realiza o tratamento de dados pessoais em nome do controlador". A palavra-chave dessa definição é "em nome de": o operador não age por vontade própria, mas estritamente segundo as instruções e dentro dos limites estabelecidos pelo controlador. Ele não decide a finalidade do tratamento, não escolhe a base legal aplicável e não define por quanto tempo os dados serão mantidos — essas são prerrogativas exclusivas do controlador. Na prática do desenvolvimento de software, o operador aparece com frequência sob a forma de provedores de infraestrutura em nuvem, plataformas de e-mail transacional, empresas de processamento de pagamentos ou qualquer prestador de serviço que acesse dados pessoais para executar uma atividade contratada. Embora o operador execute e não decida, ele não está isento de responsabilidade: responde pelos danos que causar quando agir em desacordo com as instruções do controlador ou quando descumprir as obrigações da LGPD, conforme o Art. 42.

**Alternativa 1 — Exercer auditoria sobre os sistemas:** Incorreta. A função de auditoria e monitoramento de conformidade está associada ao Encarregado (DPO), que atua como canal entre o controlador, os titulares e a ANPD, e não ao operador.

**Alternativa 3 — Elaborar a política de privacidade:** Incorreta. A política de privacidade é uma responsabilidade do controlador, que define as finalidades e condições do tratamento e deve comunicá-las aos titulares de forma clara e acessível.

**Alternativa 4 — Definir as bases legais:** Incorreta. A escolha da base legal que fundamenta o tratamento é uma decisão exclusiva do controlador, pois está diretamente ligada à finalidade e à natureza do tratamento que ele determina.

---

## Questão 11 — Quais são as possíveis sanções da LGPD?

**Alternativa correta: 3 — Advertência, multas, bloqueio de dados e até suspensão de atividades**

O Art. 52 da LGPD estabelece um conjunto graduado de sanções administrativas que a ANPD pode aplicar aos agentes de tratamento em caso de infração à lei. No nível menos severo está a advertência, que pode ser acompanhada de prazo para adoção de medidas corretivas. Em seguida vêm as multas, que podem ser simples — de até 2% do faturamento da pessoa jurídica no seu último exercício, limitada a R$ 50 milhões por infração — ou diárias, para compelir o infrator a cessar a irregularidade. A lei prevê ainda a publicização da infração após devidamente apurada, o que representa um dano reputacional significativo. Nas hipóteses mais graves, a ANPD pode determinar o bloqueio dos dados pessoais objeto da infração, sua eliminação, a suspensão parcial do funcionamento do banco de dados e, em última instância, a suspensão total ou proibição parcial ou integral do exercício de atividades relacionadas ao tratamento de dados.

**Alternativa 1 — Apenas multa simples:** Incorreta. A multa é apenas uma das sanções previstas no Art. 52, e nem sequer é a primeira na ordem de aplicação. Reduzir o risco da LGPD à dimensão financeira subestima gravemente o alcance das penalidades disponíveis à ANPD.

**Alternativa 2 — Apenas suspensão de atividades:** Incorreta. A suspensão é a sanção mais drástica do rol e tende a ser aplicada em situações de reincidência ou descumprimento grave. Apresentá-la como única possibilidade ignora toda a gradação prevista na lei.

**Alternativa 4 — Apenas exclusão de dados:** Incorreta. A eliminação de dados é uma das sanções previstas, mas está longe de ser a única. Tratá-la isoladamente omite as penalidades financeiras, a publicização da infração e as restrições operacionais que podem ser impostas pela ANPD.

---

## Questão 12 — Qual é o papel do controlador?

**Alternativa correta: 2 — Decidir a finalidade e os meios do tratamento**

O Art. 5º, VI da LGPD define o controlador como a "pessoa natural ou jurídica, de direito público ou privado, a quem competem as decisões referentes ao tratamento de dados pessoais". É precisamente essa prerrogativa decisória que distingue o controlador dos demais agentes da cadeia de tratamento. Cabe ao controlador determinar por que os dados serão coletados — a finalidade —, como serão tratados — os meios —, por quanto tempo serão retidos, com quem poderão ser compartilhados e qual base legal ampara cada operação. Ele também é o responsável por garantir a transparência perante os titulares, elaborar ou supervisionar a política de privacidade e assegurar que tanto o operador quanto os demais envolvidos no tratamento atuem em conformidade com a lei. Em termos de responsabilidade jurídica, o controlador ocupa a posição central: mesmo quando terceiriza a execução do tratamento para um operador, não se exime das obrigações impostas pela LGPD.

**Alternativa 1 — Monitorar incidentes de segurança:** Incorreta. O monitoramento de incidentes é uma responsabilidade operacional de segurança da informação, e a notificação formal de incidentes envolve o DPO e o controlador conjuntamente — mas não define o papel do controlador como figura jurídica da LGPD.

**Alternativa 3 — Ser o elo com a ANPD:** Incorreta. Essa é a função característica do Encarregado (DPO), definido no Art. 5º, VIII como o canal de comunicação entre o controlador, os titulares e a ANPD.

**Alternativa 4 — Executar tecnicamente o tratamento:** Incorreta. A execução técnica do tratamento é a função do operador, que age sob instrução do controlador. A distinção é juridicamente relevante: controlador decide, operador executa.

---

## Questão 13 — O que é anonimização segundo a LGPD?

**Alternativa correta: 3 — Tornar dados irreversivelmente não identificáveis**

O Art. 5º, XI da LGPD define anonimização como a "utilização de meios técnicos razoáveis e disponíveis no momento do tratamento, por meio dos quais um dado perde a possibilidade de associação, direta ou indireta, a um indivíduo". O elemento central dessa definição é a irreversibilidade: para que um dado seja considerado anonimizado nos termos da lei, deve ser tecnicamente inviável, com os recursos disponíveis, reidentificar o titular a partir daquelas informações — seja de forma direta ou pelo cruzamento com outras bases. Essa distinção tem consequência jurídica direta: dados genuinamente anonimizados saem do escopo da LGPD, pois deixam de ser dados pessoais. O ponto de atenção crítico para equipes de desenvolvimento é a chamada falsa anonimização — situações em que campos identificadores são removidos, mas a combinação de atributos remanescentes ainda permite a reidentificação indireta do titular.

**Alternativa 1 — Substituir temporariamente por outro identificador:** Incorreta. Essa descrição corresponde à pseudonimização, não à anonimização. A substituição temporária por tokens ou códigos mantém a possibilidade de reidentificação mediante uso de uma chave, o que mantém os dados dentro do escopo da LGPD.

**Alternativa 2 — Fazer backup sem identificação:** Incorreta. Um backup sem identificação visível não equivale à anonimização técnica. Os dados originais continuam presentes e potencialmente recuperáveis, o que não satisfaz o requisito de irreversibilidade exigido pela lei.

**Alternativa 4 — Ocultar dados em planilhas:** Incorreta. Ocultar colunas ou linhas em uma planilha é uma medida cosmética que não altera os dados subjacentes. O dado continua existindo, acessível e exportável, sem qualquer proteção real ao titular.

---

## Questão 14 — O que representa o princípio da transparência?

**Alternativa correta: 2 — Garantia de acesso claro às informações sobre tratamento de dados**

O princípio da transparência, previsto no Art. 6º, VI da LGPD, determina que os agentes de tratamento devem garantir aos titulares informações claras, precisas e facilmente acessíveis sobre a realização do tratamento e os respectivos agentes responsáveis. Em termos práticos, isso significa que o titular tem o direito de saber quais dados estão sendo coletados, com qual finalidade, por quanto tempo serão retidos, com quem serão compartilhados e qual é a base legal que fundamenta o tratamento — e essas informações devem ser apresentadas em linguagem acessível, não em linguagem jurídica densa ou em cláusulas enterradas em termos de uso extensos. Para equipes de desenvolvimento, o princípio da transparência se traduz em decisões concretas de produto e arquitetura: painéis de privacidade onde o usuário pode consultar seus dados e o histórico de tratamento, políticas de privacidade escritas de forma clara e segmentada por finalidade, notificações proativas sobre mudanças no uso dos dados e canais de atendimento acessíveis para solicitações dos titulares.

**Alternativa 1 — Permitir acesso irrestrito a terceiros:** Incorreta. Transparência diz respeito à clareza de informações fornecidas ao próprio titular sobre o tratamento de seus dados, e não à abertura indiscriminada de dados a terceiros, o que poderia inclusive violar os princípios de segurança e finalidade.

**Alternativa 3 — Uso de logs técnicos apenas:** Incorreta. Logs técnicos são instrumentos internos de rastreabilidade e auditoria, relevantes para os princípios de segurança e responsabilização. Eles não se confundem com a transparência voltada ao titular, que exige comunicação ativa e inteligível sobre o tratamento.

**Alternativa 4 — Criptografar dados de forma oculta:** Incorreta. A criptografia é uma medida de segurança que protege os dados de acessos não autorizados — ela serve ao princípio da segurança (Art. 6º, VII), não ao da transparência.

---

## Questão 15 — Qual é o principal objetivo da LGPD?

**Alternativa correta: 3 — Garantir a privacidade como direito fundamental**

O objetivo central da LGPD está enunciado já em seu Art. 1º: a lei dispõe sobre o tratamento de dados pessoais com o fim de proteger os direitos fundamentais de liberdade e de privacidade e o livre desenvolvimento da personalidade da pessoa natural. Essa formulação posiciona a privacidade não como uma conveniência contratual ou uma obrigação burocrática, mas como um direito fundamental do cidadão. Os fundamentos do Art. 2º reforçam essa orientação ao listar, entre os pilares da lei, o respeito à privacidade, a autodeterminação informativa, a dignidade da pessoa humana e os direitos humanos. Isso tem uma consequência prática importante: a LGPD não nasceu para travar o uso de dados ou inviabilizar a inovação tecnológica — ela nasceu para estabelecer as condições sob as quais dados pessoais podem ser usados de forma legítima, responsável e equilibrada. Para profissionais de tecnologia, esse objetivo maior é a bússola que orienta todas as demais obrigações da lei.

**Alternativa 1 — Controlar apenas dados de grandes empresas:** Incorreta. A LGPD aplica-se a qualquer pessoa física ou jurídica, de direito público ou privado, que realize tratamento de dados pessoais no Brasil — independentemente do porte, do setor ou da natureza da organização.

**Alternativa 2 — Substituir o Marco Civil da Internet:** Incorreta. A LGPD e o Marco Civil da Internet (Lei nº 12.965/2014) são legislações complementares, não excludentes. O Marco Civil estabelece princípios e deveres para o uso da internet no Brasil; a LGPD regulamenta especificamente o tratamento de dados pessoais. Ambas coexistem no ordenamento jurídico brasileiro.

**Alternativa 4 — Proibir o uso de dados pessoais:** Incorreta. A lei não proíbe o tratamento de dados pessoais — ela o regulamenta. Um dos fundamentos explícitos da LGPD é justamente o desenvolvimento econômico e tecnológico (Art. 2º, V), reconhecendo que o uso responsável de dados é legítimo e necessário para a inovação.
