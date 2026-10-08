# Vida útil rápida, empresa e relatórios PDF

## Atualizar a aplicação existente

Use o mesmo projeto Google, planilha e implantação.

1. Baixe a versão atual do repositório. Em `google-apps-script/`, copie o conteúdo completo de **Domain.gs**, **Store.gs**, **Api.gs** e **Index.html** para os arquivos correspondentes no editor Apps Script.
2. Adicione um arquivo de script chamado **ReportDomain** e cole **ReportDomain.gs**. Mantenha os demais scripts da aplicação, incluindo a base padrão já carregada.
3. Execute **setupDatabase** no editor. A função acrescenta `company` na aba `Workers` e `savedAt` na aba `Entries`, sem apagar os dados. Não altere os cabeçalhos manualmente. Se estiver atualizando uma versão anterior à base padrão, siga também [DEFAULT-BASE.md](DEFAULT-BASE.md).
4. Em **Implantar → Gerenciar implantações**, edite a implantação e selecione **Nova versão**. Mantenha o acesso privado e reabra a aplicação. Essa atualização não exige substituir ou recarregar o catálogo de CAs já carregado.

A migração só aceita os cabeçalhos antigos conhecidos. Um cabeçalho diferente gera erro para evitar modificar uma tabela incompatível. As fichas antigas continuam disponíveis: empresa e horários ausentes não são inventados. Complete a empresa ao reabrir uma ficha antiga para analisar ou salvar novamente pela interface.

## Lançamento e salvamento

Preencha empresa, trabalhador, setor, cargo e GES. No lançamento rápido, digite CA, data da entrega e, se desejar, **vida útil em dias totais** (inteiro de 1 a 36500). Clique em Adicionar ou pressione Enter na data.

Com vida útil preenchida, o prazo é salvo no cadastro por CA e aparece na tela **Vida útil**. Na aplicação Google, essa gravação ocorre na aba `Lifetimes` ao adicionar o lançamento, mesmo antes de salvar a ficha. Se já houver outro prazo, confirme a substituição. Uma falha na gravação mantém os campos preenchidos para tentar novamente. Na demonstração local, o prazo fica no navegador.

O prazo é compartilhado por todas as fichas que usam aquele CA, não é um parâmetro individual da entrega. A regra de proteção dérmica química continua fixa em 30 dias. O limite auditivo continua usando o CA da entrega anterior. A tabela de resultados exibe a vida útil do CA da linha; a coluna Limite pode mostrar outro valor, pois se refere ao CA anterior.

O aviso junto a **Salvar na planilha** lembra que a ficha não salva fica somente no navegador e pode se perder. A vida útil gravada na aplicação Google é independente desse rascunho.

Ao salvar a ficha, a empresa fica em `Workers.company`. O horário do servidor é registrado em `Sheets.updatedAt` (último salvamento da ficha) e em `Entries.savedAt` (salvamento de cada lançamento). Entradas inalteradas mantêm seu horário anterior; novas entradas e entradas alteradas recebem o horário da nova gravação. O cliente não escolhe esse horário. Entradas legadas sem horário recebem um registro na próxima gravação. Isso não reconstrói o histórico anterior nem constitui um log completo de auditoria.

Os horários são armazenados em ISO/UTC e exibidos no fuso de Brasília. A data de entrega continua sendo uma data sem horário.

## Gerar relatórios

Na tela **Relatórios / PDFs**:

1. Selecione **Fichas deste navegador** ou **Fichas salvas na planilha Google**.
2. Preencha os filtros desejados: início/fim das entregas, empresa, GES, funcionário, setor, cargo e situação. Filtros de texto aceitam parte do nome e ignoram caixa e acentos.
3. Clique em **Gerar prévia**. A prévia consolida as fichas encontradas, ordenadas por empresa, GES e trabalhador, com uma seção por ficha. Fichas sem entregas no período não aparecem.
4. Clique em **Imprimir / Salvar PDF**. Na janela do navegador, escolha **Salvar como PDF**, orientação paisagem e, se necessário, desative cabeçalhos/rodapés do navegador. O PDF é gerado localmente; a aplicação não grava um arquivo no Drive.

O período é a **data de entrega**, com limites inclusivos. A análise considera todas as entregas da ficha antes de filtrar as linhas. Assim, uma entrega anterior ao período ainda define o intervalo e o limite da primeira linha exibida. A prévia precisa ser gerada novamente quando os filtros mudam. Nenhum resultado encontrado mantém o botão PDF desabilitado.

Na aplicação Google, a origem local usa os rascunhos atuais e consulta o catálogo e prazos reais no servidor. A origem Google lê as fichas salvas, incluindo seus horários, sem incorporar alterações locais não salvas. Gerar um relatório não salva nem modifica fichas. Os relatórios usam os prazos de vida útil atuais, sem histórico de vigência; o horário exibido identifica a gravação da ficha/entrada, não a vigência do prazo.

Na demonstração standalone (`demo.html`), os relatórios usam somente fichas locais e CAs fictícios, com aviso no PDF. Para analisar dados reais, abra a aplicação Google. Textos são renderizados como texto, incluindo nomes e empresas; não são executados como HTML.

## Validação

Os testes verificam migração de cabeçalhos preservando dados, empresa e horários definidos pelo servidor, filtros combinados, período inclusivo, troca de CA e entrega anterior ao período. As interfaces local e Google simulada verificam lançamento rápido e relatórios. Um PDF foi efetivamente gerado pelo Chromium com o CSS de impressão e inspecionado como texto. A implantação e a janela de impressão da conta Google precisam ser verificadas no navegador do usuário.
