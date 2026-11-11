/* The report center uses the same parser, exclusions and definitions as the
   dashboard. Reports are snapshots of the available in-memory Sheet data. */
const reportState={scope:'current',range:'selected',selected:'executive'};
const REPORTS=[
 {id:'executive',icon:'◫',name:'Executive summary',sheet:'Executive summary',file:'01_executive_summary.csv',description:'Company-level performance, status and source coverage for each month.'},
 {id:'people',icon:'◉',name:'People performance',sheet:'People performance',file:'02_people_performance.csv',description:'An individual review for every person and period, including missing reports.'},
 {id:'departments',icon:'▦',name:'Department performance',sheet:'Departments',file:'03_department_performance.csv',description:'X GUARD KPI ownership, department heads, coverage and results.'},
 {id:'units',icon:'⬡',name:'Units & review groups',sheet:'Units and groups',file:'04_units_and_groups.csv',description:'Role-based team reviews; these are not official Sheet unit fields.'},
 {id:'comparison',icon:'◈',name:'Subsidiary comparison',sheet:'Company comparison',file:'05_subsidiary_comparison.csv',description:'Side-by-side APEIRO and X GUARD monthly results. Select both companies.'},
 {id:'details',icon:'☷',name:'Complete KPI records',sheet:'KPI detail',file:'06_complete_kpi_records.csv',description:'All source-derived records, targets, results, notes and exclusion flags.'},
 {id:'followup',icon:'!',name:'Attention & follow-up',sheet:'Follow up',file:'07_attention_and_follow_up.csv',description:'Not-met, unassessed, duplicate and conflicting records with source notes.'},
 {id:'movement',icon:'↗',name:'KPI movement',sheet:'KPI movement',file:'08_kpi_movement.csv',description:'Previous-period changes for uniquely matched employee and KPI pairs.'},
 {id:'themes',icon:'◇',name:'Work themes',sheet:'Work themes',file:'09_work_themes.csv',description:'Keyword-inferred workstream categories and their available KPI results.'},
 {id:'coverage',icon:'◔',name:'Reporting coverage',sheet:'Reporting coverage',file:'10_reporting_coverage.csv',description:'People and periods with rows, missing rows, duplicates or unavailable tabs.'},
 {id:'issues',icon:'⚑',name:'Data-quality checks',sheet:'Data quality',file:'11_data_quality_checks.csv',description:'Year, duplicate, conflict, missing-row and connection issues.'},
 {id:'sources',icon:'⌁',name:'Source connections',sheet:'Source connections',file:'12_source_connections.csv',description:'Employee tab status, last successful load and period coverage.'},
 {id:'roster',icon:'♧',name:'Roster & ownership',sheet:'Roster and ownership',file:'13_roster_and_ownership.csv',description:'People, roles, roster departments and the single KPI ownership used in reports.'},
 {id:'projection',icon:'↗',name:'Illustrative projection',sheet:'Illustrative projection',file:'14_illustrative_projection.csv',description:'A simple next-period extrapolation using at least three matched KPIs.'}
];
const REPORT_METRIC_HEADERS=['Valid KPI records','Usable numeric results','Average recorded (%)','Assessed records','Met records','Not met records','Unassessed records','Met rate (%)','Duplicate rows excluded','Conflicting records'];
function reportNumber(n,digits=2){return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function reportSourceLabel(status){return {live:'Live',stale:'Stale - last successful in-session data',unavailable:'Unavailable',loading:'Loading'}[status]||'Unknown';}
function reportSourceTime(source){return source?.lastSuccess?source.lastSuccess.toISOString():'';}
function reportMetrics(summary,available=true){return available?[summary.rows,summary.scored,reportNumber(summary.avg),summary.assessed,summary.met,summary.miss,summary.unassessed,reportNumber(summary.metRate),summary.duplicates,summary.conflicts]:REPORT_METRIC_HEADERS.map(()=>null);}
function reportContext(){
 const group=reportState.scope==='group',companies=group?['apeiro','xguard']:[state.currentCompany];
 const people=group?EMPLOYEES.slice():eligiblePeople(state.currentCompany,true);
 const ids=new Set(people.map(e=>e.id)),allScoped=people.flatMap(e=>(state.records[e.id]||[]));
 const selected=selectedPeriod(),allPeriods=[...new Set(companies.flatMap(c=>availablePeriods(c)))].sort((a,b)=>periodOrder(a)-periodOrder(b));
 const periods=reportState.range==='all'?allPeriods:(selected?[selected]:[]),periodSet=new Set(periods);
 const rows=allScoped.filter(r=>periodSet.has(r.period));
 const source=Object.fromEntries(people.map(e=>[e.id,{...state.source[e.id]}]));
 const scopeText=group?'Both companies · whole group':`${COMPANIES[state.currentCompany].name}${state.selectedDepartment!=='all'?' · '+state.selectedDepartment+' ownership':''}${state.selectedEmployee!=='all'?' · '+(byId(state.selectedEmployee)?.name||''):''}`;
 const rangeText=reportState.range==='all'?'All available months (union of months in scope)':selected?periodLabel(selected):'No selected reporting period';
 const scopeDetail=group?'Includes all departments and employees; company, department and employee filters are ignored.':'Uses company, department ownership and employee filters. People-table search/status and unit selection are not applied.';
 const live=people.filter(e=>source[e.id].status==='live').length,stale=people.filter(e=>source[e.id].status==='stale').length,unavailable=people.filter(e=>source[e.id].status==='unavailable').length,loading=people.filter(e=>source[e.id].status==='loading').length;
 return {group,companies,people,ids,allScoped,periods,rows,source,scopeText,scopeDetail,rangeText,selected,live,stale,unavailable,loading,generated:new Date(),checked:state.lastChecked};
}
function reportRows(ctx,company,period){return ctx.allScoped.filter(r=>byId(r.employeeId)?.company===company&&r.period===period);}
function reportPeople(ctx,company){return ctx.people.filter(e=>e.company===company);}
function reportAvailability(ctx,employee,period,rows){
 const status=ctx.source[employee.id]?.status;
 if(status==='unavailable'||status==='loading')return 'Source unavailable - data unknown';
 const prefix=status==='stale'?'Stale source; ':'';
 if(!rows.length)return prefix+'No rows found for this month';
 if(rows.every(r=>r.duplicate))return prefix+'Duplicate month sections - excluded';
 if(rows.some(r=>r.duplicate))return prefix+'Contains duplicate sections';
 return prefix+'Rows available';
}
function reportFlags(r){
 return [r.duplicate?`Duplicate month section ${r.section}/${r.sectionCount}; excluded from totals`:'',r.scoreConflict?'Recorded percentage conflicts with target / actual; excluded from average':'',r.statusConflict?'Reported status conflicts with target / actual; excluded from assessment':''].filter(Boolean).join('; ');
}
function reportStatus(r){return r.statusConflict?'Needs review':r.status==='met'?'Met':r.status==='not-met'?'Not met':'Not assessed';}
function reportSourceCounts(ctx,people){
 const counts={live:0,stale:0,unavailable:0,loading:0};people.forEach(e=>{const s=ctx.source[e.id]?.status;if(s in counts)counts[s]++;});
 return `${counts.live} live; ${counts.stale} stale; ${counts.unavailable} unavailable; ${counts.loading} loading`;
}
function reportPairs(ctx,company,period){
 const previous=previousKey(period);if(!previous)return [];
 const current=uniqueScoreMap(reportRows(ctx,company,period)),prior=uniqueScoreMap(reportRows(ctx,company,previous)),out=[];
 for(const [key,r] of current){const old=prior.get(key);if(old&&old.scoreKind===r.scoreKind)out.push({current:r,old,delta:r.score-old.score,previous});}
 return out;
}
function buildReports(ctx){
 const result={};
 function add(id,headers,rows,note=''){result[id]={headers,rows,note};}
 const executive=[];
 for(const period of ctx.periods)for(const company of ctx.companies){
  const people=reportPeople(ctx,company),rows=reportRows(ctx,company,period),s=summarize(rows);
  executive.push([periodLabel(period),COMPANIES[company].name,people.length,people.filter(e=>rows.some(r=>r.employeeId===e.id)).length,reportSourceCounts(ctx,people),...reportMetrics(s)]);
 }
 add('executive',['Period','Company','People in scope','People with source rows','Source coverage',...REPORT_METRIC_HEADERS],executive,'Counts include only available live or marked-stale source data. An empty percentage is not zero performance.');
 const personRows=[],coverage=[];
 for(const period of ctx.periods)for(const company of ctx.companies)for(const e of reportPeople(ctx,company)){
  const rows=reportRows(ctx,company,period).filter(r=>r.employeeId===e.id),source=ctx.source[e.id],available=!['unavailable','loading'].includes(source.status),summary=summarize(rows),availability=reportAvailability(ctx,e,period,rows);
  personRows.push([periodLabel(period),COMPANIES[company].name,e.name,ownership(e),unitOf(e.id)?.name||'',availability,reportSourceLabel(source.status),available?rows.length:null,...reportMetrics(summary,available)]);
  coverage.push([periodLabel(period),COMPANIES[company].name,e.name,ownership(e),availability,reportSourceLabel(source.status),reportSourceTime(source),available?rows.length:null,available?summary.rows:null,available?summary.duplicates:null,available?summary.assessed:null,available?summary.unassessed:null]);
 }
 add('people',['Period','Company','Employee','KPI ownership','Role-based review group','Reporting availability','Source state','Source rows including duplicates',...REPORT_METRIC_HEADERS],personRows,'Unavailable tabs are unknown, not zero; rows found in duplicate sections are excluded from totals.');
 const departmentRowsOut=[];
 if(ctx.companies.includes('xguard'))for(const period of ctx.periods)for(const d of DEPARTMENTS){
  const members=reportPeople(ctx,'xguard').filter(e=>ownership(e)===d.name);if(!members.length)continue;
  const ids=new Set(members.map(e=>e.id)),rows=reportRows(ctx,'xguard',period).filter(r=>ids.has(r.employeeId));
  departmentRowsOut.push([periodLabel(period),'X GUARD',d.name,d.head,members.map(e=>e.name).join(', '),members.filter(e=>rows.some(r=>r.employeeId===e.id)).length,reportSourceCounts(ctx,members),...reportMetrics(summarize(rows))]);
 }
 add('departments',['Period','Company','KPI ownership','Department head','Employees in scope (KPI ownership)','People with source rows','Source coverage',...REPORT_METRIC_HEADERS],departmentRowsOut,'X GUARD only. Uthpala’s recruitment KPIs belong to HR & Recruitment; Nimmi’s leadership KPIs are separate. Roster membership can overlap.');
 const unitOutput=[];
 for(const period of ctx.periods)for(const company of ctx.companies)for(const u of UNITS[company]){
  const members=reportPeople(ctx,company).filter(e=>u.members.includes(e.id));if(!members.length)continue;
  const ids=new Set(members.map(e=>e.id)),rows=reportRows(ctx,company,period).filter(r=>ids.has(r.employeeId));
  unitOutput.push([periodLabel(period),COMPANIES[company].name,u.name,u.dept,members.map(e=>e.name).join(', '),members.filter(e=>rows.some(r=>r.employeeId===e.id)).length,reportSourceCounts(ctx,members),...reportMetrics(summarize(rows))]);
 }
 add('units',['Period','Company','Role-based review group','KPI ownership','Employees in scope','People with source rows','Source coverage',...REPORT_METRIC_HEADERS],unitOutput,'Role-based review groups are derived from the supplied structure, not an official unit column in the Sheet.');
 const comparison=[];
 if(ctx.group)for(const period of ctx.periods){
  const a=summarize(reportRows(ctx,'apeiro',period)),x=summarize(reportRows(ctx,'xguard',period));
  comparison.push([periodLabel(period),a.rows,a.scored,reportNumber(a.avg),a.assessed,a.met,reportNumber(a.metRate),reportSourceCounts(ctx,reportPeople(ctx,'apeiro')),x.rows,x.scored,reportNumber(x.avg),x.assessed,x.met,reportNumber(x.metRate),reportSourceCounts(ctx,reportPeople(ctx,'xguard'))]);
 }
 add('comparison',['Period','APEIRO valid KPI records','APEIRO usable numeric results','APEIRO average recorded (%)','APEIRO assessed','APEIRO met','APEIRO met rate (%)','APEIRO source coverage','X GUARD valid KPI records','X GUARD usable numeric results','X GUARD average recorded (%)','X GUARD assessed','X GUARD met','X GUARD met rate (%)','X GUARD source coverage'],comparison,ctx.group?'Company KPI definitions and sample sizes differ, so this is not a like-for-like ranking.':'Select “Both companies · whole group” above to enable this report.');
 const detail=[],followup=[];
 for(const period of ctx.periods)for(const company of ctx.companies)for(const r of reportRows(ctx,company,period)){
  const e=byId(r.employeeId),flags=reportFlags(r),src=reportSourceLabel(ctx.source[e.id].status);
  const scoreIn=!r.duplicate&&!r.scoreConflict&&Number.isFinite(r.score),statusIn=!r.duplicate&&!r.statusConflict&&!!r.status;
  detail.push([periodLabel(period),COMPANIES[company].name,e.name,ownership(e),unitOf(e.id)?.name||'',workTheme(r),r.kpi,r.description,r.target,r.actual,reportNumber(r.score),r.scoreKind||'',scoreIn?'Yes':'No',reportStatus(r),r.statusBasis||'',statusIn?'Yes':'No',r.notes,flags,src]);
  if(r.duplicate||r.scoreConflict||r.statusConflict||r.status==='not-met'||!r.status){
   const category=r.duplicate?'Duplicate - review':r.scoreConflict||r.statusConflict?'Conflict - review':r.status==='not-met'?'Not met':'Not assessed';
   followup.push([periodLabel(period),COMPANIES[company].name,e.name,ownership(e),r.kpi,category,r.target,r.actual,reportStatus(r),r.statusBasis||'',r.notes,flags,src]);
  }
 }
 add('details',['Period','Company','Employee','KPI ownership','Role-based review group','Inferred work theme','KPI area','Description','Target','Actual / source result','Recorded value (%)','Score basis','Included in average?','Status for review','Status basis','Included in assessment?','Source notes','Data-quality flags','Source state'],detail,'Includes duplicate and conflicting records for audit. See the two inclusion columns before using a record in aggregates.');
 add('followup',['Period','Company','Employee','KPI ownership','KPI area','Attention category','Target','Actual / source result','Status for review','Status basis','Source notes / reasons / strategy','Data-quality flags','Source state'],followup,'A follow-up item is not an assigned task. No due dates, owners or corrective actions are invented.');
 const movement=[];
 for(const period of ctx.periods)for(const company of ctx.companies)for(const pair of reportPairs(ctx,company,period)){
  const r=pair.current,e=byId(r.employeeId);movement.push([periodLabel(period),periodLabel(pair.previous),COMPANIES[company].name,e.name,ownership(e),r.kpi,r.scoreKind,reportNumber(pair.old.score),reportNumber(r.score),reportNumber(pair.delta),reportStatus(r),reportSourceLabel(ctx.source[e.id].status)]);
 }
 add('movement',['Selected period','Previous period','Company','Employee','KPI ownership','KPI area','Score basis (matched)','Previous recorded (%)','Current recorded (%)','Change (percentage points)','Current status','Source state'],movement,'Only one-to-one employee/KPI matches with the same score basis are compared. The previous period can lie outside the selected export range.');
 const projection=[];
 for(const period of ctx.periods)for(const company of ctx.companies){
  const pairs=reportPairs(ctx,company,period),enough=pairs.length>=3,previous=previousKey(period),oldAvg=enough?mean(pairs.map(pair=>pair.old.score)):null,newAvg=enough?mean(pairs.map(pair=>pair.current.score)):null;
  projection.push([periodLabel(period),COMPANIES[company].name,previous?periodLabel(previous):'',pairs.length,reportNumber(oldAvg),reportNumber(newAvg),enough?reportNumber(Math.max(0,2*newAvg-oldAvg)):null,enough?'Illustrative only':'Not enough matched KPIs (minimum 3)',reportSourceCounts(ctx,reportPeople(ctx,company))]);
 }
 add('projection',['Selected period','Company','Previous period','Matched KPI pairs','Previous matched average (%)','Current matched average (%)','Indicative next-period value (%)','Interpretation','Source coverage'],projection,'A simple extrapolation from at least three matched employee/KPI pairs, clipped at zero. It is illustrative, not a prediction or confidence estimate.');
 const themes=[];
 for(const period of ctx.periods)for(const company of ctx.companies){
  const groups=new Map();validRows(reportRows(ctx,company,period)).forEach(r=>{const key=workTheme(r);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);});
  for(const [theme,rows] of [...groups].sort((a,b)=>a[0].localeCompare(b[0])))themes.push([periodLabel(period),COMPANIES[company].name,theme,...reportMetrics(summarize(rows))]);
 }
 add('themes',['Period','Company','Keyword-inferred work theme',...REPORT_METRIC_HEADERS],themes,'Themes are inferred by keywords and are not official business-unit allocations. Duplicates are excluded.');
 add('coverage',['Period','Company','Employee','KPI ownership','Reporting availability','Source state','Last successful load (UTC)','Source rows including duplicates','Valid KPI records','Duplicate rows excluded','Assessed records','Unassessed records'],coverage,'A missing row is shown explicitly. An unavailable tab is unknown; stale data is identified and may be incomplete.');
 const issues=[];
 for(const e of ctx.people){const source=ctx.source[e.id];if(source.status!=='live')issues.push(['',COMPANIES[e.company].name,e.name,'Source connection',reportSourceLabel(source.status),'','Results may be incomplete or based on an earlier in-session copy.',reportSourceTime(source)]);}
 for(const period of ctx.periods)for(const company of ctx.companies){
  const rows=reportRows(ctx,company,period);
  if(rows.length&&periodByKey(period)?.year===null)issues.push([periodLabel(period),COMPANIES[company].name,'','Year unspecified','The Sheet month header does not specify a year.','','Calendar order is not confirmed chronology.','']);
  for(const e of reportPeople(ctx,company)){
   const source=ctx.source[e.id],own=rows.filter(r=>r.employeeId===e.id);
   if(!own.length&&!['unavailable','loading'].includes(source.status))issues.push([periodLabel(period),COMPANIES[company].name,e.name,'No rows found',source.status==='stale'?'No rows in last successful in-session data.':'No source rows found for this month.','','Missing is not zero performance.',reportSourceTime(source)]);
  }
  for(const r of rows){const flags=reportFlags(r);if(flags)issues.push([periodLabel(period),COMPANIES[company].name,byId(r.employeeId).name,'Record requires review',flags,r.kpi,'See exclusion flags in the detailed KPI report.',reportSourceTime(ctx.source[r.employeeId])]);}
 }
 if(!ctx.periods.length)issues.push(['','','','No reporting period','No reporting period is available in this scope.','','Check the Sheet connection and report range.','']);
 add('issues',['Period','Company','Employee','Issue category','Issue details','KPI area','Interpretation / effect','Last successful load (UTC)'],issues,'Issues are based on the selected scope and period. A connection issue is listed once per affected person.');
 const sources=ctx.people.map(e=>{
  const source=ctx.source[e.id],loaded=state.records[e.id]||[],periods=[...new Set(loaded.map(r=>r.period))].sort((a,b)=>periodOrder(a)-periodOrder(b)),available=!['unavailable','loading'].includes(source.status);
  return [COMPANIES[e.company].name,e.name,ownership(e),e.gid,reportSourceLabel(source.status),reportSourceTime(source),available?loaded.length:null,available?ctx.rows.filter(r=>r.employeeId===e.id).length:null,periods.map(p=>periodLabel(p)).join(' | ')];
 });
 add('sources',['Company','Employee','KPI ownership','Published tab GID','Source state','Last successful load (UTC)','Loaded source rows (all periods)','Source rows in selected report range','Loaded period labels'],sources,'Connection and loaded-row totals describe the browser session. Last successful data may be stale, not live.');
 const roster=ctx.people.map(e=>[COMPANIES[e.company].name,e.name,e.role,e.dept,ownership(e),unitOf(e.id)?.name||'',e.id==='nimmi'?'Admin; HR & Recruitment; Finance':'',reportSourceLabel(ctx.source[e.id].status)]);
 add('roster',['Company','Employee','Role supplied','Roster department(s)','Single KPI ownership','Role-based review group','Departments headed','Source state'],roster,'The roster and role structure are based on supplied information. Roster department membership can overlap; KPI ownership is single-counted.');
 return result;
}
function setReportScope(value){reportState.scope=value==='group'?'group':'current';renderReports();}
function setReportRange(value){reportState.range=value==='all'?'all':'selected';renderReports();}
function selectReport(id){if(!REPORTS.some(r=>r.id===id))return;reportState.selected=id;renderReports();$('report-preview').scrollIntoView({behavior:'smooth',block:'start'});}
function reportValue(value){return value===null||value===undefined||value===''?'—':typeof value==='number'?numberText(value,2):String(value);}
function renderReports(){
 if(!state.currentCompany)return;
 const ctx=reportContext(),reports=buildReports(ctx),selected=REPORTS.find(r=>r.id===reportState.selected)||REPORTS[0],data=reports[selected.id];
 $('report-scope').value=reportState.scope;$('report-range').value=reportState.range;
 $('report-scope-line').textContent=ctx.scopeText+' · '+ctx.rangeText;$('report-scope-detail').textContent=ctx.scopeDetail;
 const status=state.refreshing?'Refreshing the Sheet. Downloads are available after the check completes.':`${ctx.live}/${ctx.people.length} tabs live${ctx.stale?` · ${ctx.stale} stale`:''}${ctx.unavailable?` · ${ctx.unavailable} unavailable`:''}${ctx.loading?` · ${ctx.loading} loading`:''}. Reports are point-in-time snapshots and may contain sensitive personnel or finance information. Keep downloads private.`;
 $('report-status').textContent=status;$('report-status').classList.toggle('warning',state.refreshing||ctx.live!==ctx.people.length);
 const metrics=[['Reports',REPORTS.length,'Included in the full pack'],['Available periods',ctx.periods.length,reportState.range==='all'?'Across selected company or group':'Selected period only'],['Valid KPI records',summarize(ctx.rows).rows,'Duplicates excluded'],['Live source tabs',`${ctx.live}/${ctx.people.length}`,'Stale and unavailable tabs flagged']];
 $('report-metrics').innerHTML=metrics.map(([label,value,sub])=>`<div class="report-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(sub)}</span></div>`).join('');
 $('report-count').textContent=`${REPORTS.length} REPORTS`;
 $('report-grid').innerHTML=REPORTS.map(r=>`<button type="button" class="report-card ${r.id===selected.id?'selected':''}" aria-pressed="${r.id===selected.id}" onclick="selectReport('${r.id}')"><span class="report-card-top"><span class="report-card-icon">${esc(r.icon)}</span><span class="report-card-count">${reports[r.id].rows.length} rows</span></span><strong>${esc(r.name)}</strong><p>${esc(r.description)}</p><span class="report-card-link">${r.id===selected.id?'Viewing report ✓':'Preview report ↗'}</span></button>`).join('');
 $('report-preview-title').textContent=selected.name;$('report-preview-description').textContent=selected.description;
 $('report-preview-meta').textContent=`${ctx.scopeText} · ${ctx.rangeText} · ${data.rows.length} ${data.rows.length===1?'row':'rows'}${data.rows.length>40?' · Preview shows the first 40; downloads and print include all rows.':''}`;
 $('report-table-head').innerHTML='<tr>'+data.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')+'</tr>';
 $('report-table-body').innerHTML=data.rows.length?data.rows.slice(0,40).map(row=>'<tr>'+row.map(v=>`<td>${esc(reportValue(v))}</td>`).join('')+'</tr>').join(''):`<tr><td colspan="${data.headers.length}" style="text-align:center;padding:25px;color:#718097;">${esc(state.refreshing?'Refreshing report data…':'No rows available for this report and selection.')}</td></tr>`;
 $('report-preview-note').textContent=data.note+' Blank values mean unavailable or not applicable, not zero.';
 for(const id of ['report-zip-button','report-xlsx-button','report-csv-button','report-print-button'])$(id).disabled=state.refreshing;
}
