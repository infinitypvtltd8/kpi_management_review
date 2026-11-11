function allRecords(company){return peopleFor(company).flatMap(e=>state.records[e.id]||[]);}
function recordsFor(company,period){return allRecords(company).filter(r=>r.period===period);}
function availablePeriods(company){return [...new Set(allRecords(company).map(r=>r.period))].sort((a,b)=>periodOrder(b)-periodOrder(a));}
function ownership(employee){return employee.company==='apeiro'?'Operations':employee.kpiDept||'Leadership & shared';}
function periodShort(key){const p=periodByKey(key);return p?`${MONTHS[p.month-1].slice(0,3)}${p.year?` '${String(p.year).slice(-2)}`:''}`:'—';}
function monthList(company){return availablePeriods(company).slice(0,6).reverse();}
function selectedPeriod(){return state.currentCompany?state.periodByCompany[state.currentCompany]:null;}
function eligiblePeople(company,includePerson=true){return peopleFor(company).filter(e=>(state.selectedDepartment==='all'||ownership(e)===state.selectedDepartment)&&(!includePerson||state.selectedEmployee==='all'||e.id===state.selectedEmployee));}
function scopedRows(company,period){
 const ids=new Set(eligiblePeople(company,true).map(e=>e.id));
 return recordsFor(company,period).filter(r=>ids.has(r.employeeId));
}
function validRows(rows){return rows.filter(r=>!r.duplicate);}
function summarize(rows){
 const valid=validRows(rows),scored=valid.filter(r=>Number.isFinite(r.score)&&!r.scoreConflict),assessed=valid.filter(r=>r.status&&!r.statusConflict),met=assessed.filter(r=>r.status==='met').length;
 return {rows:valid.length,scored:scored.length,avg:mean(scored.map(r=>r.score)),assessed:assessed.length,met,miss:assessed.length-met,metRate:assessed.length?100*met/assessed.length:null,unassessed:valid.length-assessed.length,duplicates:rows.filter(r=>r.duplicate).length,conflicts:rows.filter(r=>r.scoreConflict||r.statusConflict).length};
}
function matchName(r){return `${r.employeeId}|${r.kpi.toLocaleLowerCase().replace(/\s+/g,' ').trim()}`;}
function uniqueScoreMap(rows){
 const groups=new Map();for(const r of rows.filter(x=>!x.duplicate&&!x.scoreConflict&&Number.isFinite(x.score))){const k=matchName(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
 return new Map([...groups].filter(([,v])=>v.length===1).map(([k,v])=>[k,v[0]]));
}
function matchedPairs(company,period,scoped=true){
 const previous=previousKey(period);if(!previous)return [];
 const curr=uniqueScoreMap(scoped?scopedRows(company,period):recordsFor(company,period));
 const prev=uniqueScoreMap(scoped?scopedRows(company,previous):recordsFor(company,previous));
 const result=[];for(const [key,current] of curr){const old=prev.get(key);if(old&&old.scoreKind===current.scoreKind)result.push({current,old,delta:current.score-old.score});}
 return result;
}
function forecastFor(company,period){
 const pairs=matchedPairs(company,period,true);if(pairs.length<3)return null;
 const oldAvg=mean(pairs.map(p=>p.old.score)),newAvg=mean(pairs.map(p=>p.current.score));
 return {count:pairs.length,oldAvg,newAvg,forecast:Math.max(0,2*newAvg-oldAvg),previous:previousKey(period)};
}
function priorDelta(r){
 if(r.duplicate||r.scoreConflict||!Number.isFinite(r.score))return null;
 const prev=previousKey(r.period);if(!prev)return null;
 const matches=recordsFor(byId(r.employeeId).company,prev).filter(x=>matchName(x)===matchName(r)&&!x.duplicate&&!x.scoreConflict&&x.scoreKind===r.scoreKind&&Number.isFinite(x.score));
 return matches.length===1?r.score-matches[0].score:null;
}
function unitOf(employeeId){const e=byId(employeeId);return e?(UNITS[e.company]||[]).find(u=>u.members.includes(employeeId)):null;}
function unitRows(unit,rows){return rows.filter(r=>unit.members.includes(r.employeeId));}
function workTheme(r){
 const e=byId(r.employeeId),s=(r.kpi+' '+r.description).toLowerCase();
 if(e.company==='apeiro'){
  const tags=[['Cargoserv',/cargoserv/],['Mr Mathu',/mr\s+mathu/],['Ventura',/ventura|\briv\b/],['Vending Machine',/vending machine/],['Informatics',/informatics/],['Packpop',/packpop/],['Elsevier',/elsevier/]];
  return (tags.find(([,re])=>re.test(s))||['Other / unspecified'])[0];
 }
 const rules=[['Recruitment & staffing',/vacanc|candidate|recruit|manpower|staffing|joining|pipeline/],['Sites & operations',/\bsite\b|inspection|housekeeping|\b5s\b|maintenance|inventory|vendor|stock/],['Compliance & records',/compliance|statutory|legal|documentation|documents|employee files|payroll|\bpolicy\b/],['Finance & reporting',/invoice|bank|budgets|budgeting|forecasts|payments|balances|financial|reconciliation/],['Client & communication',/client|relationship|communicat|complain/],['People & development',/training|welfare|engagement|attendance|disciplin|participation/]];
 return (rules.find(([,re])=>re.test(s))||['Other / unspecified'])[0];
}
function displayEmpty(msg){return `<div class="empty-chart">${esc(msg)}</div>`;}
function renderBars(items,opts={}){
 if(!items.length)return displayEmpty('No data for this selection.');
 const percentMode=opts.percent!==false,values=items.map(x=>x.value).filter(Number.isFinite),max=Math.max(percentMode?100:1,...values),color=opts.color||'var(--accent)';
 return `<div class="bars">${items.map((item,i)=>{
  const ok=Number.isFinite(item.value),width=ok?Math.max(0,Math.min(100,item.value/max*100)):0,val=ok?(percentMode?pctText(item.value):numberText(item.value,0)):'—';
  return `<div class="bar-row"><span class="bar-label" title="${esc(item.label)}">${esc(item.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${esc(item.color||color)};animation-delay:${Math.min(i*.04,.3)}s"></div></div><span class="bar-value">${esc(val)}</span></div>`;
 }).join('')}</div>`;
}
function renderStacks(items){
 if(!items.length)return displayEmpty('No data for this selection.');
 return `<div class="stack-list">${items.map(({label,s})=>{
  const total=s.rows,met=total?s.met/total*100:0,miss=total?s.miss/total*100:0,unknown=total?s.unassessed/total*100:0;
  const summary=total?`${s.met} met · ${s.miss} not met · ${s.unassessed} unassessed`:'No records';
  return `<div class="stack-row"><div class="stack-head"><span>${esc(label)}</span><small>${esc(summary)}</small></div><div class="stack-track" role="img" aria-label="${esc(label+': '+summary)}"><span class="seg-met" style="width:${met}%"></span><span class="seg-miss" style="width:${miss}%"></span><span class="seg-unknown" style="width:${unknown}%"></span></div></div>`;
 }).join('')}</div><div class="chart-legend"><span><i class="legend-dot" style="background:#28a77e"></i>Met</span><span><i class="legend-dot" style="background:#ee7c6f"></i>Not met</span><span><i class="legend-dot" style="background:#dce3ed"></i>Unassessed</span></div>`;
}
function renderDonut(s){
 const deg=Number.isFinite(s.metRate)?Math.max(0,Math.min(360,s.metRate*3.6)):0;
 const bg=s.assessed?`conic-gradient(#28a77e 0deg ${deg}deg,#ee7c6f ${deg}deg 360deg)`:'#e8edf4';
 return `<div class="donut-wrap"><div class="donut" style="background:${bg}" role="img" aria-label="${esc(`${pctText(s.metRate)} met of ${s.assessed} assessed KPIs`)}"><div class="donut-center"><strong>${pctText(s.metRate)}</strong><span>met of assessed</span></div></div><div class="donut-legend"><div class="legend-row"><span><i class="legend-dot" style="background:#28a77e"></i>Met</span><strong>${s.met}</strong></div><div class="legend-row"><span><i class="legend-dot" style="background:#ee7c6f"></i>Not met</span><strong>${s.miss}</strong></div><div class="legend-row"><span><i class="legend-dot" style="background:#dce3ed"></i>Unassessed</span><strong>${s.unassessed}</strong></div><div class="legend-row"><span>Records</span><strong>${s.rows}</strong></div></div></div>`;
}
// SVG trend charts use gaps for unavailable values; all numbers are derived
// from parsed rows and each point shows its sample count in a tooltip.
function renderTrend(periods,series){
 const values=series.flatMap(s=>s.points.map(p=>p.value)).filter(Number.isFinite);
 if(!periods.length||!values.length)return displayEmpty('No usable numeric history for this selection.');
 const W=600,H=225,L=48,R=19,T=19,B=38,plotW=W-L-R,plotH=H-T-B;
 const low=Math.min(0,Math.floor(Math.min(...values)/50)*50),high=Math.max(100,Math.ceil(Math.max(...values)/50)*50),range=Math.max(1,high-low);
 const x=i=>L+(periods.length===1?plotW/2:i*plotW/(periods.length-1));
 const y=v=>T+(high-v)/range*plotH;
 let svg=`<svg class="trend-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly trend chart">`;
 for(let k=0;k<=4;k++){const val=low+range*k/4,py=y(val);svg+=`<line x1="${L}" x2="${W-R}" y1="${py}" y2="${py}" stroke="#eaf0f6" stroke-dasharray="3 4"/><text class="trend-axis" x="${L-8}" y="${py+3}" text-anchor="end">${esc(numberText(val,0))}%</text>`;}
 periods.forEach((p,i)=>{svg+=`<text class="trend-axis" x="${x(i)}" y="${H-9}" text-anchor="middle">${esc(periodShort(p))}</text>`;});
 for(const s of series){
  let path='',drawing=false;
  s.points.forEach((p,i)=>{if(Number.isFinite(p.value)){path+=`${drawing?'L':'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)} `;drawing=true;}else drawing=false;});
  svg+=`<path class="trend-line" d="${path}" stroke="${esc(s.color)}"/>`;
  s.points.forEach((p,i)=>{if(!Number.isFinite(p.value))return;const tip=`${s.label} · ${periodLabel(periods[i])}: ${pctText(p.value)} (${p.count} numeric results)`;svg+=`<circle cx="${x(i)}" cy="${y(p.value)}" r="4.4" fill="${esc(s.color)}" stroke="white" stroke-width="2"><title>${esc(tip)}</title></circle>`;if(series.length===1)svg+=`<text class="trend-value" x="${x(i)}" y="${Math.max(12,y(p.value)-9)}" text-anchor="middle">${pctText(p.value)}</text>`;});
 }
 svg+='</svg>';const legend=`<div class="chart-legend">${series.map(s=>`<span><i class="legend-dot" style="background:${esc(s.color)}"></i>${esc(s.label)}</span>`).join('')}</div>`;
 return svg+legend;
}
function periodSeries(company,periods,rowsGetter,label,color){return {label,color,points:periods.map(p=>{const s=summarize(rowsGetter(p));return {value:s.avg,count:s.scored};})};}
function differenceText(value){return Number.isFinite(value)?`${value>0?'+':''}${numberText(value)} pp`:'—';}
