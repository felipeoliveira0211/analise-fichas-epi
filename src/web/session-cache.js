/* Only positively confirmed, unchanged copies may expire. No server deletion. */
var EpiSessionCache = (function () {
  const TTL=7*24*60*60*1000;
  function content(s){return JSON.stringify({worker:s.worker,state:s.state,entries:s.entries.map(e=>({id:e.id,ca:e.ca,date:e.date,quantity:e.quantity==null||e.quantity===''?1:Number(e.quantity),physicalExpiry:e.physicalExpiry||''}))});}
  function confirm(sheet,submitted,now){sheet.localSync=content(sheet)===content(submitted)?{revision:Number(sheet.revision),confirmedAt:now}:null;}
  function dirty(sheet){sheet.localSync=null;}
  function prune(sheets,saved,currentId,now){const versions=new Map(saved.map(s=>[s.id,Number(s.revision)]));return sheets.filter(s=>{
    const m=s.localSync;
    return s.id===currentId||!m||!Number.isFinite(m.confirmedAt)||now-m.confirmedAt<TTL||Number(s.revision)!==m.revision||versions.get(s.id)!==m.revision;
  });}
  return {TTL,content,confirm,dirty,prune};
})();
if(typeof module!=='undefined')module.exports=EpiSessionCache;
