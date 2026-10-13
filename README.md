# Sistema de Análise de Fichas de EPI

Primeira versão para transcrever fichas existentes e analisar os intervalos de substituição por trabalhador. Backend em Google Apps Script, frontend HTML/CSS/JavaScript e persistência em Google Sheets. Não controla estoque nem entrega de equipamentos.

## Estrutura

```text
src/
  domain/analysis.js       # Regras puras compartilhadas entre Node, navegador e GAS
  domain/catalog-import.js # CSV, normalização e validação da base oficial
  server/api.js           # Funções RPC, análise e gravação de fichas
  server/store.js         # Adaptador Google Sheets, lock e recuperação de gravação
  server/catalog.js       # Prévia/importação e leitura da base, separadas da vida útil
  server/setup.js         # Criação privada da planilha e verificação da conexão
  web/Index.html          # Ficha, resultados e administração
  web/app.js              # Digitação rápida, rascunhos e integração google.script.run
  web/styles.css          # Layout responsivo
  appsscript.json         # V8, timezone e configuração de acesso pessoal
scripts/
  build.js                # Gera dist/*.gs e Index.html completo
  dev.js                  # Demonstração no próprio computador
  smoke-ui.js             # Verificação da interface com dados fictícios
tests/                   # Testes de domínio e backend com serviços simulados
google-apps-script/       # Arquivos gerados prontos para colar no editor Google
docs/GOOGLE-SETUP.md      # Ativação da parte 2, pelo navegador ou clasp
.clasp.example.json       # Modelo sem credenciais
```

`dist/` é gerado e ignorado no Git. A tela Relatórios / PDFs consolida fichas com filtros e gera PDFs pela impressão local do navegador, com o logo SESI incorporado. A atualização administrativa prepara o arquivo oficial `.csv.gz` validado. Os módulos de análise, catálogo e persistência permitem evoluí-los sem misturar a interface com regras técnicas.

## Empresa, vida útil rápida e PDFs

Consulte [REPORTS.md](docs/REPORTS.md) para atualizar a aplicação já implantada, preservar os dados e usar os filtros de relatórios. A atualização adiciona colunas de empresa/horário e o script ReportDomain.

## Base oficial e atualização pelo administrador

O pacote inclui **42.478 CAs** da exportação oficial `RelatorioCA_20261013_150911.csv.gz`, com validade e situação oficial. A maior validade é selecionada junto com nome, proteção e situação das linhas correspondentes, sem misturar versões históricas. O CA 40355 mantém 26/05/3031.

Use [UPDATE-OFFICIAL-BASE.md](docs/UPDATE-OFFICIAL-BASE.md) para atualizar a implantação existente em uma única versão. O administrador executa `adminUpdateOfficialBase` no editor Apps Script; a função prepara em lotes, guarda a base anterior e preserva fichas e vidas úteis. Uma execução posterior com o mesmo pacote é idempotente. A abertura normal do sistema não carrega nem substitui o catálogo.

O usuário vê apenas a data da última atualização concluída, sem a seção Base e conexão. Os próximos arquivos podem permanecer `.csv.gz`: `scripts/prepare-official-base.py` valida gzip/CRC e CSV, separa o HTML extra do download e gera os blocos do catálogo. O script usa a biblioteca padrão do Python e não precisa de Excel.

Resultados e PDF compartilham grupos e ordem cronológica, com Resultado na última coluna, Marco inicial no intervalo e símbolos/cores para periodicidade. CAs vencidos ficam vermelhos; vencimento entre hoje e 30 dias recebe aviso amarelo. Suspensão/cancelamento continuam explícitos mesmo com data futura. O PDF mantém filtros e geração, sem origem, referência da base ou horários de salvamento.

## Desenvolvimento local

### Testar agora, sem Node.js ou conta Google

No GitHub, use **Code → Download ZIP**, extraia o ZIP e abra o arquivo **`demo.html`** no Chrome ou Edge. O arquivo é completo, funciona localmente e não envia os dados digitados para um servidor. Use somente pessoas fictícias para os testes.

A interface desse arquivo foi verificada servindo-o por HTTP local. A abertura direta por `file://` não pôde ser testada neste ambiente porque a política do navegador a bloqueia. Se o navegador do seu computador também restringir arquivos locais, use a opção com Node.js abaixo.

Preencha os dados do trabalhador e experimente o CA **90001** com entregas em **01/01/2026** e **01/05/2026**: a segunda entrega terá intervalo de **120 dias**, fora do prazo fictício de 90 dias. Para a sequência dérmica, use **90002** em **01/01/2026** e **90003** em **01/02/2026**: intervalo de **31 dias**, fora do prazo fixo de 30 dias.

Você pode corrigir lançamentos, cadastrar vida útil e alternar trabalhadores. Os rascunhos ficam neste navegador e neste arquivo; mover o arquivo ou trocar de navegador pode alterar o acesso ao armazenamento local. O botão de salvar na planilha informa que essa função depende da implantação no Apps Script.

`demo.html` é uma exportação gerada, incluída no repositório para facilitar o teste. Não edite esse arquivo manualmente; após alterações em `src/`, execute `npm run demo` para atualizá-lo. O build do Apps Script continua separado, em `dist/`.

### Desenvolvimento com Node.js

Requisitos: Node.js 22 ou superior e npm. Não há serviços pagos nem dependências de produção no frontend.

```sh
npm ci --cache /workspace/.npm-cache
npm run check
npm run dev
```

Fora do ambiente na nuvem, pode omitir a opção `--cache`. A demonstração escuta apenas a interface de loopback, porta 3000. Usa CAs **fictícios** 90001 (auditivo), 90002 (luva química), 90003 (creme) e 90004 (luva mecânica). Nunca os utilize como dados oficiais. A persistência da demonstração é apenas `localStorage`; não simula uma conexão bem-sucedida ao Google Sheets.

Fluxo: preencha empresa, nome, setor, cargo e GES; digite CA → Enter → data DD/MM/AAAA → Enter. Os campos são limpos e o foco volta ao CA. A máscara aceita oito dígitos, inclusive datas coladas. A vida útil em dias é opcional no lançamento rápido; quando preenchida, é salva no cadastro de prazos por CA. Editar e excluir mantêm a sequência original de digitação; apenas o resultado é ordenado por data. Nenhuma consulta de CA ocorre enquanto se digita.

“Novo trabalhador” cria IDs distintos de ficha e trabalhador. O rascunho anterior permanece na sessão. A lista agrupa as fichas por GES para navegação. Fichas podem ser salvas como em andamento ou concluídas e continuam editáveis. “Reabrir ficha da planilha” permite resolver conflito entre sessões, mediante descarte explícito do rascunho dessa ficha. Salvar novamente o mesmo ID atualiza a ficha, sem duplicá-la. Pessoas homônimas não são mescladas automaticamente.

## Testes

```sh
npm test
npm run build
# Com Chromium do sistema:
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
# Em máquina sem Chromium, instalar o navegador do Playwright:
npx playwright install chromium
npm run test:ui
```

Os testes de Node cobrem primeira entrega, intervalos consecutivos, troca antecipada e tardia, mudança de CA, vida útil do CA anterior, luva/creme em ambas as ordens, datas fora de ordem, datas inválidas, mesmo dia, vida útil ausente, CA desconhecido e grupos intercalados. Também verificam metadados, separação entre validades, retomada de ficha, IDs, conflitos de revisão e recuperação de falha de gravação com mocks.

O teste de navegador usa um servidor temporário e somente pessoas fictícias; verifica teclado, máscara, edição, exclusão, rascunho após recarga, múltiplos trabalhadores, administração, resultados e ausência de transbordamento em viewport móvel.

**Não verificado nesta entrega:** autenticação Google, acesso real ao Sheets, locks/quota de produção e implantação real. Os mocks não substituem essas verificações.

## Parte 2: Google e base real

Siga o [guia de ativação](docs/GOOGLE-SETUP.md) para usar o editor Google sem instalar ferramentas ou para conectar pelo clasp. A função `initializeApplication` cria uma planilha privada e persiste o ID; é repetível e não substitui uma planilha existente por falha de acesso. A administração da base acontece no editor, por `adminUpdateOfficialBase`; a tela de uso apresenta apenas a última atualização.

O pacote `google-apps-script/` é gerado com `npm run google:bundle`. Após modificar `src/`, atualize esse pacote e a demonstração (`npm run demo`); não edite os arquivos exportados manualmente. A inicialização/build padrão não envia arquivos ao Google.

A preparação oficial valida o formato completo da exportação, preserva situação e aceita validade de CA até 9999. Repetições são consolidadas pela maior validade com campos associados. Os metadados registram origem, geração, atualização e SHA-256; os blocos têm checksum verificado no build e no servidor.

A demonstração e a aplicação Google usam espaços diferentes de rascunho local. Catálogo vazio na aplicação Google bloqueia a análise, sem recorrer aos CAs fictícios. O catálogo completo não é enviado ao navegador no bootstrap; as análises consultam somente os CAs lançados.

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:google-ui
```

Esse teste verifica o fluxo de RPC com backend real e serviços Google **simulados**, incluindo importação, cadastro de prazo, salvar/retomar e base vazia. Não verifica a implantação Google.

## Configuração manual alternativa — acesso privado

Execute estes passos em sua própria conta Google. Nenhum projeto foi criado ou publicado automaticamente.

1. Crie uma planilha **privada**, dedicada ao projeto. Não use uma planilha contendo dados preexistentes nas abas abaixo: a aplicação administra integralmente essas tabelas.
2. Crie um projeto **standalone** no Apps Script. Ative a API do Apps Script nas configurações pessoais se necessário para usar o clasp.
3. Configure `SPREADSHEET_ID` em **Configurações do projeto → Propriedades do script**, usando o ID da sua planilha. O valor não deve ir para o Git nem ser enviado no chat.
4. Autentique o clasp localmente com `npm run clasp -- login`. Se o ambiente não permitir OAuth interativo, faça a autenticação e publicação no seu computador. Não copie arquivos de token para o repositório.
5. Copie `.clasp.example.json` para `.clasp.json`, informe o ID do projeto e mantenha `rootDir` como `dist`. Esse arquivo está ignorado pelo Git.
6. Execute `npm run build` e `npm run clasp -- push`. Use um projeto dedicado: o push envia os arquivos gerados para o Apps Script. Revise o manifesto antes de prosseguir.
7. No editor do Apps Script, execute `setupDatabase` uma vez e autorize apenas o acesso necessário às planilhas. A função pode ser repetida e preserva tabelas existentes com cabeçalhos compatíveis; cabeçalhos inesperados provocam erro.
8. Para sua verificação pessoal, crie uma implantação de aplicativo web: **executar como usuário que acessa** e **acesso somente você**. O manifesto registra `USER_ACCESSING` / `MYSELF`; confirme essas opções no diálogo. **Não selecione acesso público, anônimo ou aberto a qualquer conta.**
9. Acesse a implantação privada, cadastre uma pessoa fictícia, salve, recarregue e reabra a ficha da planilha. Cadastre um prazo, valide a análise com CAs de referência e confirme que ele permanece após a atualização da base. Esses passos precisam ser executados para validar a integração real.

Nesta versão de uso pessoal, o proprietário também administra os prazos. Autorização por perfis e acesso de uma equipe exigem trabalho adicional antes de ampliar a implantação. A aplicação não cria compartilhamentos de planilha.

## Tabelas e base oficial

`setupDatabase` cria as abas e os cabeçalhos:

| Aba | Colunas |
| --- | --- |
| Workers | id, name, sector, role, ges, company |
| Sheets | id, workerId, state, updatedAt, revision |
| Entries | id, sheetId, ca, date, physicalExpiry (legado), position, savedAt |
| Lifetimes | ca, days |
| CaIndex | ca, name, approvedProtection, caExpiry, caSituation |
| Metadata | source, referenceDate, updatedAt |
| CaDefaultStage | ca, name, approvedProtection, caExpiry, caSituation |
| CaDefaultBackup | ca, name, approvedProtection, caExpiry, caSituation |

O arquivo oficial bruto fica fora do Git. O catálogo compactado publica somente CA, nome, proteção, validade e situação, sem CNPJ ou dados de fabricantes/laboratórios. A atualização administrativa migra cabeçalhos antigos conhecidos sem apagar registros.

Antes de colar, formate essas colunas como **texto simples**, especialmente CA e datas. Datas devem ser `DD/MM/AAAA`; não cole objetos de data do Sheets ou fórmulas. Use uma linha por CA, sem duplicatas. Registre em uma única linha de `Metadata` a fonte oficial (URL ou identificação da publicação), a data de referência do conjunto em `referenceDate` e o instante da atualização em `updatedAt` (texto ISO). Não insira pessoas nem dados pessoais nessas abas de catálogo.

Atualizações de `CaIndex` e `Metadata` **não devem apagar `Lifetimes`**. A vida útil é um parâmetro técnico independente do certificado. Os dados de teste/demonstração nunca são inseridos automaticamente na planilha de produção.

A inclusão nos grupos com análise de periodicidade considera **proteção aprovada**; o nome pode identificar os demais EPIs fora do escopo. Proteção auditiva explícita entra na sequência auditiva; proteção química explícita das mãos, pele ou membros superiores entra na dérmica. Luvas apenas mecânicas ficam em demais EPIs. Para EPIs claramente fora do escopo (como capacetes, óculos, vestimentas e luvas explicitamente mecânicas), basta o nome, mesmo sem proteção aprovada. Luvas químicas, cremes e protetores auditivos sem proteção confiável, nomes indefinidos e CAs desconhecidos continuam pendentes de revisão. A identificação conservadora por texto requer validação com o vocabulário real da base oficial antes de uso técnico. A primeira versão sinaliza revisão manual, sem editar a classificação oficial pela interface.

## Regras e limites técnicos

- Auditivos: uma sequência por trabalhador, usando o prazo do CA **da entrega anterior**. Mudança de CA não interrompe a sequência. Sem prazo, “Vida útil não cadastrada”.
- Dérmicos químicos: luvas e cremes na mesma sequência; limite fixo de 30 dias, inclusive.
- Primeira entrega: marco inicial. Mesma data: intervalo zero, com desempate pela ordem original. Cada entrega reinicia a contagem, sem acumulação.
- Demais EPIs: identificação e validades, sem análise de periodicidade.
- CA não identificado: revisão necessária e aviso de análise parcial, pois o registro pendente pode alterar os intervalos.
- Validade do CA, vida útil e validade física são campos distintos. A comparação com a validade informada do CA não comprova aquisição irregular, inadequação ou validade física.
- Referência superior a 30 dias, futura ou ausente gera aviso de confirmação. Esse corte é uma política informativa desta versão, **não um prazo legal**. Mesmo dados recentes não garantem a situação atual do CA.
- Não há cálculo de cobertura após a última entrega, conclusão automática de conformidade global nem avaliação de adequação do equipamento aos riscos.
- Entregas são comparadas em UTC por dias de calendário, com anos de 1900 a 2100. Validades de CA admitem anos de 1900 a 9999. Avisos de vencimento usam o dia atual em Brasília. Vida útil aceita inteiros de 1 a 36500 dias.

## Persistência, privacidade e limitações

Vidas úteis são mantidas no cadastro local e recuperadas de `Lifetimes`, com autopreenchimento nos próximos lançamentos. As fichas ficam em `localStorage` no navegador e, quando solicitada a gravação, no Sheets. Não existe sincronização automática do rascunho; a confirmação “salva na planilha” ocorre somente após resposta do servidor. Conflitos de revisão impedem sobrescrita silenciosa. Leitura e escrita usam lock do script. As gravações possuem recuperação da versão anterior em caso de erro capturável, mas **Google Sheets não oferece transações entre abas**: interrupção abrupta ou falha de recuperação pode exigir intervenção manual. Faça backup da planilha antes de atualizações relevantes.

O armazenamento regrava tabelas inteiras: adequado a uma primeira versão pequena, sujeito às quotas do Apps Script. Paginação, otimização incremental, trilha de auditoria e backups automáticos são melhorias futuras. A vida útil atual é aplicada a toda análise; não existe histórico de vigência dos parâmetros. Nome e GES não deduplicam pessoas; os IDs identificam a ficha e o trabalhador.

Rascunhos não são criptografados pela aplicação. Em computador compartilhado, salve na planilha e apague os dados locais antes de sair. Não publique capturas, planilhas, logs ou repositórios contendo dados pessoais. Texto inserido pelo usuário é exibido via `textContent`; valores textuais enviados à planilha recebem proteção contra interpretação como fórmula.

## Próximas etapas

1. Executar a validação real, pessoal e privada no Apps Script/Sheets.
2. Evoluir atualização incremental e ferramentas de administração da base oficial.
3. Evoluir classificação assistida e resolução de CAs pendentes, com registro de justificativa.
4. Evoluir a governança de acesso aos relatórios antes do uso por equipe.
