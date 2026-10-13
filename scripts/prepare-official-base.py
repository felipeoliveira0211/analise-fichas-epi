"""Prepare the official CAEPI CSV.gz without Excel or third-party dependencies.
Validate gzip CRC, isolate any appended HTML, select fields from latest-date rows.
"""
import argparse,collections,csv,datetime,gzip,hashlib,io,json,pathlib,re,zlib
HEADERS=['NR Registro CA','DATA DE VALIDADE','SITUACAO','NR DO PROCESSO','CNPJ','RAZAO SOCIAL','NATUREZA','EQUIPAMENTO','DESCRICAO EQUIPAMENTO','MARCA CA','REFERENCIA','COR','APROVADO PARA LAUDO','RESTRICAO LAUDO','OBSERVACAO ANALISE LAUDO','CNPJ LABORATORIO','RAZAO SOCIAL LABORATORIO','NR LAUDO','NORMA']
SOURCE='https://caepi.trabalho.gov.br/internet/ConsultaCAInternet.aspx'
def extract(blob):
    decoder=zlib.decompressobj(16+zlib.MAX_WBITS)
    data=decoder.decompress(blob,250*1024*1024+1)
    if len(data)>250*1024*1024 or not decoder.eof:raise ValueError('Gzip incompleto, inválido ou acima de 250 MB descomprimidos')
    tail=decoder.unused_data
    if tail.strip() and not tail.lstrip().lower().startswith(b'<!doctype html'):raise ValueError('Conteúdo inesperado após o gzip')
    return data,len(tail)
def project(text):
    csv.field_size_limit(2_000_000)
    rows=csv.reader(io.StringIO(text,newline=''),delimiter=';',strict=True)
    header=[x.strip().lstrip('\ufeff') for x in next(rows)]
    if header!=HEADERS:raise ValueError('Cabeçalho oficial diferente do esperado')
    registry={};stats=collections.Counter()
    for line,row in enumerate(rows,start=2):
        if len(row)!=19:raise ValueError('Colunas inválidas no registro '+str(line))
        if not row[0].isdigit() or not 0<int(row[0])<10**10:raise ValueError('CA inválido no registro '+str(line))
        ca=str(int(row[0]));raw=row[1].strip()
        date=None
        for fmt in ('%d/%m/%Y','%d/%m/%Y %H:%M:%S'):
            try:date=datetime.datetime.strptime(raw,fmt).date();break
            except ValueError:pass
        if date is None or date.year<1900:raise ValueError('Validade inválida do CA '+ca)
        name,protection,status=row[7].strip(),row[12].strip(),row[2].strip().upper()
        if not name or len(name)>1000 or len(protection)>10000:raise ValueError('Texto inválido do CA '+ca)
        if status not in ('VÁLIDO','VENCIDO','SUSPENSO','CANCELADO'):raise ValueError('Situação desconhecida do CA '+ca)
        stats['inputRows']+=1
        entry=registry.setdefault(ca,{'dates':set(),'statuses':set(),'latest':date,'names':set(),'protections':set(),'latestStatuses':set()})
        entry['dates'].add(date);entry['statuses'].add(status)
        if date>entry['latest']:
            entry['latest']=date;entry['names'].clear();entry['protections'].clear();entry['latestStatuses'].clear()
        if date==entry['latest']:
            entry['names'].add(name);entry['protections'].add(protection);entry['latestStatuses'].add(status)
    records=[]
    for ca,e in sorted(registry.items(),key=lambda x:int(x[0])):
        if len(e['latestStatuses'])!=1:raise ValueError('Situações conflitantes na maior validade do CA '+ca)
        if len(e['dates'])>1:stats['casWithConflictingExpiry']+=1
        if len(e['statuses'])>1:stats['casWithHistoricalStatusChanges']+=1
        protection='\n'.join(sorted(p for p in e['protections']if p))
        if not protection:stats['casWithoutReliableProtection']+=1
        records.append([ca,' / '.join(sorted(e['names'])),protection,e['latest'].strftime('%d/%m/%Y'),next(iter(e['latestStatuses']))])
    stats['uniqueCas']=len(records);stats['duplicateRowsConsolidated']=stats['inputRows']-len(records)
    return records,dict(stats)
def main():
    parser=argparse.ArgumentParser();parser.add_argument('file');parser.add_argument('--reference-date',help='DD/MM/AAAA da extração, se não estiver no nome oficial');args=parser.parse_args()
    file=pathlib.Path(args.file);blob=file.read_bytes();data,tail=extract(blob);records,stats=project(data.decode('utf-8-sig'))
    match=re.fullmatch(r'RelatorioCA_(\d{8})_(\d{6})\.csv\.gz',file.name)
    if args.reference_date:reference=datetime.datetime.strptime(args.reference_date,'%d/%m/%Y').strftime('%d/%m/%Y')
    elif match:reference=datetime.datetime.strptime(match[1],'%Y%m%d').strftime('%d/%m/%Y')
    else:raise ValueError('Informe --reference-date para arquivo sem nome oficial de geração')
    root=pathlib.Path(__file__).resolve().parent.parent/'data/default-ca';root.mkdir(exist_ok=True,parents=True)
    parts=[];digest=hashlib.sha256(blob).hexdigest()
    for i,start in enumerate(range(0,len(records),500)):
        compressed=gzip.compress(json.dumps(records[start:start+500],ensure_ascii=False,separators=(',',':')).encode(),mtime=0);name=f'chunk-{i:03d}.json.gz'
        (root/name).write_bytes(compressed);parts.append({'file':name,'records':len(records[start:start+500]),'sha256':hashlib.sha256(compressed).hexdigest()})
    keep={p['file']for p in parts}
    for old in root.glob('chunk-*.json.gz'):
        if old.name not in keep:old.unlink()
    manifest={'version':digest[:20]+'-official-v4','projectionVersion':4,'fileName':file.name,'fileSha256':digest,'source':SOURCE,'referenceDate':reference,'fileModifiedAt':None,'referenceNote':'Data de geração do relatório oficial; atualização do cadastro individual pode ocorrer posteriormente.','expiryPolicy':'latest-valid-date-per-ca','recordPolicy':'name-protection-status-from-latest-expiry-rows','gzipCrcVerified':True,'trailingHtmlBytes':tail,'statistics':stats,'chunks':parts}
    (root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'statistics':stats,'chunks':len(parts),'trailingHtmlBytes':tail},indent=2))
if __name__=='__main__':main()
