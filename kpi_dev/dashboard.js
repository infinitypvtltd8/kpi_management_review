/* KPI dashboard. All results come from the published Google Sheet at runtime.
   No credentials or historical personnel records are embedded in this file. */
const SHEET_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRM1HUPM1oAFn8z4omtD_OSPqYIAThpZypwjh32h1t0eqIdaX_XgsUmUEGj-wTcbWvaRsujAWBjXuyS/pub';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EMPLOYEES = [
    {id:'sumudu',name:'Sumudu',avatar:'SU',company:'apeiro',dept:'Operations',role:'Operations',gid:'2075064548',layout:'sumudu'},
    {id:'heshani',name:'Heshani',avatar:'HE',company:'apeiro',dept:'Operations',role:'Operations',gid:'524146754',layout:'heshani'},
    {id:'steve',name:'Steve',avatar:'ST',company:'apeiro',dept:'Operations',role:'Operations',gid:'0',layout:'steve'},
    {id:'dewapriya',name:'Dewapriya',avatar:'DW',company:'xguard',dept:'Operations',role:'Executive Officer',gid:'2041234844',layout:'operations',kpiDept:'Operations'},
    {id:'malintha',name:'Malintha',avatar:'ML',company:'xguard',dept:'Operations',role:'Executive Officer',gid:'1698747401',layout:'operations',kpiDept:'Operations'},
    {id:'geeth',name:'Geeth',avatar:'GE',company:'xguard',dept:'Admin',role:'Admin',gid:'1700505898',layout:'admin',kpiDept:'Admin'},
    {id:'uthpala',name:'Uthpala Chandrasekara',avatar:'UC',company:'xguard',dept:'Admin / HR & Recruitment',role:'Admin / HR & Recruitment',gid:'1364928466',layout:'recruitment',kpiDept:'HR & Recruitment'},
    {id:'ramal',name:'Ramal',avatar:'RA',company:'xguard',dept:'HR & Recruitment',role:'HR & Recruitment',gid:'1523144763',layout:'ramal',kpiDept:'HR & Recruitment'},
    {id:'ravira',name:'Ravira',avatar:'RV',company:'xguard',dept:'Finance',role:'Finance',gid:'446762719',layout:'finance',kpiDept:'Finance'},
    {id:'nimmi',name:'Nimmi',avatar:'NI',company:'xguard',dept:'Leadership / cross-department',role:'Head of Admin, HR & Recruitment and Finance',gid:'441945496',layout:'head',kpiDept:null}
];
const COMPANIES = {
    apeiro:{name:'APEIRO',tag:'Operations Department',tagClass:'tag-apeiro',color:'#2563eb',subtitle:'All APEIRO members are in Operations. No departmental breakdown is required.'},
    xguard:{name:'X GUARD',tag:'KPI Management Review',tagClass:'tag-xguard',color:'#eab308',subtitle:'Operations, Admin, HR & Recruitment, and Finance.'}
};
const DEPARTMENTS = [
    {name:'Operations',head:'—',memberIds:['dewapriya','malintha']},
    {name:'Admin',head:'Nimmi',memberIds:['geeth','uthpala']},
    {name:'HR & Recruitment',head:'Nimmi',memberIds:['uthpala','ramal']},
    {name:'Finance',head:'Nimmi',memberIds:['ravira']}
];
const state = {
    currentCompany:null,
    periodByCompany:{apeiro:null,xguard:null},
    selectedEmployee:'all',
    records:Object.fromEntries(EMPLOYEES.map(e=>[e.id,[]])),
    source:Object.fromEntries(EMPLOYEES.map(e=>[e.id,{status:'loading',lastSuccess:null}])),
    refreshing:false,
    lastChecked:null
};
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const text = value => String(value ?? '').trim();
const byId = id => EMPLOYEES.find(e=>e.id===id);
const peopleFor = company => EMPLOYEES.filter(e=>e.company===company);
const pctText = n => Number.isFinite(n) ? `${Number(n.toFixed(1)).toLocaleString()}%` : '—';
const numberText = n => Number.isFinite(n) ? Number(n.toFixed(1)).toLocaleString() : '—';
const mean = nums => nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : null;

// RFC 4180-style CSV parser: quoted commas, doubled quotes, and multiline cells.
function parseCsv(input) {
    const s=String(input).replace(/^\uFEFF/, '');
    const rows=[]; let row=[], cell='', quoted=false;
    for(let i=0;i<s.length;i++){
        const ch=s[i];
        if(quoted){
            if(ch==='"'){
                if(s[i+1]==='"'){cell+='"';i++;} else quoted=false;
            } else cell+=ch;
        } else if(ch==='"' && cell==='') quoted=true;
        else if(ch===','){row.push(cell);cell='';}
        else if(ch==='\n' || ch==='\r'){
            row.push(cell); rows.push(row); row=[]; cell='';
            if(ch==='\r' && s[i+1]==='\n')i++;
        } else cell+=ch;
    }
    if(quoted)throw new Error('The CSV contains an unfinished quoted cell.');
    if(cell!=='' || row.length){row.push(cell);rows.push(row);}
    return rows;
}
function periodFrom(raw){
    const original=text(raw); if(!original)return null;
    const iso=original.match(/^(20\d{2})[-/](0?[1-9]|1[0-2])$/);
    if(iso){const year=Number(iso[1]),month=Number(iso[2]);return {year,month,key:`${year}-${String(month).padStart(2,'0')}`};}
    const normalized=original.toLowerCase().replace(/[’']/g,'').trim();
    const first=(normalized.match(/^[a-z]+/)||[])[0]; if(!first)return null;
    const index=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].findIndex(m=>first.startsWith(m));
    if(index<0)return null;
    const foundYear=normalized.match(/\b(20\d{2})\b/);
    const year=foundYear?Number(foundYear[1]):null,month=index+1;
    return {year,month,key:`${year===null?'unknown':year}-${String(month).padStart(2,'0')}`};
}
function periodByKey(key){
    if(!key)return null;
    const [y,m]=key.split('-'),month=Number(m); if(!month || month>12)return null;
    return {key,month,year:y==='unknown'?null:Number(y)};
}
function periodLabel(key,short=false){
    const p=periodByKey(key); if(!p)return 'No month available';
    const month=short?MONTHS[p.month-1].slice(0,3):MONTHS[p.month-1];
    return p.year===null ? `${month} · year not specified` : `${month} ${p.year}`;
}
function periodOrder(key){const p=periodByKey(key);return p ? (p.year||0)*12+p.month : -1;}
function previousKey(key){
    const p=periodByKey(key); if(!p)return null;
    // An unlabelled January/December boundary cannot be assigned to a year safely.
    if(p.month===1 && p.year===null)return null;
    const month=p.month===1?12:p.month-1,year=p.month===1?p.year-1:p.year;
    return `${year===null?'unknown':year}-${String(month).padStart(2,'0')}`;
}
function numeric(raw){
    const s=text(raw).replace(/,/g,'');
    const m=s.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(%+)?$/);
    return m?{value:Number(m[1]),unit:m[2]?'percent':'number'}:null;
}
function percent(raw){const n=numeric(raw);return n&&n.unit==='percent'?n.value:null;}
function comparison(target,actual){
    const t=numeric(target),a=numeric(actual);
    if(!t||!a||t.unit!==a.unit||t.value<=0)return null;
    return {ratio:(a.value/t.value)*100,met:a.value>=t.value};
}
function statusFrom(raw,allowYesNo=false){
    const s=text(raw).toLowerCase().replace(/\s+/g,' ');
    if(s==='not met'||s==='not achieved'||(allowYesNo&&s==='no'))return 'not-met';
    if(s==='met'||s==='achieved'||(allowYesNo&&s==='yes'))return 'met';
    return null;
}
function noteText(parts){
    return parts.map(([label,value])=>[label,text(value)])
        .filter(([,v])=>v && !/^(?:-|n\/?a|none)$/i.test(v))
        .map(([label,v])=>label?`${label}: ${v}`:v).join('\n');
}
function makeRecord(employee,period,section,r){
    const c=i=>text(r[i]);
    let kpi=c(1),description='',target='',actual='',reported=null,explicitStatus=null,notes='',reportedIsRatio=false;
    switch(employee.layout){
      case 'heshani':
        target=c(2); actual=c(3); reported=percent(c(4)); reportedIsRatio=reported!==null;
        notes=noteText([['',reported===null?c(4):''],['Reason',c(5)],['Notes',c(6)]]); break;
      case 'steve':
        target=c(2); actual=c(3); reported=percent(c(4)); reportedIsRatio=reported!==null;
        notes=noteText([['Reason',c(5)],['Notes',c(6)]]); break;
      case 'sumudu':
        target=c(3); actual=c(4); reported=percent(c(2)); reportedIsRatio=reported!==null;
        explicitStatus=statusFrom(c(2),true);
        notes=noteText([['Reason',c(5)],['Notes',c(6)]]); break;
      case 'recruitment':
        description=c(2); target=c(3); actual=c(4); reported=percent(c(5)); reportedIsRatio=reported!==null;
        explicitStatus=statusFrom(c(5)); break;
      case 'ramal':
        description=c(2); target=c(4); if(c(3))target+=target?` (${c(3)})`:c(3); actual=c(5);
        notes=noteText([['Reason',c(6)]]); break;
      case 'head':
        description=c(2); target=c(3); actual=c(4); explicitStatus=statusFrom(actual);
        notes=noteText([['Reason',c(5)],['Strategy',c(6)]]); break;
      case 'finance':
        target=c(2); actual=c(3); explicitStatus=statusFrom(actual);
        notes=noteText([['Reason',c(4)],['Strategy',c(5)]]); break;
      case 'admin':
        description=c(2); target=c(3); actual=c(4);
        notes=noteText([['',c(5)]]); break;
      case 'operations':
        description=c(2); target=c(3); actual=c(5);
        notes=noteText([['',c(6)]]); break;
      default: throw new Error('Unknown sheet layout.');
    }
    const cmp=comparison(target,actual);
    // Percentages in a named status/result column are taken as reported. If none
    // is provided, comparable target/actual values yield a ratio; otherwise an
    // explicitly %-labelled actual is displayed as the source's metric value.
    let score=reported,scoreKind=reported!==null?'reported':null;
    if(score===null && cmp){score=cmp.ratio;scoreKind='ratio';}
    if(score===null && !['head','finance'].includes(employee.layout)){
        const p=percent(actual); if(p!==null){score=p;scoreKind='reported-value';}
    }
    const scoreConflict=reportedIsRatio && reported!==null && cmp && Math.abs(reported-cmp.ratio)>1.1;
    let status=explicitStatus,statusBasis=explicitStatus?'reported':null,statusConflict=false;
    if(cmp){
        const calculated=cmp.met?'met':'not-met';
        if(explicitStatus && explicitStatus!==calculated)statusConflict=true;
        if(!status){status=calculated;statusBasis='calculated';}
    }
    return {employeeId:employee.id,period:period.key,section,kpi,description,target,actual,notes,
            score,scoreKind,scoreConflict:Boolean(scoreConflict),status,statusBasis,statusConflict,duplicate:false,sectionCount:1};
}
// The source uses several layouts. Reject changed column headings rather than
// silently reading a target, status, or remark from the wrong column.
function validateHeader(employee,row){
    const h=i=>text(row[i]).toLowerCase();
    const tests={
      heshani:[[1,/^kpi\b/],[2,/^target/],[3,/achievement|achieved/]],
      steve:[[1,/^kpi\b/],[2,/^target/],[3,/achievement|achieved/],[4,/remarks|%/]],
      sumudu:[[1,/^kpi\b/],[2,/^target/],[3,/achievement|achieved/],[4,/remarks|%/]],
      recruitment:[[1,/^kpi\b/],[2,/description/],[3,/^target/],[4,/achieved/],[5,/achievement|status/]],
      ramal:[[0,/^month/],[1,/^kpi\b/],[2,/description/],[3,/^target/],[4,/^target/],[5,/achieved/]],
      head:[[1,/^kpi\b/],[2,/description/],[3,/^target/],[4,/achievement.*status/],[5,/reason/],[6,/strategy/]],
      finance:[[1,/^kpi\b/],[2,/^target/],[3,/achievement.*status/],[4,/reason/],[5,/strategy/]],
      admin:[[1,/^kpi\b/],[2,/description/],[3,/^target/],[4,/achieved/],[5,/remarks/]],
      operations:[[1,/^kpi\b/],[2,/description/],[3,/^target/],[4,/frequency/],[5,/achievement|achieved/],[6,/remarks/]]
    };
    if(!(tests[employee.layout]||[]).every(([i,re])=>re.test(h(i))))throw new Error('Column headings changed; review this employee tab before using its results.');
}
function parseEmployeeCsv(raw,employee){
    const csv=parseCsv(raw);
    if(!csv.some(row=>row.some(cell=>/^kpi(?:\s|$)/i.test(text(cell)))))throw new Error('Expected KPI headings were not found.');
    const found=[],counts={}; let current=null,section=0,headers=0;
    if(employee.layout==='ramal'){
        validateHeader(employee,csv[0]||[]);
        for(const r of csv){
            const p=periodFrom(r[0]);
            if(p && text(r[1]) && !/^kpi\b/i.test(text(r[1])))found.push(makeRecord(employee,p,1,r));
        }
        // Ramal's layout is one month per row rather than separate header blocks.
        return found;
    }
    for(const r of csv){
        const p=periodFrom(r[0]);
        if(p && /^kpi(?:\s*area)?$/i.test(text(r[1]))){
            validateHeader(employee,r);
            current=p;counts[p.key]=(counts[p.key]||0)+1;section=counts[p.key];headers++;continue;
        }
        if(!current || !/^\d+[.)]?$/.test(text(r[0])) || !text(r[1]))continue;
        found.push(makeRecord(employee,current,section,r));
    }
    if(headers===0)throw new Error('The sheet has no recognisable month headers.');
    for(const rec of found){rec.sectionCount=counts[rec.period]||1;rec.duplicate=rec.sectionCount>1;}
    return found;
}
function allRecords(company){return peopleFor(company).flatMap(e=>state.records[e.id]||[]);}
function recordsFor(company,period){return allRecords(company).filter(r=>r.period===period);}
function availablePeriods(company){return [...new Set(allRecords(company).map(r=>r.period))].sort((a,b)=>periodOrder(b)-periodOrder(a));}
function summarize(records){
    const valid=records.filter(r=>!r.duplicate);
    const scored=valid.filter(r=>Number.isFinite(r.score)&&!r.scoreConflict);
    const assessed=valid.filter(r=>r.status && !r.statusConflict);
    const met=assessed.filter(r=>r.status==='met').length;
    return {rows:valid.length,scored:scored.length,avg:mean(scored.map(r=>r.score)),assessed:assessed.length,met,
            metRate:assessed.length?100*met/assessed.length:null,unassessed:valid.length-assessed.length};
}
function matchName(r){return `${r.employeeId}|${r.kpi.toLocaleLowerCase().replace(/\s+/g,' ').trim()}`;}
function uniqueScoreMap(rows){
    const groups=new Map();
    for(const r of rows.filter(x=>!x.duplicate&&!x.scoreConflict&&Number.isFinite(x.score))){
        const key=matchName(r);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
    }
    return new Map([...groups].filter(([,v])=>v.length===1).map(([k,v])=>[k,v[0]]));
}
function forecastFor(company,period){
    const previous=previousKey(period);if(!previous)return null;
    const curr=uniqueScoreMap(recordsFor(company,period)),prev=uniqueScoreMap(recordsFor(company,previous));
    const pairs=[];
    for(const [key,r] of curr){const older=prev.get(key);if(older&&older.scoreKind===r.scoreKind)pairs.push([older.score,r.score]);}
    if(pairs.length<3)return null;
    const oldAvg=mean(pairs.map(p=>p[0])),newAvg=mean(pairs.map(p=>p[1]));
    return {count:pairs.length,oldAvg,newAvg,forecast:Math.max(0,2*newAvg-oldAvg),previous};
}
function displayEmpty(message){return `<div class="bar-empty">${esc(message)}</div>`;}
function barList(id,items,color,asPercent=true){
    const el=$(id); if(!el)return;
    if(!items.length){el.innerHTML=displayEmpty('No data for this selection.');return;}
    const valid=items.map(i=>i.value).filter(Number.isFinite);
    const max=Math.max(1,...valid);
    el.innerHTML=items.map(i=>{
        const valid=Number.isFinite(i.value),width=valid?Math.max(0,Math.min(100,(i.value/max)*100)):0;
        const val=valid?(asPercent?pctText(i.value):numberText(i.value)):'—';
        return `<div class="bar-row"><span class="bar-name" title="${esc(i.label)}">${esc(i.label)}</span><div class="bar-track" aria-hidden="true"><div class="bar-fill ${color==='xguard'?'xguard':''}" style="width:${width}%"></div></div><span class="bar-number">${esc(val)}</span></div>`;
    }).join('');
}
function goHome(){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$('landing').classList.add('active');window.scrollTo(0,0);}
function openCompany(key){
    state.currentCompany=key;state.selectedEmployee='all';
    const company=COMPANIES[key];
    $('company-name').textContent=company.name;$('nav-company').textContent=company.name;
    $('company-tag').textContent=company.tag;$('company-tag').className='company-tag '+company.tagClass;
    $('company-subtitle').textContent=company.subtitle;
    $('department-tab').hidden=key==='apeiro';
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    $('company-page').classList.add('active');$('company-page').classList.toggle('xguard',key==='xguard');
    document.querySelectorAll('.tab').forEach(t=>{t.classList.remove('active');t.classList.toggle('xguard',key==='xguard');});
    $('individual-tab').classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));$('tab-individual').classList.add('active');
    renderCompany();window.scrollTo(0,0);
}
function switchTab(btn,tabId){
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));$('tab-'+tabId).classList.add('active');
}
function changePeriod(period){state.periodByCompany[state.currentCompany]=period;state.selectedEmployee='all';renderCompany();}
function changeEmployee(id){state.selectedEmployee=id;renderEmployees();renderKpiTable();}
function selectEmployee(id){state.selectedEmployee=state.selectedEmployee===id?'all':id;renderEmployees();renderKpiTable();}
function populatePeriod(){
    const company=state.currentCompany,periods=availablePeriods(company),select=$('period-select');
    if(!periods.length){
        select.innerHTML=`<option value="">${state.refreshing?'Loading available months…':'No months loaded'}</option>`;select.disabled=true;
        state.periodByCompany[company]=null;return null;
    }
    select.disabled=false;
    if(!periods.includes(state.periodByCompany[company]))state.periodByCompany[company]=periods[0];
    select.innerHTML=periods.map(p=>`<option value="${esc(p)}">${esc(periodLabel(p))}</option>`).join('');
    select.value=state.periodByCompany[company];return select.value;
}
function renderSourceStatus(){
    const company=state.currentCompany,people=peopleFor(company),stats=people.map(e=>state.source[e.id]);
    const live=stats.filter(s=>s.status==='live').length,stale=stats.filter(s=>s.status==='stale').length;
    const missing=people.filter(e=>['unavailable','stale'].includes(state.source[e.id].status));
    let message;
    if(state.refreshing)message='Checking the published Google Sheet…';
    else if(live===people.length)message=`Connected to Google Sheet · ${live}/${people.length} employee tabs loaded.`;
    else if(stale)message=`${live}/${people.length} tabs loaded on the latest check. Some tabs use data from an earlier check in this browser session.`;
    else if(live===0)message='Could not reach the published Google Sheet. File previews can block network access; open the dashboard in an internet-connected browser or GitHub Pages.';
    else message=`${live}/${people.length} employee tabs loaded. ${missing.length?'Could not load: '+missing.map(e=>e.name).join(', ')+'.':''}`;
    $('data-banner').className='data-banner'+(company==='xguard'?' xguard':'');$('data-banner-text').textContent=message;
    $('last-checked').textContent=state.lastChecked?`Last checked ${state.lastChecked.toLocaleTimeString()} · published-sheet updates can take a few minutes.`:'Checks when opened and every 5 minutes while open.';
    $('refresh-btn').disabled=state.refreshing;$('refresh-btn').textContent=state.refreshing?'Refreshing…':'⟳ Refresh Google Sheet';
}
function renderQuality(period){
    const company=state.currentCompany,records=recordsFor(company,period),messages=[];
    if(records.some(r=>periodByKey(r.period)?.year===null))messages.push('The sheet names months but does not specify the year. They are sorted by calendar month, not confirmed chronology; choose the intended month.');
    const duplicates=[...new Set(records.filter(r=>r.duplicate).map(r=>byId(r.employeeId)?.name).filter(Boolean))];
    if(duplicates.length)messages.push(`${duplicates.join(', ')}: this month appears in more than one source section. The duplicate sections are shown in the table but excluded from totals until the month labels are corrected.`);
    const mismatched=records.filter(r=>r.scoreConflict||r.statusConflict).length;
    if(mismatched)messages.push(`${mismatched} record(s) have a source result or percentage that conflicts with the target/actual. They are marked for review; conflicting percentages are excluded from averages.`);
    if(!records.length && !state.refreshing && availablePeriods(company).length)messages.push('No rows were found for the selected month. Missing employee data is not counted as zero.');
    const q=$('quality-note');q.style.display=messages.length?'block':'none';q.innerHTML=messages.length?'<strong>Data notes</strong><ul>'+messages.map(m=>`<li>${esc(m)}</li>`).join('')+'</ul>':'';
}
function renderScorecards(period){
    const company=state.currentCompany,people=peopleFor(company),rows=recordsFor(company,period),s=summarize(rows);
    const withData=people.filter(e=>rows.some(r=>r.employeeId===e.id)).length;
    const f=forecastFor(company,period);
    $('exec-scorecards').innerHTML=`
      <div class="kpi-card"><div class="kpi-label">Team members</div><div class="kpi-value">${people.length}</div><div class="kpi-sub trend-neutral">${period?`${withData} with rows this month`:'No month loaded yet'}</div></div>
      <div class="kpi-card"><div class="kpi-label">KPI records</div><div class="kpi-value">${period?s.rows:'—'}</div><div class="kpi-sub trend-neutral">Excludes duplicate sections</div></div>
      <div class="kpi-card"><div class="kpi-label">Average recorded %</div><div class="kpi-value">${pctText(s.avg)}</div><div class="kpi-sub trend-neutral">${s.scored} usable numeric results</div></div>
      <div class="kpi-card"><div class="kpi-label">KPIs met rate</div><div class="kpi-value">${pctText(s.metRate)}</div><div class="kpi-sub trend-neutral">${s.met} / ${s.assessed} assessed</div></div>
      <div class="kpi-card"><div class="kpi-label">Indicative next period</div><div class="kpi-value">${f?pctText(f.forecast):'—'}</div><div class="kpi-sub trend-neutral">${f?`${f.count} comparable KPIs`:'Not enough comparable data'}</div></div>`;
}
function renderEmployees(){
    const company=state.currentCompany,period=state.periodByCompany[company],people=peopleFor(company),rows=recordsFor(company,period);
    $('emp-leaderboard').innerHTML=people.map(e=>{
        const own=rows.filter(r=>r.employeeId===e.id),s=summarize(own),hasAny=own.length>0,selected=state.selectedEmployee===e.id;
        const latest=[...new Set((state.records[e.id]||[]).map(r=>r.period))].sort((a,b)=>periodOrder(b)-periodOrder(a))[0];
        const note=state.source[e.id].status==='unavailable'?'Sheet tab could not be loaded':!period?(state.refreshing?'Loading employee tab…':'No sheet data loaded'):own.some(r=>r.duplicate)?'Duplicate month sections require review':hasAny?`${s.assessed} of ${s.rows} records have an assessable status`:latest?`No record for this month · another available section: ${periodLabel(latest,true)}`:'No record for this month';
        return `<button type="button" class="emp-card ${company==='xguard'?'xguard ':''}${selected?'selected':''}" onclick="selectEmployee('${esc(e.id)}')" aria-pressed="${selected}">
          <div class="emp-header"><div class="emp-avatar">${esc(e.avatar)}</div><div class="emp-info"><h3>${esc(e.name)}</h3><p>${esc(e.role)}</p></div></div>
          <div class="emp-stats"><div class="emp-stat"><span class="num">${pctText(s.avg)}</span><span class="lbl">Recorded %</span></div>
          <div class="emp-stat"><span class="num">${s.assessed?`${s.met}/${s.assessed}`:'—'}</span><span class="lbl">Met / assessed</span></div>
          <div class="emp-stat"><span class="num">${hasAny?s.rows:'—'}</span><span class="lbl">KPI records</span></div></div>
          <div class="mini-note">${esc(note)}</div></button>`;
    }).join('');
    const select=$('employee-filter');select.innerHTML='<option value="all">All employees</option>'+people.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');select.value=state.selectedEmployee;
}
function statusHtml(r){
    if(r.statusConflict)return '<span class="ach-badge ach-warn">Review</span><br><span class="review-tag">Source conflicts</span>';
    if(!r.status)return '<span class="ach-badge ach-muted">Not assessed</span>';
    const klass=r.status==='met'?'ach-good':'ach-bad',label=r.status==='met'?'Met':'Not met';
    return `<span class="ach-badge ${klass}">${label}</span>${r.statusBasis==='calculated'?'<br><span class="calc-tag">Calculated</span>':''}`;
}
function previousDifference(r){
    if(r.duplicate||r.scoreConflict||!Number.isFinite(r.score))return '—';
    const pk=previousKey(r.period);if(!pk)return '—';
    const candidates=recordsFor(byId(r.employeeId).company,pk).filter(x=>matchName(x)===matchName(r)&&!x.duplicate&&!x.scoreConflict&&x.scoreKind===r.scoreKind&&Number.isFinite(x.score));
    if(candidates.length!==1)return '—';
    const delta=r.score-candidates[0].score;return `${delta>0?'+':''}${numberText(delta)} pp`;
}
function scoreHtml(r){
    if(!Number.isFinite(r.score))return '—';
    let title=r.scoreKind==='ratio'?'Calculated as actual divided by target.':r.scoreKind==='reported-value'?'Recorded percentage value from the sheet; not necessarily a target-attainment ratio.':'Percentage reported in the source sheet.';
    if(r.scoreConflict)title+=' This percentage conflicts with actual divided by target and is excluded from averages.';
    return `<span class="ach-badge ${r.scoreConflict?'ach-warn':'ach-muted'}" title="${esc(title)}">${pctText(r.score)}</span>${r.scoreConflict?'<br><span class="review-tag">Review</span>':r.scoreKind==='ratio'?'<br><span class="calc-tag">Calculated</span>':''}`;
}
function renderKpiTable(){
    const company=state.currentCompany,period=state.periodByCompany[company];
    let rows=recordsFor(company,period);if(state.selectedEmployee!=='all')rows=rows.filter(r=>r.employeeId===state.selectedEmployee);
    const body=$('kpi-table-body');
    if(!rows.length){body.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:2rem;color:#64748b;">${state.refreshing?'Loading KPI data…':'No records for this selection.'}</td></tr>`;return;}
    body.innerHTML=rows.map(r=>{
        const e=byId(r.employeeId),detail=r.description?`<div class="mini-note">${esc(r.description)}</div>`:'';
        const duplicate=r.duplicate?`<div class="review-tag">Duplicate month · source section ${r.section}/${r.sectionCount} · excluded from totals</div>`:'';
        const notes=r.notes?`<details><summary>View notes</summary><div class="note-text">${esc(r.notes)}</div></details>`:'—';
        return `<tr><td class="emp-col">${esc(e.name)}</td><td>${esc(e.dept)}</td><td class="kpi-area">${esc(r.kpi)}${detail}${duplicate}</td>
          <td class="target-cell">${esc(r.target||'—')}</td><td>${esc(r.actual||'—')}</td><td>${scoreHtml(r)}</td><td>${esc(previousDifference(r))}</td><td>${statusHtml(r)}</td><td class="notes-cell">${notes}</td></tr>`;
    }).join('');
}
function departmentRecords(name,period){return recordsFor('xguard',period).filter(r=>byId(r.employeeId)?.kpiDept===name);}
function renderDepartments(period){
    if(state.currentCompany!=='xguard')return;
    const stats=DEPARTMENTS.map(d=>({dept:d,s:summarize(departmentRecords(d.name,period))}));
    $('dept-cards').innerHTML=stats.map(({dept:d,s})=>{
        const names=d.memberIds.map(id=>byId(id)?.name).filter(Boolean).join(', ');
        return `<div class="dept-card xguard"><span class="dept-head">${esc(d.name)} Department</span><h4>Head: ${esc(d.head)}</h4><div class="metric">Team: ${esc(names)}</div><div class="metric">${s.met} / ${s.assessed} assessed KPIs met · ${s.rows} records</div><div class="highlight">${pctText(s.avg)}</div><div class="metric">${s.scored} numeric results</div></div>`;
    }).join('');
    $('dept-table-body').innerHTML=stats.map(({dept:d,s})=>`<tr><td>${esc(d.name)}</td><td>${d.memberIds.length}</td><td>${esc(d.head)}</td><td>${pctText(s.avg)}</td><td>${s.met} / ${s.assessed}</td><td>${s.rows}</td></tr>`).join('');
    barList('css-dept',stats.map(x=>({label:x.dept.name,value:x.s.avg})),'xguard');
    barList('css-dept-met',stats.map(x=>({label:x.dept.name,value:x.s.metRate})),'xguard');
}
function renderSubsidiary(period){
    const items=['apeiro','xguard'].map(key=>{
        const rows=recordsFor(key,period),s=summarize(rows),people=peopleFor(key);
        return {key,s,withData:people.filter(e=>rows.some(r=>r.employeeId===e.id)).length,people:people.length};
    });
    $('subsidiary-matrix').innerHTML=items.map(({key,s,withData,people})=>`<div class="sub-card"><h4 style="color:${key==='apeiro'?'#1d4ed8':'#a16207'}">${esc(COMPANIES[key].name)}</h4><p class="metric">${esc(periodLabel(period))}</p><div class="highlight">${pctText(s.avg)}</div><p class="metric">${s.scored} numeric results · ${s.met}/${s.assessed} assessed met</p><p class="metric">${withData}/${people} employees have rows</p></div>`).join('');
    barList('css-subsidiary',items.map(i=>({label:COMPANIES[i.key].name,value:i.s.avg})),state.currentCompany);
}
function renderCharts(period){
    const company=state.currentCompany,people=peopleFor(company),rows=recordsFor(company,period),s=summarize(rows);
    barList('css-emp-bar',people.map(e=>({label:e.name,value:summarize(rows.filter(r=>r.employeeId===e.id)).avg})),company);
    const deg=s.metRate===null?0:Math.max(0,Math.min(360,(s.metRate/100)*360)),color=company==='xguard'?'#eab308':'#2563eb';
    $('css-doughnut').style.background=`conic-gradient(${color} 0deg ${deg}deg,#e2e8f0 ${deg}deg 360deg)`;
    $('doughnut-num').textContent=pctText(s.metRate);$('doughnut-lbl').textContent=s.assessed?'met of assessed':'no assessment';
    $('status-coverage').textContent=`${s.met} of ${s.assessed} assessable records met · ${s.unassessed} not assessed`;
    const periods=availablePeriods(company).slice(0,6).reverse();
    barList('css-trend',periods.map(p=>({label:periodLabel(p,true),value:summarize(recordsFor(company,p)).avg})),company);
    barList('css-variance',people.map(e=>{const own=rows.filter(r=>r.employeeId===e.id);return {label:e.name,value:own.length?summarize(own).rows:null};}),company,false);
}
function renderForecast(period){
    const company=state.currentCompany,f=forecastFor(company,period),panel=$('forecast-panel');
    panel.innerHTML=f?`
       <div class="forecast-item"><div class="label">Matched KPIs</div><div class="value">${f.count}</div><div class="delta trend-neutral">Same employee and KPI</div></div>
       <div class="forecast-item"><div class="label">Previous matched avg</div><div class="value">${pctText(f.oldAvg)}</div><div class="delta trend-neutral">${esc(periodLabel(f.previous,true))}</div></div>
       <div class="forecast-item"><div class="label">Selected matched avg</div><div class="value">${pctText(f.newAvg)}</div><div class="delta trend-neutral">${esc(periodLabel(period,true))}</div></div>
       <div class="forecast-item"><div class="label">Indicative next period</div><div class="value">${pctText(f.forecast)}</div><div class="delta trend-neutral">Simple linear extrapolation</div></div>`:
       `<div class="forecast-item" style="grid-column:1/-1;"><div class="label">Indicative forecast</div><div class="value">Not enough comparable data</div><div class="delta trend-neutral">At least 3 matched numeric KPIs across consecutive months are required.</div></div>`;
}
function renderCompany(){
    if(!state.currentCompany)return;
    const period=populatePeriod();renderSourceStatus();renderQuality(period);renderScorecards(period);renderEmployees();renderKpiTable();renderDepartments(period);renderSubsidiary(period);renderCharts(period);renderForecast(period);
}
async function fetchEmployee(employee){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
    try{
        const url=`${SHEET_BASE}?gid=${encodeURIComponent(employee.gid)}&single=true&output=csv&v=${Date.now()}`;
        const response=await fetch(url,{mode:'cors',credentials:'omit',signal:controller.signal});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const raw=await response.text();
        if(raw.length>5_000_000)throw new Error('Sheet exceeds the 5 MB limit.');
        return parseEmployeeCsv(raw,employee);
    }finally{clearTimeout(timer);}
}
async function refreshSheet(){
    if(state.refreshing)return;
    state.refreshing=true;renderCompany();
    const results=await Promise.allSettled(EMPLOYEES.map(e=>fetchEmployee(e)));
    results.forEach((result,i)=>{
        const e=EMPLOYEES[i],old=state.source[e.id];
        if(result.status==='fulfilled'){
            state.records[e.id]=result.value;state.source[e.id]={status:'live',lastSuccess:new Date()};
        }else{
            state.source[e.id]={status:old.lastSuccess?'stale':'unavailable',lastSuccess:old.lastSuccess||null};
            console.warn(`Could not load published sheet tab for ${e.name}.`,result.reason);
        }
    });
    state.refreshing=false;state.lastChecked=new Date();renderCompany();
}
// Only the public published-sheet URLs are used; neither tokens nor private connector
// credentials are included in the website. Individual tab ids are stable on rename.
refreshSheet();
setInterval(()=>{if(!document.hidden)refreshSheet();},5*60*1000);
