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
