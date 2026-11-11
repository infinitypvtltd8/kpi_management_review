function initializeLogos(){document.querySelectorAll('img[data-logo]').forEach(img=>{img.src=LOGOS[img.dataset.logo];});}
function syncLandingVideo(){const video=document.querySelector('.landing-video');if(!video)return;const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(state.currentCompany||reduced){video.pause();return;}const play=video.play();if(play&&play.catch)play.catch(()=>{});}
function goHome(){state.currentCompany=null;document.body.removeAttribute('data-company');$('company-page').classList.remove('active');$('landing').classList.add('active');window.scrollTo(0,0);renderLandingStatus();syncLandingVideo();}
function openCompany(company){
 state.currentCompany=company;syncLandingVideo();state.selectedDepartment='all';state.selectedEmployee='all';state.selectedUnit='all';state.tableSearch='';state.tableStatus='all';state.activeTab='overview';
 document.body.dataset.company=company;$('landing').classList.remove('active');$('company-page').classList.add('active');
 $('company-logo').src=LOGOS[company];$('company-logo').alt=COMPANIES[company].name+' logo';$('company-logo').classList.toggle('xguard',company==='xguard');
 $('top-company').textContent=COMPANIES[company].name;$('heading-company').textContent=COMPANIES[company].name;$('company-subtitle').textContent=COMPANIES[company].subtitle;
 $('switch-company').textContent=company==='apeiro'?'Switch to X GUARD ↗':'Switch to APEIRO ↗';$('department-tab').hidden=false;
 $('kpi-search').value='';$('status-select').value='all';renderAll();window.scrollTo(0,0);
}
function switchCompany(){openCompany(state.currentCompany==='apeiro'?'xguard':'apeiro');}
function showTab(tab){
 state.activeTab=tab;
 document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
 document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+tab));
 if(tab==='reports')renderReports();
}
function changePeriod(period){state.periodByCompany[state.currentCompany]=period;renderAll();}
function changeDepartment(department){state.selectedDepartment=department;state.selectedEmployee='all';state.selectedUnit='all';renderAll();}
function changePerson(person){state.selectedEmployee=person;state.selectedUnit='all';renderAll();}
function resetFilters(){state.selectedDepartment='all';state.selectedEmployee='all';state.selectedUnit='all';state.tableSearch='';state.tableStatus='all';$('kpi-search').value='';$('status-select').value='all';renderAll();}
function changeUnit(unit){state.selectedUnit=unit;renderUnits();}
function selectUnit(unit){state.selectedUnit=state.selectedUnit===unit?'all':unit;renderUnits();}
function focusPerson(id){state.selectedEmployee=id;state.tableSearch='';state.tableStatus='all';$('kpi-search').value='';$('status-select').value='all';renderAll();showTab('people');}
function focusDepartment(name){state.selectedDepartment=state.selectedDepartment===name?'all':name;state.selectedEmployee='all';state.selectedUnit='all';renderAll();}
function changeSearch(value){state.tableSearch=value;renderKpiTable();}
function changeTableStatus(value){state.tableStatus=value;renderKpiTable();}
function renderLandingStatus(){
 const statuses=EMPLOYEES.map(e=>state.source[e.id]),live=statuses.filter(s=>s.status==='live').length;
 let label=state.refreshing?'Refreshing Google Sheet':live===EMPLOYEES.length?'Google Sheet connected':`${live}/${EMPLOYEES.length} employee tabs available`;
 $('landing-status').innerHTML=`<span class="status-dot ${!state.refreshing&&live!==EMPLOYEES.length?'warn':''}"></span>${esc(label)}`;
}
function updateControls(){
 const company=state.currentCompany,periods=availablePeriods(company),periodSelect=$('period-select');
 if(!periods.length){periodSelect.disabled=true;periodSelect.innerHTML=`<option value="">${state.refreshing?'Loading available months…':'No months loaded'}</option>`;state.periodByCompany[company]=null;}
 else{periodSelect.disabled=false;if(!periods.includes(state.periodByCompany[company]))state.periodByCompany[company]=periods[0];periodSelect.innerHTML=periods.map(p=>`<option value="${esc(p)}">${esc(periodLabel(p))}</option>`).join('');periodSelect.value=state.periodByCompany[company];}
 const deptField=$('dept-filter-field'),deptSelect=$('dept-select');deptField.hidden=false;
 const depts=departmentsFor(company);
 if(state.selectedDepartment!=='all'&&!depts.some(d=>d.name===state.selectedDepartment))state.selectedDepartment='all';
 deptSelect.innerHTML='<option value="all">All departments</option>'+depts.map(d=>`<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('');deptSelect.value=state.selectedDepartment;
 const people=eligiblePeople(company,false);if(state.selectedEmployee!=='all'&&!people.some(e=>e.id===state.selectedEmployee))state.selectedEmployee='all';
 $('person-select').innerHTML='<option value="all">All employees</option>'+people.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');$('person-select').value=state.selectedEmployee;
 const parts=[periodSelect.value?periodLabel(periodSelect.value):'No reporting period'];if(state.selectedDepartment!=='all')parts.push(state.selectedDepartment+' KPI ownership');if(state.selectedEmployee!=='all')parts.push(byId(state.selectedEmployee)?.name||'');
 $('scope-label').textContent='Current selection: '+parts.join('  ·  ')+'.';$('title-period').textContent=periodSelect.value?periodLabel(periodSelect.value):'Waiting for sheet data';
 return periodSelect.value||null;
}
function renderSourceStatus(){
 const company=state.currentCompany,people=peopleFor(company),live=people.filter(e=>state.source[e.id].status==='live').length,failed=people.filter(e=>['unavailable','stale'].includes(state.source[e.id].status)),stale=people.some(e=>state.source[e.id].status==='stale');
 let message;
 if(state.refreshing)message='Checking the published Google Sheet…';
 else if(live===people.length)message=`Connected to Google Sheet · ${live}/${people.length} employee tabs loaded.`;
 else if(stale){const cached=people.filter(e=>state.source[e.id].status==='stale').map(e=>e.name),unavailable=people.filter(e=>state.source[e.id].status==='unavailable').map(e=>e.name);message=`${live}/${people.length} tabs loaded on the latest check. Last successful in-session data: ${cached.join(', ')}.${unavailable.length?' Unavailable: '+unavailable.join(', ')+'.':''}`;}
 else if(live===0)message='Could not reach the published Sheet. File previews and files opened directly may block connections; use the live preview or an HTTPS-hosted site, and check that the Sheet is published.';
 else message=`${live}/${people.length} employee tabs loaded. Could not load: ${failed.map(e=>e.name).join(', ')}.`;
 $('source-text').textContent=message;$('source-banner').classList.toggle('warning',!state.refreshing&&live!==people.length);
 $('topbar-status').textContent=state.lastChecked?`Checked ${state.lastChecked.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:'Checking sheet…';
 $('refresh-btn').disabled=state.refreshing;$('refresh-btn').innerHTML=`<span class="rotate">↻</span> ${state.refreshing?'Refreshing':'Refresh'}`;
}
function qualityMessages(rows,period){
 const msg=[];
 if(rows.some(r=>periodByKey(r.period)?.year===null))msg.push('The Sheet does not specify a year for these months; they are sorted by calendar month, not confirmed chronology.');
 const dup=[...new Set(rows.filter(r=>r.duplicate).map(r=>byId(r.employeeId)?.name).filter(Boolean))];
 if(dup.length)msg.push(`${dup.join(', ')}: more than one section has the same month. Those rows are visible in People but excluded from totals until the labels are corrected.`);
 const conflicts=rows.filter(r=>r.scoreConflict||r.statusConflict).length;if(conflicts)msg.push(`${conflicts} record(s) have reported results that conflict with target / actual values. Conflicting percentages are excluded from averages.`);
 if(!period&&!state.refreshing)msg.push('No reporting periods are loaded. Check the employee tab connections and published Sheet.');
 return msg;
}
function renderQualityStrip(period){
 const rows=scopedRows(state.currentCompany,period),messages=qualityMessages(rows,period),strip=$('quality-strip');strip.style.display=messages.length?'block':'none';
 strip.innerHTML=messages.length?`${esc(messages[0])}${messages.length>1?` <strong>+${messages.length-1} more check${messages.length>2?'s':''}.</strong>`:''} <button onclick="showTab('quality')">Review data health ↗</button>`:'';
}
function counter(value,percent=false){
 if(!Number.isFinite(value))return '—';const label=percent?pctText(value):numberText(value,0);
 return `<span class="count-up" data-value="${value}" data-percent="${percent?'1':'0'}" aria-label="${esc(label)}">${esc(label)}</span>`;
}
function animateCounters(){
 if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 document.querySelectorAll('.count-up').forEach(el=>{const target=Number(el.dataset.value),pct=el.dataset.percent==='1',start=performance.now(),duration=650;
  function frame(now){if(!el.isConnected)return;const t=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-t,3),v=target*ease;el.textContent=pct?pctText(v):numberText(v,0);if(t<1)requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
 });
}
function renderStats(period,rows){
 const company=state.currentCompany,people=eligiblePeople(company,true),summary=summarize(rows),reporting=people.filter(e=>rows.some(r=>r.employeeId===e.id)).length,forecast=forecastFor(company,period);
 const cards=[
  {label:'People in scope',icon:'◉',value:people.length,sub:period?`${reporting} with records this period`:'Waiting for a period'},
  {label:'KPI records',icon:'▦',value:period?summary.rows:null,sub:`${summary.duplicates} duplicate rows excluded`},
  {label:'Average recorded %',icon:'◔',value:summary.avg,percent:true,sub:`${summary.scored} usable numeric results`},
  {label:'KPIs met rate',icon:'✓',value:summary.metRate,percent:true,sub:`${summary.met} of ${summary.assessed} assessed`},
  {label:'Indicative next period',icon:'↗',value:forecast?forecast.forecast:null,percent:true,sub:forecast?`${forecast.count} matched KPIs · illustrative`:'Not enough comparable data'}
 ];
 $('executive-cards').innerHTML=cards.map(c=>`<div class="stat-card"><div class="stat-top"><span class="stat-label">${esc(c.label)}</span><span class="stat-icon" aria-hidden="true">${esc(c.icon)}</span></div><div class="stat-value">${counter(c.value,c.percent)}</div><div class="stat-sub">${esc(c.sub)}</div></div>`).join('');
}
function renderAttention(rows){
 const flagged=validRows(rows).filter(r=>r.status==='not-met'&&!r.statusConflict);
 if(!flagged.length)return displayEmpty('No assessed not-met records in this selection.');
 const sorted=flagged.slice().sort((a,b)=>(Number.isFinite(a.score)?a.score:1e9)-(Number.isFinite(b.score)?b.score:1e9)).slice(0,5);
 return `<div class="insight-list">${sorted.map(r=>`<div class="insight-item"><div class="insight-mark">!</div><button class="insight-main insight-button" onclick="focusPerson('${esc(r.employeeId)}')"><strong>${esc(r.kpi)}</strong><span>${esc(byId(r.employeeId).name)} · ${r.statusBasis==='reported'?'Source status':'Calculated status'}</span></button><span class="insight-val">${Number.isFinite(r.score)&&!r.scoreConflict?pctText(r.score):'Not met'}</span></div>`).join('')}</div><p class="chart-note">Showing ${sorted.length} of ${flagged.length} assessed not-met records. Select a person to investigate.</p>`;
}
function renderMovement(company,period){
 const pairs=matchedPairs(company,period,true),moved=pairs.filter(p=>Math.abs(p.delta)>.05).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,5);
 if(!moved.length)return displayEmpty(pairs.length?`No recorded percentage-point change among ${pairs.length} matched KPIs.`:'No comparable KPI pairs in the previous period.');
 return `<div class="insight-list">${moved.map(p=>`<div class="insight-item"><div class="insight-mark" style="background:${p.delta>=0?'#eaf8f0':'#fff1ef'};color:${p.delta>=0?'#168765':'#c64949'}">${p.delta>=0?'↑':'↓'}</div><button class="insight-main insight-button" onclick="focusPerson('${esc(p.current.employeeId)}')"><strong>${esc(p.current.kpi)}</strong><span>${esc(byId(p.current.employeeId).name)} · ${pctText(p.old.score)} → ${pctText(p.current.score)}</span></button><span class="insight-val" style="color:${p.delta>=0?'#168765':'#c64949'}">${differenceText(p.delta)}</span></div>`).join('')}</div><p class="chart-note">${pairs.length} comparable pairs across consecutive periods; differences are percentage points, not percent change.</p>`;
}
function renderForecast(company,period){
 const f=forecastFor(company,period),cells=f?[
  ['Matched KPIs',numberText(f.count,0),'Same person & KPI'],['Previous matched avg',pctText(f.oldAvg),periodShort(f.previous)],['Selected matched avg',pctText(f.newAvg),periodShort(period)],['Indicative next period',pctText(f.forecast),'Simple extrapolation']
 ]:[['Matched KPIs','—','At least three needed'],['Previous matched avg','—','Not enough data'],['Selected matched avg','—','Not enough data'],['Indicative next period','—','Not enough data']];
 $('overview-forecast').innerHTML=cells.map(([l,v,sub])=>`<div class="forecast-cell"><span>${esc(l)}</span><strong>${esc(v)}</strong><small>${esc(sub)}</small></div>`).join('');
}
function renderOverview(period){
 const company=state.currentCompany,rows=scopedRows(company,period),summary=summarize(rows),periods=monthList(company),people=eligiblePeople(company,true);
 renderStats(period,rows);
 $('overview-trend').innerHTML=renderTrend(periods,[periodSeries(company,periods,p=>scopedRows(company,p),COMPANIES[company].name,COMPANIES[company].color)]);
 $('overview-donut').innerHTML=renderDonut(summary);
 $('overview-person-bars').innerHTML=renderBars(people.map(e=>({label:e.name,value:summarize(rows.filter(r=>r.employeeId===e.id)).avg})));
 $('overview-coverage').innerHTML=renderStacks(people.map(e=>({label:e.name,s:summarize(rows.filter(r=>r.employeeId===e.id))})));
 $('overview-attention').innerHTML=renderAttention(rows);$('overview-movement').innerHTML=renderMovement(company,period);renderForecast(company,period);
}
