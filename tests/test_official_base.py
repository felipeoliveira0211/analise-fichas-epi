import csv,gzip,importlib.util,io,pathlib,unittest
spec=importlib.util.spec_from_file_location('official',pathlib.Path(__file__).resolve().parents[1]/'scripts/prepare-official-base.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def row(ca='1',date='22/08/2028',status='VÁLIDO',name='PERNEIRA',protection='PROTEÇÃO DAS PERNAS'):
    r=['']*19;r[0]=ca;r[1]=date;r[2]=status;r[7]=name;r[12]=protection;return r
def csv_text(rows):
    out=io.StringIO(newline='');w=csv.writer(out,delimiter=';');w.writerow(module.HEADERS);w.writerows(rows);return out.getvalue()
class OfficialBaseTest(unittest.TestCase):
    def test_integrity_and_html_tail(self):
        text=csv_text([row()]);blob=gzip.compress(text.encode())+b'\r\n<!DOCTYPE html><html>tail</html>'
        data,size=module.extract(blob);self.assertEqual(data.decode(),text);self.assertGreater(size,0)
        corrupt=bytearray(gzip.compress(text.encode()));corrupt[-8]^=1
        with self.assertRaises(Exception):module.extract(bytes(corrupt))
        with self.assertRaises(ValueError):module.extract(gzip.compress(text.encode())+b'garbage')
    def test_quoted_csv_fields(self):
        r=row(name='Equipamento; exemplo',protection='Proteção\ncom duas linhas');records,stats=module.project(csv_text([r]));self.assertEqual(records[0][1],r[7]);self.assertEqual(records[0][2],r[12]);self.assertEqual(stats['uniqueCas'],1)
    def test_latest_record_keeps_associated_fields(self):
        old=row(date='16/08/2012',status='VENCIDO',name='MANGOTE',protection='TEXTO ANTIGO');new=row(date='08/10/2027',name='MANGA',protection='TEXTO ATUAL')
        records,_=module.project(csv_text([new,old,new]));self.assertEqual(records,[['1','MANGA','TEXTO ATUAL','08/10/2027','VÁLIDO']])
    def test_conflicting_status_at_same_date_rejected(self):
        with self.assertRaises(ValueError):module.project(csv_text([row(),row(status='CANCELADO')]))
    def test_far_future_validity_and_bad_date(self):
        records,_=module.project(csv_text([row(date='26/05/3031')]));self.assertEqual(records[0][3],'26/05/3031')
        with self.assertRaises(ValueError):module.project(csv_text([row(date='31/02/3031')]))
    def test_misaligned_column_ca_or_status_rejected(self):
        for r in (row()[:-1],row(ca='=1'),row(status='UNKNOWN')):
            with self.assertRaises(ValueError):module.project(csv_text([r]))
if __name__=='__main__':unittest.main()
