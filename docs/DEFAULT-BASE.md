# Base padrão e consulta de atualizações

## Atualizar sua aplicação já implantada

Use **o mesmo projeto Apps Script, a mesma planilha e a implantação existente**.

1. Baixe a versão mais recente do repositório. A pasta `google-apps-script/` contém os arquivos completos.
2. Atualize os seis scripts existentes (`Domain`, `ImportDomain`, `Store`, `Catalog`, `Api`, `Setup`) e o HTML `Index` com os conteúdos correspondentes.
3. Acrescente os scripts adicionais que ainda não existirem: **DefaultData**, **DefaultCatalog**, **UpdateDomain**, **OfficialUpdates** e **ReportDomain**. Cole o conteúdo completo dos `.gs` correspondentes. `DefaultData` é grande porque contém a base comprimida; não edite ou recorte seus blocos de dados.
4. Atualize `appsscript.json`. Ele mantém o acesso pessoal e acrescenta a permissão `script.external_request` para consultar as páginas oficiais. Autorize a nova permissão na sua própria conta quando o Google solicitar.
5. Execute **initializeApplication**. O ID da planilha atual é reutilizado e são criadas duas tabelas auxiliares para preparar e recuperar o catálogo e acrescentadas as colunas de empresa/horário nas tabelas legadas. Para uma aplicação que já usa a base padrão, veja [REPORTS.md](REPORTS.md).
6. Abra **Implantar → Gerenciar implantações**, edite a implantação existente e selecione **Nova versão**. Mantenha execução como usuário que acessa e acesso somente você.
7. Reabra a aplicação e vá a **Base e conexão**. Se o catálogo estiver vazio, o carregamento continua automaticamente em etapas. Mantenha a aba aberta até aparecer **36.136 CAs**. Se uma chamada falhar ou a aba for fechada, use **Carregar ou retomar base padrão**.
8. Se já houver um catálogo, ele é mantido. Para aplicar as validades corrigidas do pacote v2, atualize também **DefaultData**, **DefaultCatalog**, **Domain**, **ImportDomain** e **Index**, e use **Carregar ou retomar base padrão** com confirmação. A tela informa quando uma base padrão anterior está carregada e há um pacote novo disponível. Para usar a base padrão em seu lugar, clique no mesmo botão e confirme a substituição apresentada. Fichas, trabalhadores, lançamentos e prazos de vida útil são preservados.

O comando `npm run google:bundle` gera a exportação para o editor a partir das fontes e dos arquivos comprimidos. Quem usa clasp pode enviar `dist/` após `npm run build`; o build não publica nem atualiza a implantação sozinho.

## O que veio no arquivo enviado

Arquivo: **cadastro-EPI-final.xlsx**, fornecido pelo usuário.

| Medida | Quantidade |
| --- | ---: |
| Linhas de dados | 106.198 |
| CAs consolidados | 36.136 |
| Repetições por CA consolidadas | 70.062 |
| Linhas com proteção/alinhamento que exigiram revisão | 46.769 |
| CAs sem proteção aprovada recuperável com segurança | 16.359 |
| CAs com datas divergentes, resolvidos pela maior data | 19 |

O XLSX apresenta repetições por laudos/normas e campos deslocados em parte das linhas. O processamento usa apenas CA, nome do equipamento, proteção aprovada e validade. Não exporta CNPJ, razão social, fabricantes, laboratórios, processos nem dados de trabalhadores.

A projeção é conservadora: para recuperar a proteção aprovada, exige alinhamento reconhecível de natureza e laboratório, além de texto iniciado por “PROTEÇÃO” no campo esperado. Dados que não atendem ao critério não são reconstruídos por adivinhação. Quando há registros alinhados do mesmo CA, seus textos oficiais são mantidos; sem texto confiável, a proteção fica vazia. Isso exige revisão para grupos analisados ou nomes indefinidos, mas não para EPIs reconhecidos pelo nome como fora do escopo. Nomes distintos recuperados são preservados em conjunto. Para registros do mesmo CA com validades diferentes, é usada a maior data válida de calendário, conforme regra solicitada pelo usuário. Isso não confirma a situação atual do certificado nem representa a data de atualização oficial da base.

A entrada nos grupos auditivo e dérmico químico ainda depende da proteção explícita recuperada. EPIs reconhecidos como fora do escopo podem aparecer só pelo nome; não se inventa texto de proteção aprovada. A regra reduz os pendentes de 16.359 para **1.406 CAs**. A base não torna automaticamente conformes todos os equipamentos. Os CAs pendentes continuam aparecendo pelo número e pelo nome disponível, com alerta de análise parcial.

### Referência temporal e origem

A propriedade interna do XLSX indica **16/08/2022** como data de modificação. **Essa propriedade não comprova a data de extração, publicação ou atualização dos registros.** A referência oficial permanece vazia, e a aplicação continua exigindo confirmação da situação atual dos CAs. A origem registrada é o arquivo fornecido pelo usuário; seu SHA-256 permite identificar exatamente o arquivo usado.

A procedência online e a atualidade do arquivo não foram autenticadas neste ambiente. O timestamp de carga (`updatedAt`) registra quando o sistema gravou o catálogo, e não quando o Ministério o atualizou.

Os registros normalizados estão em `data/default-ca/`, em blocos gzip com checksums. `scripts/prepare-default-base.py` reproduz a projeção usando Python e openpyxl 3.1.5; o XLSX original não está no Git. Esses programas leem valores, sem executar fórmulas da planilha. O build e o servidor conferem os checksums dos blocos.

## Como o carregamento funciona

O servidor prepara até quatro blocos de 500 CAs por chamada. Cada bloco é gravado em uma posição conhecida de `CaDefaultStage`; repetir uma chamada interrompida não duplica registros. O catálogo completo só é disponibilizado ao concluir a preparação, e análises ficam bloqueadas enquanto o carregamento estiver ativo.

Antes de uma substituição confirmada, o catálogo anterior é copiado para `CaDefaultBackup`. Os metadados anteriores são mantidos no estado de preparação para recuperação de erros capturáveis. Google Sheets continua sem transações entre tabelas; uma interrupção abrupta na gravação final pode exigir retomada ou inspeção manual. As duas tabelas auxiliares são reservadas ao sistema: não as edite durante uma carga. Fichas e vida útil não participam desse processo.

Se trocar `DefaultData` durante uma carga incompleta por outra versão, o sistema bloqueia a mistura de blocos. Conclua a carga com a versão original antes de atualizar o pacote. Evite importação manual simultânea ou alterações diretas no catálogo durante a preparação.

## Campo “Buscar atualizações”

Na seção **Base e conexão**, o campo **Página oficial de publicação ou pesquisa** permite informar uma URL HTTPS de `www.gov.br`, `caepi.mte.gov.br` ou `caepi.trabalho.gov.br`. A sugestão inicial é a [página oficial de EPI do Ministério](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/equipamentos-de-protecao-individual), consultada com HTTP 200 em 08/10/2026. Ela indica a base no portal `https://caepi.trabalho.gov.br/internet/ConsultaCAInternet.aspx`, além de links HTTP legados para `caepi.mte.gov.br`. A aplicação usa somente HTTPS.

O botão:

- consulta a página informada com TLS verificado;
- aceita redirecionamentos apenas para os três hosts oficiais permitidos;
- identifica links relevantes para XLS/XLSX, CSV, ZIP ou TXT e o portal oficial de exportação/consulta indicado pelo Ministério;
- exibe os links, a data/hora da consulta e os limites da verificação;
- informa bloqueio HTTP 403, indisponibilidade ou ausência de arquivos identificáveis.

Um arquivo encontrado não comprova que ele é mais recente que o arquivo incluído. A data de uma página, a data de consulta e uma data no nome de um arquivo não comprovam a referência da base. A aplicação **não afirma “base atualizada”** com base nesses sinais e não substitui dados automaticamente.

O botão não baixa ou importa os arquivos candidatos, não consulta CAs durante a digitação e não contorna bloqueios. Se a fonte negar acesso, abra o link oficial no navegador e obtenha o arquivo pelo canal disponibilizado pelo órgão. Um HTML de portal genérico pode não conter o download; informe a página de publicação adequada.

A importação CSV existente continua limitada a 10.000 registros/10 MB por substituição. A base padrão completa usa o mecanismo próprio de carga em etapas. Atualizar todo o pacote a partir de outro XLSX exige uma nova projeção validada; não importe um recorte para completar parcialmente o catálogo atual, pois o importador CSV substitui o catálogo inteiro.

## Evidência e limitações de validação

Quatro testes Python com dados fictícios verificam a projeção e os casos de colunas deslocadas/repetições/conflitos. Execute `python -m unittest discover -s tests -p 'test_*.py'` em um ambiente com openpyxl 3.1.5.

Os testes de Node verificam o pacote real completo, checksums, unicidade dos CAs, datas, retomada, substituição explícita, recuperação de falha e comportamento diante de 403/redirecionamentos. O teste de navegador `SMOKE_DEFAULT_BASE=1 CHROMIUM_PATH=/usr/bin/chromium npm run test:google-ui` carrega os 36.136 CAs com serviços Google simulados e exercita a tela de consulta com respostas simuladas.

O usuário informou que a implantação anterior foi inicializada e funciona. A nova versão ainda precisa ser aplicada e validada em sua conta. A página oficial de EPI do Ministério foi consultada com HTTP 200 neste ambiente após a reconexão. O extrator identificou o portal atual de dados CAEPI nessa resposta real. O acesso direto ao host caepi.trabalho.gov.br foi negado pelo proxy de rede (CONNECT 403); isso não é uma resposta 403 comprovada do próprio CAEPI. Não foi possível consultar o conteúdo exportável desse portal nem confirmar um arquivo mais recente. Os três hosts foram registrados no rascunho da configuração para revisão. A consulta feita pelo Apps Script usa a rede do Google, sujeita às respostas e restrições da fonte.
