/* This worker is terminated by the caller on completion, error or timeout. */
self.onmessage = async function(event) {
  try {
    self.postMessage({stage:'Lendo as linhas da planilha…'});
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(event.data.data, {ignoreNodes:['drawing','picture','extLst','conditionalFormatting','dataValidations']});
    self.postMessage({stage:'Conferindo campos, datas e identificadores…'});
    const result = EpiSpreadsheets.parse(workbook,event.data.prefix,EpiDomain);
    self.postMessage({result});
  } catch(error) {
    self.postMessage({error:error.message || String(error)});
  }
};
