# Parte 2 — Google e base real de CAs

Para uma aplicação já implantada, veja também [REPORTS.md](REPORTS.md) para atualizar empresa, vida útil rápida e PDFs.

O código de conexão e importação está preparado. A ativação exige sua autorização na conta Google e o arquivo oficial. Nenhum teste local autoriza acesso à conta e nenhuma implantação real foi feita pelo Codex.

## Opção A: pelo navegador

Para um projeto existente, siga [UPDATE-OFFICIAL-BASE.md](UPDATE-OFFICIAL-BASE.md): mantenha a planilha e a implantação atuais.

Para um projeto novo:

1. Crie um projeto privado em https://script.google.com/ e copie todos os scripts de `google-apps-script/`, o HTML Index e o manifesto `appsscript.json`.
2. Execute **initializeApplication** para criar a planilha privada e persistir SPREADSHEET_ID. Não há carga de base ao abrir o sistema.
3. Execute **adminUpdateOfficialBase** até o registro informar ready e 42.478 CAs. A inicialização e a carga preservam um ID de planilha já configurado; ID inacessível gera erro, não outra planilha.
4. Execute **verifyApplicationConnection** no editor para conferir os dados.
5. Implante como aplicativo da web, executando como usuário que acessa e com acesso somente você. Mantenha as autorizações na sua própria conta.

O sistema apresenta somente a data da última atualização administrativa. SPREADSHEET_ID é propriedade do projeto, não uma chave de API do frontend.

## Opção B: clasp no seu computador

Requisitos: Node >=22, npm, conta Google e Apps Script API habilitada em `https://script.google.com/home/usersettings`.

```sh
git clone https://github.com/felipeoliveira0211/analise-fichas-epi.git
cd analise-fichas-epi
npm ci
npm run build
npm run clasp -- login
```

A autenticação abre seu navegador; mantenha o token no seu computador. O clasp é uma dependência local, sem necessidade de instalar globalmente.

### Projeto existente

Copie `.clasp.example.json` para `.clasp.json`. Preencha `scriptId` com o ID do projeto, encontrado nas configurações do Apps Script. Mantenha `rootDir: "dist"`. Não confunda o ID do script, o ID da implantação e o ID da planilha.

### Criar projeto com clasp 3.2.0

Use uma pasta vazia temporária para impedir que `clasp create` escreva um manifesto inicial por cima do build. Execute ali, usando o caminho absoluto do clasp instalado no projeto:

```sh
# Substitua o caminho pelo diretório real do seu checkout:
node /caminho/analise-fichas-epi/node_modules/@google/clasp/build/src/index.js create --title "Analise Fichas EPI" --type standalone
```

A sintaxe correta da versão instalada usa `--title`; o título não é argumento posicional. A criação e a autenticação não foram executadas pelo Codex. Se o comando acima não encontrar o executável no seu sistema, a opção A evita essa etapa; ou use `npx @google/clasp@3.2.0 create --title "Analise Fichas EPI" --type standalone` na pasta temporária.

Copie **somente o ID não secreto do script** criado para `.clasp.json` no checkout. Deixe arquivos de autenticação fora do projeto. O tipo standalone permite implantar o aplicativo web posteriormente com as opções privadas corretas.

### Enviar e inicializar

No checkout:

```sh
npm run build
npm run clasp -- status
npm run clasp -- push
```

Confira que o status lista apenas os arquivos de `dist/`. No editor Google, execute `initializeApplication`, `adminUpdateOfficialBase` e `verifyApplicationConnection`. Faça a implantação privada seguindo os passos 10–11 da opção A. O comando `push` apenas envia o código; não cria a base, não autoriza os usuários e não substitui o teste funcional.

Para atualizar uma implantação existente, crie uma nova versão na tela de gerenciamento da implantação e mantenha o mesmo nível de acesso privado.

## Próximas atualizações da base

Mantenha o arquivo original `.csv.gz` do botão de download CAEPI e siga [UPDATE-OFFICIAL-BASE.md](UPDATE-OFFICIAL-BASE.md). A administração acontece no editor e na preparação local do pacote, sem seção de base/conexão no aplicativo de uso.

## Correção de relatórios e downloads Excel

Use os arquivos completos da pasta `google-apps-script/`, baixados do mesmo
commit. Não copie a visualização formatada ou um trecho do GitHub: use **Raw →
Download raw file** ou **Code → Download ZIP** e abra o arquivo baixado no editor.
O Index agora tem aproximadamente 415 KB, com ExcelJS compactado e incorporado;
não há dependência de CDN, serviço externo de download ou novo escopo OAuth.

Para atualizar um projeto existente:

1. Substitua integralmente estes arquivos no projeto Apps Script existente:
   - `Index.html` (arquivo HTML chamado **Index** no editor Google).
   - `Api.gs` (script **Api**).
   - `ReportDomain.gs` (script **ReportDomain**).
   - `Domain.gs` (script **Domain**, para manter o domínio da mesma distribuição).
   - `Store.gs` (script **Store**, incluindo a correção de linhas vazias).
2. Salve todos os arquivos. Não mantenha cópias adicionais com outros nomes no
   mesmo projeto: funções duplicadas podem carregar versões diferentes.
3. No seletor de funções do editor, execute **verifyReportAndExcelDeployment**.
   Essa verificação é somente leitura e não consulta nem modifica fichas reais.
   Ela confirma: mesma versão em Api/Index, SHA-256 da biblioteca Excel e geração
   de relatório sem filtros com um rascunho fictício antigo sem IDs. O registro
   deve retornar `status: "OK"` e a identificação `epi-...`. Uma mensagem de erro
   informa o arquivo incompleto ou desatualizado antes da publicação.
4. Vá em **Implantar → Gerenciar implantações → lápis da implantação atual**.
   Em **Versão**, selecione **Nova versão** e clique em **Implantar**. Salvar código
   no editor não atualiza a versão atendida pela URL `/exec`.
5. Feche a aba antiga da aplicação, reabra a mesma URL `/exec` e recarregue com
   **Ctrl+Shift+R**. O rodapé deve exibir a mesma versão `epi-...` registrada no
   passo 3. Se não exibir versão, a URL ainda está servindo o código anterior.
   Se tela e servidor forem de versões diferentes, a aplicação avisará explicitamente.
6. Permita pop-ups para a aplicação: o modelo e a matriz Excel são baixados numa
   janela separada para funcionar no iframe do Apps Script. O link na janela é
   mantido caso o navegador não inicie o download automaticamente.

Mantenha a planilha, a propriedade `SPREADSHEET_ID`, o manifesto e as configurações
de acesso atuais. Não recrie o banco, não limpe o armazenamento do navegador e não
execute inicialização ou atualização de catálogo para aplicar esta correção.

A preparação local equivalente é `npm ci` e `npm run google:bundle`. Para clasp,
use `npm run build` e envie `dist/` conforme as instruções acima; ainda é necessário
publicar uma nova versão da implantação existente.

O relatório trata rascunhos locais e fichas Google pelo mesmo caminho de validação.
Linhas totalmente vazias são ignoradas. Uma ficha com entregas, mas sem IDs ou vínculo
com trabalhador, não bloqueia as demais: a prévia/PDF informa a ficha não incluída e
Excel contém uma aba **Avisos**. Nesse caso o relatório é parcial. Nenhum ID é inventado,
nenhum dado é excluído e rascunhos antigos são preservados.

Os testes automatizados carregam os arquivos `.gs` gerados em um único contexto V8
sem `require`/`module`, serializam os RPCs, exercitam o pacote exportado em iframe com
sandbox e leem os arquivos XLSX realmente baixados. Os serviços Google são simulados;
isso não equivale a executar a implantação autenticada na conta Google.

## Validação de uploads e nova matriz visual

A validação de Excel roda em Web Worker, com mensagens de etapa e limite de
30 segundos. Em falha, o worker é encerrado e o seletor de arquivo é liberado.
Arquivos excessivos em tamanho descompactado são rejeitados antes da leitura;
isso evita que formatação aplicada a milhares de linhas vazias bloqueie a tela.
Continuam os limites de 2 MB e 2000 entregas. Em arquivo rejeitado por excesso,
copie somente as linhas preenchidas para uma cópia nova do modelo.

A matriz usa colunas fixas para trabalhador/GHE, auditivos, dérmicos e outros
EPIs, com entregas cronológicas em linhas. O trabalhador fica mesclado dentro da
sua ficha; fichas distintas e homônimos permanecem separados. Os intervalos ficam
verdes quando dentro do prazo, vermelhos quando fora e amarelos quando há vida
útil ausente ou revisão; primeira entrega aparece como marco inicial. As cores
seguem as regras do sistema, não limites inferidos de imagens de referência.
A aba Detalhes mantém limite, resultado e situação/validade dos CAs.

Para aplicar essa atualização sobre a versão anterior, substitua **Index.html**
e **Api.gs** pelos arquivos completos do mesmo pacote `google-apps-script/`.
O Api acompanha a nova identificação de versão. Execute
`verifyReportAndExcelDeployment`, publique uma **Nova versão** da implantação
existente e recarregue a URL `/exec`. Os scripts do Worker já estão incorporados
no Index: não crie arquivos adicionais no editor Google.

## Quantidade e entregas repetidas

Para aplicar essa atualização, substitua **Index.html**, **Api.gs**, **Domain.gs**
e **Store.gs**, todos do mesmo pacote `google-apps-script/`. Execute
`verifyReportAndExcelDeployment` e publique uma **Nova versão** na implantação
existente. A verificação também detecta Domain/Store antigos que não suportam
quantidade. Nenhum outro arquivo precisa ser criado no editor.

A coluna `quantity` é acrescentada automaticamente ao fim de `Entries` no primeiro
acesso usando o Store atualizado, somente quando os cabeçalhos antigos de seis ou
sete colunas são reconhecidos. Cabeçalhos desconhecidos continuam bloqueados.
Essa migração não regrava as entregas existentes: campos vazios equivalem a 1.
Mantenha a planilha e `SPREADSHEET_ID`; não recrie as abas nem o catálogo.

Quantidade é inteira e positiva, em pares para luvas e unidades para cremes.
No modelo Excel, a nova nona coluna **Quantidade** pode ficar vazia (1), e modelos
antigos de oito colunas continuam aceitos. CA/data repetidos são preservados, com
IDs distintos por linha e ordem original em empates. O reconhecimento de reenvio
do mesmo arquivo continua ativo para evitar importar a ficha inteira novamente.

O prazo compara o intervalo com a quantidade da entrega anterior: 30 dias por
unidade/par de proteção dérmica ou vida útil cadastrada por unidade de auditivo.
Linhas do mesmo grupo/data somam os prazos em um lote; uma nova data reinicia a contagem sem acumular saldos. Quantidade,
prazo total e quantidade anterior constam nos relatórios e no Excel.

A regra do lote considera a data: luva + creme na mesma data, com quantidade 1
cada, somam 60 dias. Dois auditivos na mesma data somam os prazos dos respectivos
CAs. As linhas são mantidas separadas nos relatórios; cada uma compara o intervalo
com o lote da data anterior do seu grupo. Não se cria um intervalo zero entre linhas
do mesmo lote. Um CA auditivo sem prazo cadastrado torna o total desse lote pendente.
