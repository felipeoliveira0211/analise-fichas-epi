import datetime,importlib.util,pathlib,unittest
spec=importlib.util.spec_from_file_location('projection',pathlib.Path(__file__).resolve().parents[1]/'scripts/prepare-default-base.py')
projection=importlib.util.module_from_spec(spec);spec.loader.exec_module(projection)

def row(ca=123):
    cells=[None]*19;cells[0]=ca;cells[1]=datetime.datetime(2026,1,1);cells[6]='Nacional';cells[7]='Luva fictícia';cells[12]='PROTEÇÃO DAS MÃOS CONTRA AGENTES QUÍMICOS';cells[15]=123456789
    return cells

class ProjectionTest(unittest.TestCase):
    def test_norms_do_not_duplicate_ca(self):
        first=row();second=row();first[18]='Norma fictícia A';second[18]='Norma fictícia B'
        records,stats=projection.project([first,second]);self.assertEqual(len(records),1);self.assertEqual(stats['duplicateRowsConsolidated'],1);self.assertEqual(records[0][2],first[12])
    def test_shifted_columns_do_not_invent_protection(self):
        shifted=row();shifted[12]='Marca fictícia';shifted[15]='PROTEÇÃO EM COLUNA DESLOCADA'
        records,stats=projection.project([shifted]);self.assertEqual(records[0][2],'');self.assertEqual(stats['casWithoutReliableProtection'],1)
    def test_conflicting_dates_choose_latest_calendar_date(self):
        first=row();second=row();first[1]=datetime.datetime(2026,12,31);second[1]=datetime.datetime(2027,1,1)
        records,stats=projection.project([first,second]);self.assertEqual(records[0][3],'01/01/2027');self.assertEqual(stats['casWithConflictingExpiry'],1)
        reversed_records,_=projection.project([second,first]);self.assertEqual(reversed_records,records)
    def test_bad_ca_or_expiry_block_projection(self):
        for bad in ['=1+1',0,-1]:
            with self.assertRaises(ValueError):projection.project([row(bad)])
        bad=row();bad[1]='31/02/2026'
        with self.assertRaises(ValueError):projection.project([bad])

if __name__=='__main__':unittest.main()
