# Atualizar a base oficial e a aplicação existente

## Ajustes de relatório e periodicidade de 14/10/2026

Se a versão anterior já foi aplicada, substitua somente **Domain.gs** e o HTML **Index** pelos arquivos atuais de `google-apps-script/`. Depois publique uma **Nova versão** da implantação existente. Não é necessário recarregar a base, executar `adminUpdateOfficialBase` ou modificar a planilha. A ordem por empresa, GES e trabalhador já existe em `ReportDomain` da versão anterior. Os novos totais de classificação em `DefaultData` são apenas informativos; não exigem substituir esse arquivo para aplicar os ajustes.

O pacote já contém o arquivo `RelatorioCA_20261013_150911.csv.gz` processado em **42.478 CAs**. Você pode manter o formato original `.csv.gz` para próximas atualizações. Não abra e salve pelo Excel: o administrador prepara diretamente o arquivo oficial, sem alterar suas colunas manualmente.

## Aplicar esta versão pelo navegador

Use o mesmo projeto Apps Script, a mesma planilha e a implantação existente.

1. Baixe o ZIP atualizado do repositório. Na pasta **google-apps-script/**, copie o conteúdo de cada `.gs` para o script correspondente no editor Google. Os nomes são **Domain, ReportDomain, ImportDomain, Store, Catalog, Api, Setup, DefaultCatalog, DefaultData, UpdateDomain e OfficialUpdates**. Crie somente os que ainda não existem. Substitua também o HTML **Index** pelo `Index.html` completo do pacote. `DefaultData` contém a base compactada; não recorte seus blocos.
2. Mantenha a propriedade **SPREADSHEET_ID** atual. Não crie outra planilha nem altere as abas manualmente.
3. Selecione **adminUpdateOfficialBase** no editor e clique em **Executar**. Essa operação do administrador migra os cabeçalhos antigos conhecidos, prepara os dados, guarda a base anterior em `CaDefaultBackup` e substitui apenas o catálogo e seus metadados. Preserva trabalhadores, fichas, lançamentos, horários e vidas úteis.
4. Confira o registro da execução: **status: ready**, **total: 42478**. A função trabalha em lotes e reserva tempo para concluir a gravação. Se retornar **pending**, execute a mesma função novamente para continuar de onde parou. Executá-la depois de concluída, com o mesmo pacote, não recarrega a base e não altera a data de atualização. Se já havia uma carga antiga incompleta, conclua-a usando o pacote antigo antes de trocar `DefaultData`.
5. Abra **Implantar → Gerenciar implantações**, edite a implantação existente e selecione **Nova versão**. Mantenha execução como usuário que acessa e acesso somente você. Reabra a mesma URL da aplicação.

A tela de uso mostra apenas **Última atualização da base**, com a data da gravação concluída pelo administrador, no fuso de Brasília. Não contém a seção Base e conexão, origem, importação ou consulta de atualização. Abrir a aplicação não carrega, substitui ou atualiza a base.

A autorização Google e a implantação são feitas na sua conta; os testes do repositório simulam os serviços Google, sem atualizar sua planilha real.

## Próximos arquivos baixados do CAEPI

Baixe o arquivo pelo botão **Base de dados do sistema CAEPI (Download)** em:

https://caepi.trabalho.gov.br/internet/ConsultaCAInternet.aspx

O nome tem data e horário de geração. Esse botão faz um postback do formulário; não é um endereço estático de download. Guarde o arquivo original para rastrear a atualização.

Em um computador com Python 3, Node >=22 e as dependências do projeto instaladas, execute na pasta do repositório:

```sh
python scripts/prepare-official-base.py "RelatorioCA_AAAAMMDD_HHMMSS.csv.gz"
npm run google:bundle
npm run demo
```

Use o nome real do arquivo. No Windows, `py` pode substituir `python`. O preparador oficial usa apenas a biblioteca padrão do Python. Se o arquivo foi renomeado e perdeu o padrão oficial, informe a data de extração:

```sh
python scripts/prepare-official-base.py "arquivo.csv.gz" --reference-date 13/10/2026
```

Depois, atualize **DefaultData** no editor Google e execute **adminUpdateOfficialBase**. Se o código da aplicação também mudou, atualize os scripts e publique uma nova versão como acima. A preparação local não envia código nem grava no Google. Não use o importador antigo de recortes de CSV para preencher a base em lotes que se substituem.

## O que o tratamento preserva

- O fluxo gzip é validado, incluindo seu CRC. O download oficial recebido tem HTML depois do membro gzip; esse conteúdo é identificado e separado, sem execução. Apenas o CSV entra no catálogo.
- As 19 colunas são lidas com regras de CSV para aspas, separadores e quebras de linha. Cabeçalhos diferentes, linhas deslocadas, CAs inválidos, datas inexistentes e situações desconhecidas bloqueiam a preparação.
- Um CA repetido é consolidado pela **maior data de validade**. Nome, proteção e situação vêm das linhas dessa data; não são misturados com campos de versões anteriores. Situações divergentes na mesma maior data bloqueiam a preparação.
- O catálogo compactado contém somente **CA, nome, proteção aprovada, validade e situação oficial**. Não publica empresas fabricantes, CNPJ, laboratórios ou processos.
- O CA **13990** vem do CSV como válido até **22/08/2028**, sem correção manual. O CA **40355** mantém **26/05/3031**, conforme portal e confirmação do usuário.
- SHA-256, origem e data de geração ficam nos metadados de administração. A data mostrada ao usuário é a última atualização concluída, não a data de validade ou a referência do arquivo.

O arquivo recebido tem 123.890 linhas, 42.478 CAs, 22 CAs com validades diferentes e nove com situações históricas diferentes. Pelo classificador atual, apenas três CAs permanecem pendentes por proteção insuficiente: 11324, 15160 e 19924. Esses dados não mudam as regras de vida útil.

## Resultados e PDF

As entregas são exibidas em **proteção dérmica, proteção auditiva e outras entregas**, com datas do mais antigo ao mais novo dentro de cada grupo. O cálculo considera a sequência completa antes do filtro de período. “Marco inicial” aparece no intervalo apenas na primeira entrega real do grupo; não é atribuído à primeira linha de um período filtrado.

A coluna **Resultado** é a última. Na aba Resultados, a coluna Limite foi removida; o PDF mantém essa coluna. O cabeçalho do PDF é **Análise entregas de EPI** e as fichas são ordenadas por empresa, GES e nome do trabalhador. Somente luvas e cremes com proteção química aprovada participam da periodicidade dérmica; os demais EPIs ficam em outras entregas. **✓ Dentro do prazo** é verde e **✕ Fora do prazo** é vermelho. A vida útil do CA da entrega anterior define o limite auditivo; a proteção dérmica química continua com limite fixo de 30 dias.

A coluna de CA compara a validade com **o dia atual em Brasília**, independentemente da data histórica da entrega:

- **CA vencido** em vermelho quando a data já passou.
- **Próximo ao vencimento** em amarelo nos dias zero a 30, inclusive.
- **CA suspenso** ou **CA cancelado** em vermelho, mesmo com prazo futuro.
- A situação oficial declarada prevalece sobre uma data futura; prazo futuro sozinho não comprova situação ativa.

No dia do vencimento, o download e a consulta individual do CAEPI apresentaram divergências. O sistema usa o aviso de proximidade nesse dia, em vez de declarar automaticamente vencido pelo CSV. Não inventa uma nova validade. Situações suspensa/cancelada continuam prevalecendo.

O PDF usa a mesma ordem, colunas, cores e símbolos. Mantém trabalhador, empresa, setor, cargo, GES, filtros e geração do relatório; não exibe base, conexão, origem, data de referência nem horários de salvamento. Para gravar, escolha **Salvar como PDF** e desative cabeçalhos/rodapés do navegador se estiverem habilitados. Os símbolos e textos continuam distinguíveis em impressão sem cores.

O logo original `SESI_logo.png`, na raiz do repositório, fica incorporado no HTML gerado e no cabeçalho do relatório. Não depende de uma URL externa nem exige upload separado no Apps Script. Mantenha esse arquivo ao gerar futuros pacotes.

## Vida útil persistente

Ao cadastrar um prazo na aplicação Google, a gravação em `Lifetimes` é confirmada antes de atualizar o cadastro local. O mesmo cadastro é mantido no navegador e recuperado da planilha ao abrir a aplicação. Ao digitar um CA já cadastrado, o prazo aparece automaticamente no lançamento rápido, sem consulta ao catálogo de CAs durante a digitação.

Atualizar a base não apaga `Lifetimes`. Na demonstração standalone, os dados são fictícios e os prazos ficam somente no navegador. Na aplicação Google, falhas de conexão não são apresentadas como gravação bem-sucedida: tente salvar novamente quando a conexão voltar.
