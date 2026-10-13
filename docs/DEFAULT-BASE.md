# Base oficial CAEPI

A base padrão atual é a exportação oficial **RelatorioCA_20261013_150911.csv.gz**, com **42.478 CAs**. Ela substitui o XLSX antigo e suas correções pontuais. O arquivo original pode ser mantido como `.csv.gz`; a preparação não exige Excel.

Veja [UPDATE-OFFICIAL-BASE.md](UPDATE-OFFICIAL-BASE.md) para atualizar a aplicação, executar a troca pelo administrador e preparar próximos arquivos oficiais. Essa é a instrução atual; a seção Base e conexão foi removida da tela de uso.

O preparador `scripts/prepare-official-base.py` valida o gzip/CRC e o CSV, separa o HTML anexado pelo portal e preserva a situação oficial. Para um CA repetido, seleciona a maior validade e os campos associados a essa data. Não soma anos à emissão nem usa o texto de situação de um registro histórico diferente. A data de 26/05/3031 do CA 40355 é preservada.

O arquivo bruto não é publicado no repositório. O catálogo contém apenas CA, nome, proteção aprovada, validade e situação. Os blocos compactados têm checksums verificados no build e antes da escrita no Google Sheets. A preparação usa tabelas auxiliares e preserva as fichas e vidas úteis; a data de atualização muda somente ao concluir a troca.
