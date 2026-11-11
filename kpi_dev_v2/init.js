async function fetchEmployee(employee){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
 try{
  const url=`${SHEET_BASE}?gid=${encodeURIComponent(employee.gid)}&single=true&output=csv&v=${Date.now()}`;
  const response=await fetch(url,{mode:'cors',credentials:'omit',signal:controller.signal});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const raw=await response.text();if(raw.length>5_000_000)throw new Error('Sheet exceeds the 5 MB safety limit.');
  return parseEmployeeCsv(raw,employee);
 }finally{clearTimeout(timer);}
}
async function refreshSheet(){
 if(state.refreshing)return;state.refreshing=true;renderAll();
 const results=await Promise.allSettled(EMPLOYEES.map(e=>fetchEmployee(e)));
 results.forEach((result,i)=>{
  const e=EMPLOYEES[i],old=state.source[e.id];
  if(result.status==='fulfilled'){state.records[e.id]=result.value;state.source[e.id]={status:'live',lastSuccess:new Date()};}
  else{state.source[e.id]={status:old.lastSuccess?'stale':'unavailable',lastSuccess:old.lastSuccess||null};console.warn(`Could not load the published tab for ${e.name}.`,result.reason);}
 });
 state.refreshing=false;state.lastChecked=new Date();renderAll();
}
initializeLogos();
refreshSheet();
setInterval(()=>{if(!document.hidden)refreshSheet();},5*60*1000);
