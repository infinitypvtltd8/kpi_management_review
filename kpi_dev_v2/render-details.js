function statusHtml(r){
 if(r.statusConflict)return '<span class="status-badge status-review">Review status</span><div class="table-review">Source conflicts</div>';
 if(!r.status)return '<span class="status-badge status-unknown">Not assessed</span>';
 const ok=r.status==='met';return `<span class="status-badge ${ok?'status-met':'status-miss'}">${ok?'Met':'Not met'}</span>${r.statusBasis==='calculated'?'<div class="table-meta">Calculated</div>':''}`;
}
function scoreHtml(r){
 if(!Number.isFinite(r.score))return '—';
 const title=r.scoreKind==='ratio'?'Calculated as actual divided by target.':r.scoreKind==='reported-value'?'Percentage value recorded in the Sheet; not necessarily a target-attainment ratio.':'Percentage reported in the Sheet.';
 return `<strong title="${esc(title)}">${pctText(r.score,2)}</strong>${r.scoreConflict?'<div class="table-review">Conflicts · excluded from avg</div>':r.scoreKind==='ratio'?'<div class="table-meta">Calculated</div>':''}`;
}
function renderPeople(period){
 const company=state.currentCompany,roster=eligiblePeople(company,false),allForPeriod=recordsFor(company,period);
 $('people-cards').innerHTML=roster.map(e=>{
  const own=allForPeriod.filter(r=>r.employeeId===e.id),s=summarize(own),has=own.length>0,selected=state.selectedEmployee===e.id,latest=[...new Set((state.records[e.id]||[]).map(r=>r.period))].sort((a,b)=>periodOrder(b)-periodOrder(a))[0];
  const note=state.source[e.id].status==='unavailable'?'Sheet tab could not be loaded':!period?(state.refreshing?'Loading employee tab…':'No data loaded'):own.some(r=>r.duplicate)?'Duplicate month sections require review':has?`${s.assessed} of ${s.rows} records assessed`:latest?`No rows this month · other section: ${periodShort(latest)}`:'No records for this month';
  return `<button class="person-card ${selected?'selected':''}" onclick="changePerson('${selected?'all':esc(e.id)}')" aria-pressed="${selected}"><div class="person-head"><span class="avatar">${esc(e.avatar)}</span><div><div class="person-name">${esc(e.name)}</div><div class="person-role">${esc(e.role)}</div></div></div><div class="person-metrics"><div><strong>${pctText(s.avg)}</strong><small>Recorded</small></div><div><strong>${s.assessed?`${s.met}/${s.assessed}`:'—'}</strong><small>Met / assessed</small></div><div><strong>${has?s.rows:'—'}</strong><small>Records</small></div></div><div class="person-note">${esc(note)}</div></button>`;
 }).join('')||displayEmpty('No employees in this selection.');
 const periods=monthList(company),label=state.selectedEmployee==='all'?'All people in current filters':byId(state.selectedEmployee).name;
 $('people-trend-subtitle').textContent=state.selectedEmployee==='all'?'Cards show people in the selected department; select one for individual history.':`Showing ${label} across available months.`;
 $('people-trend').innerHTML=renderTrend(periods,[periodSeries(company,periods,p=>scopedRows(company,p),label,COMPANIES[company].color)]);
 const scores=validRows(scopedRows(company,period)).filter(r=>Number.isFinite(r.score)&&!r.scoreConflict).map(r=>r.score);
 const buckets=[{label:'Below 70%',value:scores.filter(x=>x<70).length},{label:'70% to <100%',value:scores.filter(x=>x>=70&&x<100).length},{label:'100% or more',value:scores.filter(x=>x>=100).length}];
 $('people-distribution').innerHTML=scores.length?renderBars(buckets,{percent:false}):displayEmpty('No usable numeric results for this selection.');
 renderKpiTable();
}
function tableRows(){
 const q=state.tableSearch.toLocaleLowerCase().trim(),status=state.tableStatus;
 return scopedRows(state.currentCompany,selectedPeriod()).filter(r=>{
  const e=byId(r.employeeId),hay=[e.name,e.dept,r.kpi,r.description,r.target,r.actual,r.notes].join(' ').toLocaleLowerCase();
  if(q&&!hay.includes(q))return false;
  if(status==='review')return r.duplicate||r.scoreConflict||r.statusConflict;
  if(status==='unknown')return !r.status||r.statusConflict;
  if(status==='met'||status==='not-met')return r.status===status&&!r.statusConflict;
  return true;
 });
}
function renderKpiTable(){
 const rows=tableRows(),body=$('kpi-table-body');$('table-count').textContent=`${rows.length} shown`;$('csv-button').disabled=!rows.length;
 if(!rows.length){body.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:28px;color:#9aa6b6;">${state.refreshing?'Loading KPI data…':'No records match this selection.'}</td></tr>`;return;}
 body.innerHTML=rows.map(r=>{
  const e=byId(r.employeeId),unit=unitOf(e.id),desc=r.description?`<div class="table-meta">${esc(r.description)}</div>`:'',duplicate=r.duplicate?`<div class="table-review">Duplicate month · source section ${r.section}/${r.sectionCount} · excluded from totals</div>`:'',notes=r.notes?`<details><summary>View notes</summary><div class="note-content">${esc(r.notes)}</div></details>`:'—';
  return `<tr><td><strong>${esc(e.name)}</strong><div class="table-meta">${esc(unit?unit.name:ownership(e))}</div></td><td class="kpi-text"><strong>${esc(r.kpi)}</strong>${desc}${duplicate}</td><td class="target-cell">${esc(r.target||'—')}</td><td>${esc(r.actual||'—')}</td><td>${scoreHtml(r)}</td><td>${esc(differenceText(priorDelta(r)))}</td><td>${statusHtml(r)}</td><td class="notes-cell">${notes}</td></tr>`;
 }).join('');
}
function csvCell(value){let s=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function exportCsv(){
 const rows=tableRows();if(!rows.length)return;
 const head=['Company','Period','Employee','KPI ownership','Role-based review group','KPI area','Description','Target','Actual / source result','Recorded %','Score basis','Status','Status basis','Notes','Data-quality flags'];
 const data=rows.map(r=>{const e=byId(r.employeeId),u=unitOf(e.id),flags=[r.duplicate?'Duplicate month section':'',r.scoreConflict?'Reported % conflicts with target / actual':'',r.statusConflict?'Status conflicts with target / actual':''].filter(Boolean).join('; ');
  return [COMPANIES[e.company].name,periodLabel(r.period),e.name,ownership(e),u?.name||'',r.kpi,r.description,r.target,r.actual,Number.isFinite(r.score)?pctText(r.score,2):'',r.scoreKind||'',r.status==='met'?'Met':r.status==='not-met'?'Not met':'Not assessed',r.statusBasis||'',r.notes,flags];});
 const output='\uFEFF'+[head,...data].map(row=>row.map(csvCell).join(',')).join('\r\n');
 const blob=new Blob([output],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${state.currentCompany}-kpi-${selectedPeriod()||'records'}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
// Colors represent assessment status, not arbitrary percentage thresholds.
function departmentKpiColor(r){return r.duplicate||r.statusConflict||r.scoreConflict?'review':r.status==='met'?'met':r.status==='not-met'?'miss':'unknown';}
function departmentAssessment(d,period){
 const rows=departmentRows(d.name,period),s=summarize(rows),owners=peopleFor(state.currentCompany).filter(e=>ownership(e)===d.name&&(state.selectedEmployee==='all'||state.selectedEmployee===e.id));
 const incomplete=owners.some(e=>state.source[e.id].status!=='live'||!rows.some(r=>r.employeeId===e.id))||s.unassessed>0||s.duplicates>0||s.conflicts>0;
 if(!s.assessed)return {color:incomplete&&s.rows?'review':'unknown',label:incomplete&&s.rows?'Needs review':'No assessed KPIs'};
 if(s.miss)return {color:s.met||incomplete?'review':'miss',label:s.met||incomplete?'Mixed / needs attention':'All assessed not met'};
 return incomplete?{color:'review',label:'Met, with incomplete data'}:{color:'met',label:'All assessed met'};
}
function visibleDepartments(){
 const person=state.selectedEmployee==='all'?null:byId(state.selectedEmployee);
 return departmentsFor(state.currentCompany).filter(d=>(state.selectedDepartment==='all'||d.name===state.selectedDepartment)&&(!person||ownership(person)===d.name));
}
function departmentRows(name,period){return scopedRows(state.currentCompany,period).filter(r=>ownership(byId(r.employeeId))===name);}
function renderDepartments(period){
 const depts=visibleDepartments(),stats=depts.map(d=>({d,s:summarize(departmentRows(d.name,period))}));
 $('department-cards').innerHTML=stats.map(({d,s})=>`<button class="review-card clickable dept-card-${departmentAssessment(d,period).color} ${state.selectedDepartment===d.name?'selected':''}" aria-pressed="${state.selectedDepartment===d.name}" onclick="focusDepartment('${esc(d.name)}')"><div class="review-kicker">${d.shared?'Cross-department':'Department'}</div><h4>${esc(d.name)}</h4><div class="review-line">Head: ${esc(d.head)}<br>Roster: ${esc(d.memberIds.map(id=>byId(id)?.name).filter(Boolean).join(', '))}</div><div class="review-value">${pctText(s.avg)}</div><div class="review-foot">${s.rows} records · ${s.met}/${s.assessed} assessed met</div><div class="department-assessment">${esc(departmentAssessment(d,period).label)}</div><div class="review-arrow">${state.selectedDepartment===d.name?'Show all departments':'Inspect KPIs ↗'}</div></button>`).join('')||displayEmpty('No department matches this selection.');
 const detailRows=scopedRows(state.currentCompany,period),people=eligiblePeople(state.currentCompany,true),issues=people.filter(e=>['unavailable','stale','loading'].includes(state.source[e.id].status));
 $('department-detail-scope').textContent=`${state.selectedDepartment==='all'?'All KPI ownership groups':state.selectedDepartment} · ${period?periodLabel(period):'No reporting period'} · ${state.selectedEmployee==='all'?'All employees':byId(state.selectedEmployee).name}`;
 $('department-detail-count').textContent=`${detailRows.length} records`;
 $('department-source-note').textContent=issues.length?`Source availability: ${issues.map(e=>e.name+' ('+state.source[e.id].status+')').join(', ')}. Missing data is not zero; stale data is from the last successful in-session load.`:'Only KPI records available in the employee sheets are shown. Department ownership is role-based, not a separate departmental dataset.';
 $('department-kpi-table').innerHTML=detailRows.length?detailRows.map(r=>{const e=byId(r.employeeId);return `<tr class="dept-row-${departmentKpiColor(r)}"><td><strong>${esc(ownership(e))}</strong><div class="table-meta">${esc(e.name)}</div></td><td class="kpi-text"><strong>${esc(r.kpi)}</strong>${r.description?`<div class="table-meta">${esc(r.description)}</div>`:''}${r.duplicate?'<div class="table-review">Duplicate month · excluded from totals</div>':''}</td><td class="target-cell">${esc(r.target||'—')}</td><td>${esc(r.actual||'—')}</td><td>${scoreHtml(r)}</td><td>${statusHtml(r)}</td><td class="notes-cell">${r.notes?`<details><summary>View notes</summary><div class="note-content">${esc(r.notes)}</div></details>`:'—'}</td></tr>`;}).join(''):`<tr><td colspan="7">${state.refreshing?'Loading KPI data…':'No KPI records available for this selection.'}</td></tr>`;
 $('department-bars').innerHTML=renderBars(stats.map(({d,s})=>({label:d.name,value:s.avg})));
 $('department-status').innerHTML=renderStacks(stats.map(({d,s})=>({label:d.name,s})));
 const periods=monthList(state.currentCompany);
 $('department-heatmap').innerHTML=periods.length&&depts.length?`<table class="matrix-table"><thead><tr><th>KPI ownership</th>${periods.map(p=>`<th>${esc(periodShort(p))}</th>`).join('')}</tr></thead><tbody>${depts.map(d=>`<tr><td><strong>${esc(d.name)}</strong></td>${periods.map(p=>{const s=summarize(departmentRows(d.name,p));return `<td><span class="heat ${s.avg===null?'empty':''}" title="${esc(`${periodLabel(p)} · ${s.scored} usable numeric results`)}">${pctText(s.avg)}</span></td>`;}).join('')}</tr>`).join('')}</tbody></table>`:displayEmpty('No history is available.');
 $('department-table').innerHTML=stats.length?stats.map(({d,s})=>`<tr><td><strong>${esc(d.name)}</strong>${d.shared?'<div class="table-meta">Cross-department leadership</div>':''}</td><td>${esc(d.head)}</td><td>${d.memberIds.length}<div class="table-meta">${esc(d.memberIds.map(id=>byId(id)?.name).filter(Boolean).join(', '))}</div></td><td>${s.rows}</td><td>${pctText(s.avg)}</td><td>${s.met} / ${s.assessed}</td><td>${s.unassessed}</td></tr>`).join(''):'<tr><td colspan="7">No departments in scope.</td></tr>';
}
function visibleUnits(){
 const ids=new Set(eligiblePeople(state.currentCompany,true).map(e=>e.id));return UNITS[state.currentCompany].filter(u=>u.members.some(id=>ids.has(id)));
}
function renderUnits(){
 const company=state.currentCompany,period=selectedPeriod(),units=visibleUnits(),rows=scopedRows(company,period);
 if(state.selectedUnit!=='all'&&!units.some(u=>u.id===state.selectedUnit))state.selectedUnit='all';
 $('unit-select').innerHTML='<option value="all">All review groups</option>'+units.map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('');$('unit-select').value=state.selectedUnit;
 const selected=units.find(u=>u.id===state.selectedUnit)||null,selectedRows=selected?unitRows(selected,rows):rows;
 $('unit-cards').innerHTML=units.map(u=>{const s=summarize(unitRows(u,rows)),active=state.selectedUnit===u.id;return `<button class="review-card clickable ${active?'selected':''}" onclick="selectUnit('${esc(u.id)}')" aria-pressed="${active}"><div class="review-kicker">${esc(u.dept)}</div><h4>${esc(u.name)}</h4><div class="review-line">${esc(u.members.map(id=>byId(id)?.name).filter(Boolean).join(', '))}</div><div class="review-value">${pctText(s.avg)}</div><div class="review-foot">${s.rows} records · ${s.met}/${s.assessed} assessed met</div><div class="review-arrow">${active?'Selected ✓':'Review group ↗'}</div></button>`;}).join('')||displayEmpty('No review groups in this selection.');
 const periods=monthList(company),label=selected?selected.name:'All review groups';$('unit-trend-subtitle').textContent=`${label} · available numeric results across months.`;
 $('unit-trend').innerHTML=renderTrend(periods,[periodSeries(company,periods,p=>{const base=scopedRows(company,p);return selected?unitRows(selected,base):base;},label,COMPANIES[company].color)]);
 $('unit-donut').innerHTML=renderDonut(summarize(selectedRows));
 $('unit-bars').innerHTML=renderBars(units.map(u=>({label:u.name,value:summarize(unitRows(u,rows)).avg})));
 const counts=new Map();validRows(selectedRows).forEach(r=>{const key=workTheme(r);counts.set(key,(counts.get(key)||0)+1);});
 $('unit-themes').innerHTML=counts.size?renderBars([...counts].sort((a,b)=>b[1]-a[1]).slice(0,7).map(([label,value])=>({label,value})),{percent:false}):displayEmpty('No KPI themes for this selection.');
 const tableUnits=selected?[selected]:units;
 $('unit-table').innerHTML=tableUnits.length?tableUnits.map(u=>{const s=summarize(unitRows(u,rows));return `<tr><td><strong>${esc(u.name)}</strong></td><td>${esc(u.dept)}</td><td>${esc(u.members.map(id=>byId(id)?.name).filter(Boolean).join(', '))}</td><td>${s.rows}</td><td>${pctText(s.avg)}</td><td>${s.met} / ${s.assessed}</td><td>${s.unassessed}</td></tr>`;}).join(''):'<tr><td colspan="7">No review groups in scope.</td></tr>';
}
function renderSubsidiaries(period){
 const items=['apeiro','xguard'].map(key=>{const rows=recordsFor(key,period),s=summarize(rows),people=peopleFor(key),withRows=people.filter(e=>rows.some(r=>r.employeeId===e.id)).length;return {key,s,people,withRows};});
 for(const {key,s,people,withRows} of items){
  $(`compare-${key}`).innerHTML=`<div class="compare-card-head"><img class="compare-logo ${key==='xguard'?'xguard':''}" src="${LOGOS[key]}" alt="${esc(COMPANIES[key].name)} logo"><div><strong>${esc(COMPANIES[key].name)}</strong><small>${esc(period?periodLabel(period):'No reporting period')}</small></div></div><div class="compare-values"><div><strong>${pctText(s.avg)}</strong><small>Average recorded</small></div><div><strong>${pctText(s.metRate)}</strong><small>Met of assessed</small></div><div><strong>${withRows}/${people.length}</strong><small>People reporting</small></div></div><p class="chart-note">${s.rows} records · ${s.scored} numeric results · ${s.unassessed} unassessed</p>`;
 }
 const periods=[...new Set([...availablePeriods('apeiro'),...availablePeriods('xguard')])].sort((a,b)=>periodOrder(b)-periodOrder(a)).slice(0,6).reverse();
 $('compare-trend').innerHTML=renderTrend(periods,items.map(({key})=>periodSeries(key,periods,p=>recordsFor(key,p),COMPANIES[key].name,COMPANIES[key].color)));
 $('compare-status').innerHTML=renderBars(items.map(({key,s})=>({label:COMPANIES[key].name,value:s.metRate,color:COMPANIES[key].color})));
 $('compare-table').innerHTML=items.map(({key,s,people,withRows})=>`<tr><td><strong>${esc(COMPANIES[key].name)}</strong></td><td>${withRows} / ${people.length}</td><td>${s.rows}</td><td>${s.scored}</td><td>${pctText(s.avg)}</td><td>${s.met} / ${s.assessed}</td><td>${s.unassessed}</td></tr>`).join('');
}
function renderHealth(period){
 const company=state.currentCompany,rows=scopedRows(company,period),people=peopleFor(company),messages=qualityMessages(rows,period);
 const missing=eligiblePeople(company,true).filter(e=>state.source[e.id].status==='live'&&!rows.some(r=>r.employeeId===e.id));
 if(period&&missing.length)messages.push(`No ${periodShort(period)} rows found for: ${missing.map(e=>e.name).join(', ')}. A missing report is not counted as zero.`);
 $('health-time').textContent=state.lastChecked?'Checked '+state.lastChecked.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'Not checked yet';
 $('health-sources').innerHTML=people.map(e=>{const s=state.source[e.id],map={live:['Connected','pill-good'],stale:['Earlier data','pill-warn'],unavailable:['Unavailable','pill-bad'],loading:['Loading','pill-neutral']},v=map[s.status]||map.loading;return `<div class="source-item"><span>${esc(e.name)}<small>${(state.records[e.id]||[]).length} rows across all periods</small></span><span class="mini-pill ${v[1]}">${v[0]}</span></div>`;}).join('');
 $('health-issues').innerHTML=messages.length?`<div class="insight-list">${messages.map(m=>`<div class="insight-item"><span class="insight-mark" style="background:#fff8e8;color:#a06c00">!</span><div class="insight-main"><strong>${esc(m)}</strong></div></div>`).join('')}</div>`:displayEmpty('No checks triggered for this selection.');
 const methods=[['Recorded percentage','An unweighted average of available source percentages and compatible actual/target ratios. KPI meanings differ, so averages are indicative.'],['Met / assessed','Uses a stated Met/Not met result or a calculation when target and actual are comparable numbers. Calculated status assumes higher is better.'],['Not assessed','A missing or non-comparable status stays unassessed, not zero or not met.'],['Duplicate & conflicting rows','Duplicate month sections are excluded from totals. A conflicting percentage is shown but excluded from the average.'],['Forecast','Simple linear extrapolation of at least three matched employee/KPI pairs; illustrative only, not a confidence estimate.'],['Units & themes','Units are role-based groups based on the supplied structure. Work themes use keyword matching against KPI titles and are not official unit designations.']];
 $('health-method').innerHTML=`<div class="insight-list">${methods.map(([title,description])=>`<div class="insight-item"><span class="insight-mark" style="background:var(--accent-soft);color:var(--accent-dark)">i</span><div class="insight-main"><strong>${esc(title)}</strong><span>${esc(description)}</span></div></div>`).join('')}</div>`;
}
function renderAll(){
 renderLandingStatus();if(!state.currentCompany)return;
 const period=updateControls();renderSourceStatus();renderQualityStrip(period);renderOverview(period);renderPeople(period);renderDepartments(period);renderUnits();renderSubsidiaries(period);renderHealth(period);showTab(state.activeTab);animateCounters();
}
