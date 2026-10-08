# Parte 2 — Google e base real de CAs

O código de conexão e importação está preparado. A ativação exige sua autorização na conta Google e o arquivo oficial. Nenhum teste local autoriza acesso à conta e nenhuma implantação real foi feita pelo Codex.

## Opção A: pelo navegador, sem instalar Node ou clasp

1. Abra `https://script.google.com/` na sua conta e crie um **novo projeto**, dedicado à aplicação. Nome sugerido: **Análise Fichas EPI**.
2. No GitHub, baixe **Code → Download ZIP** e extraia. Os arquivos prontos estão na pasta **google-apps-script/**. A versão com base padrão também exige os quatro novos scripts descritos em [DEFAULT-BASE.md](DEFAULT-BASE.md).
3. No editor Google, remova apenas o arquivo inicial `Code.gs` vazio do projeto novo. Crie seis arquivos de script com os nomes **Domain**, **ImportDomain**, **Store**, **Catalog**, **Api** e **Setup**. Em cada um, cole o conteúdo do `.gs` correspondente da pasta baixada. Não cole arquivos do `src/` diretamente: a pasta exportada é o pacote completo.
4. Crie um arquivo **HTML** com o nome **Index**. Cole o conteúdo completo de `google-apps-script/Index.html`.
5. Em **Configurações do projeto**, habilite a exibição do manifesto `appsscript.json`. Volte ao editor e substitua o manifesto pelo arquivo do pacote. Ele solicita acesso a planilhas e mantém `USER_ACCESSING` e `MYSELF`.
6. Salve tudo. Selecione a função **initializeApplication** e clique em **Executar**. Autorize o acesso usando sua conta. Verifique nome, projeto e escopos na tela de autorização. Não compartilhe códigos OAuth, arquivos de token ou senhas no chat.
7. A função cria **uma planilha privada**, salva seu ID em `SPREADSHEET_ID` e cria as tabelas do aplicativo e as duas tabelas auxiliares da base padrão. O registro da execução mostra o link da planilha, o número de CAs e o status da preparação padrão; a interface continua o carregamento em etapas. Executar novamente reutiliza a planilha; nunca substitui um ID já configurado apenas porque houve erro de acesso.
8. Para usar uma planilha dedicada que já existe, defina primeiro seu ID em **Configurações → Propriedades do script → SPREADSHEET_ID** e só depois execute a função. Faça backup se a planilha já contém tabelas da aplicação. Cabeçalhos incompatíveis bloqueiam a inicialização.
9. Selecione **verifyApplicationConnection** e execute. O resultado deve indicar `connected: true`, o link da planilha e `caCount` correspondente ao catálogo quando a preparação estiver concluída. Isso confirma a conexão executada na sua conta.
10. Em **Implantar → Nova implantação → Aplicativo da Web**, escolha **executar como usuário que acessa** e **acesso somente você**. Confirme essas opções no diálogo e abra a URL privada fornecida pelo Google. Não selecione acesso público/anônimo.
11. Abra **Base e conexão** e clique em **Verificar conexão**. A base inicialmente vazia bloqueia análises reais; a aplicação não usa CAs fictícios como substituto.

`SPREADSHEET_ID` é propriedade do projeto Apps Script, não uma variável do ambiente Node. Não existe chave API a inserir no frontend. O Google gerencia OAuth. O aplicativo não altera compartilhamento da planilha.

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

Confira que o status lista apenas os arquivos de `dist/`. No editor Google, execute `initializeApplication` e `verifyApplicationConnection`. Faça a implantação privada seguindo os passos 10–11 da opção A. O comando `push` apenas envia o código; não cria a base, não autoriza os usuários e não substitui o teste funcional.

Para atualizar uma implantação existente, crie uma nova versão na tela de gerenciamento da implantação e mantenha o mesmo nível de acesso privado.

## Importar a base oficial

1. Obtenha a planilha oficial do Ministério do Trabalho em uma fonte governamental. O usuário forneceu posteriormente cadastro-EPI-final.xlsx; a projeção dessa base está incluída no pacote, com referência temporal desconhecida. Consulte DEFAULT-BASE.md antes do uso. Não use os CAs de demonstração.
2. Se o arquivo vier em XLSX, abra-o no Google Sheets ou Excel e exporte a aba de dados como **CSV**. Não há leitura direta de XLSX nesta versão nem scraping do CAEPI.
3. Use um recorte com até **10.000 CAs / 10 MB**, incluindo os CAs das fichas que você pretende analisar. A importação **substitui o catálogo inteiro**, não adiciona um lote ao anterior. Bases maiores exigirão importação incremental em uma evolução posterior.
4. Na aplicação privada, abra **Base e conexão**, selecione o arquivo, o separador e a codificação (UTF-8 ou Windows-1252) e clique em **Ler arquivo**.
5. Confirme as colunas de número de CA, nome do EPI, proteção aprovada e validade do CA. As sugestões reconhecem alguns nomes comuns, mas não garantem compatibilidade com todas as versões do arquivo oficial. O campo de proteção aprovada deve ser o conteúdo oficial, não o nome da luva nem um campo de material.
6. Informe a URL HTTPS em domínio `gov.br` da fonte real e a data de referência da base em `DD/MM/AAAA`. Não use a data de hoje apenas para remover o aviso de desatualização. A aplicação valida domínio e formatos, mas não autentica a procedência do arquivo por assinatura.
7. Clique em **Validar e gerar prévia**. Confira quantidade, grupos, alertas e amostra. CAs duplicados normalizados, datas impossíveis, nomes ausentes ou CSV malformado bloqueiam toda a importação. Validade ou proteção vazias permanecem indisponíveis e geram alerta, sem valores inventados.
8. Clique em **Confirmar importação na planilha** e confirme a substituição. A função revalida no servidor, verifica que a prévia e o catálogo atual não mudaram, grava `CaIndex` e `Metadata` e preserva `Workers`, `Sheets`, `Entries` e `Lifetimes`.
9. Confirme a contagem e a origem em **Verificar conexão**. Cadastre a vida útil técnica dos protetores auditivos na seção **Vida útil**; ela não é extraída da validade do certificado.

Datas de validade aceitam `DD/MM/AAAA` ou `AAAA-MM-DD` e são normalizadas para o primeiro formato. Valores Excel em número serial e textos como “suspenso” não são datas de validade: precisam de preparação do arquivo, sem inventar uma data. Riscos de status atual e validade física permanecem distintos.

## Verificação real antes de utilizar fichas pessoais

Use primeiro uma pessoa fictícia e um CA realmente presente no arquivo importado:

- Registre duas entregas e confira se o EPI foi identificado pela base.
- Cadastre um prazo técnico, confira o intervalo e o prazo do CA anterior.
- Salve a ficha, recarregue e use **Reabrir ficha da planilha**. Confira IDs, registros e trabalhador nas tabelas.
- Feche e reabra a aplicação; confira que o prazo cadastrado permanece.
- Faça uma atualização controlada do catálogo e confira que fichas e prazos não foram apagados.
- Confirme que a implantação está limitada à sua própria conta.

Os testes automatizados com mocks cobrem o fluxo de integração e importação, mas **não comprovam OAuth, quotas, autorização, criação ou persistência reais no Google**. Esses resultados só podem ser declarados depois dos passos acima.

## Se ocorrer erro

- **SPREADSHEET_ID ausente:** execute `initializeApplication` no editor autenticado.
- **Sem permissão para abrir a planilha:** confira a conta e o ID. Não apague a propriedade para mascarar o erro; ela pode apontar para fichas existentes.
- **Cabeçalho inesperado:** compare com o esquema do README e preserve a base antes de corrigir. Não troque cabeçalhos contendo dados sem entender a migração.
- **Base vazia:** conecte a planilha e importe os CAs reais na aplicação privada.
- **Referência antiga:** confira a situação atual dos CAs na fonte oficial. Uma nova importação não torna automaticamente atual uma planilha antiga.
- **403 no CAEPI:** obtenha a planilha pela via oficial disponibilizada ao usuário. Não contorne o bloqueio com scraping.
- **Falha de gravação com recuperação:** a base anterior é restaurada quando possível. Sheets não fornece transações entre abas; falha de recuperação ou interrupção abrupta exige inspecionar `CaIndex` e `Metadata` antes de repetir.

A conexão Google neste ambiente cloud permanece pendente até que exista uma autorização da sua conta por um fluxo suportado. Variáveis de credencial padrão da plataforma, sem uma identidade configurada, não estabelecem acesso à sua conta pessoal.
