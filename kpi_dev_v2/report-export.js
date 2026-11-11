/* Standards-based local ZIP and Excel export; no CDN, token or upload is used.
   XLSX strings are written as inline text, never as spreadsheet formulas. */
const REPORT_ENCODER=new TextEncoder();
const REPORT_CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function reportCrc32(bytes){let c=0xFFFFFFFF;for(const b of bytes)c=REPORT_CRC_TABLE[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function reportBytes(data){return typeof data==='string'?REPORT_ENCODER.encode(data):data instanceof Uint8Array?data:new Uint8Array(data);}
function reportZip(entries){
 const parts=[],central=[];let offset=0,centralSize=0;
 const now=new Date(),year=Math.max(1980,Math.min(2107,now.getFullYear()));
 const dosTime=(now.getHours()<<11)|(now.getMinutes()<<5)|Math.floor(now.getSeconds()/2),dosDate=((year-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
 for(const entry of entries){
  const name=REPORT_ENCODER.encode(entry.name),data=reportBytes(entry.data),crc=reportCrc32(data);
  if(name.length>65535||data.length>0xFFFFFFFF||offset>0xFFFFFFFF)throw new Error('Report pack exceeds the ZIP size limit.');
  const local=new Uint8Array(30+name.length),l=new DataView(local.buffer);
  l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x0800,true);l.setUint16(8,0,true);l.setUint16(10,dosTime,true);l.setUint16(12,dosDate,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);l.setUint16(28,0,true);local.set(name,30);
  const cen=new Uint8Array(46+name.length),v=new DataView(cen.buffer);
  v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x0800,true);v.setUint16(10,0,true);v.setUint16(12,dosTime,true);v.setUint16(14,dosDate,true);v.setUint32(16,crc,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,name.length,true);v.setUint16(30,0,true);v.setUint16(32,0,true);v.setUint16(34,0,true);v.setUint16(36,0,true);v.setUint32(38,0,true);v.setUint32(42,offset,true);cen.set(name,46);
  parts.push(local,data);central.push(cen);centralSize+=cen.length;offset+=local.length+data.length;
 }
 if(entries.length>65535||centralSize>0xFFFFFFFF||offset+centralSize>0xFFFFFFFF)throw new Error('Report pack exceeds the ZIP size limit.');
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(4,0,true);e.setUint16(6,0,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);e.setUint16(20,0,true);
 const out=new Uint8Array(offset+centralSize+end.length);let pos=0;for(const part of [...parts,...central,end]){out.set(part,pos);pos+=part.length;}return out;
}
function reportCsvCell(value){
 if(typeof value==='number'&&Number.isFinite(value))return String(value);
 let s=String(value??'');
 // Neutralize untrusted cells that spreadsheet programs could interpret as formulas.
 if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
function reportCsv(report){return '\uFEFF'+[report.headers,...report.rows].map(row=>row.map(reportCsvCell).join(',')).join('\r\n')+'\r\n';}
function reportXml(value){
 // XML 1.0 disallows certain controls. Excel cells are capped at 32,767 characters.
 const safe=Array.from(String(value??'')).filter(ch=>{const c=ch.codePointAt(0);return c===9||c===10||c===13||(c>=32&&c<=0xD7FF)||(c>=0xE000&&c<=0xFFFD)||(c>=0x10000&&c<=0x10FFFF);}).slice(0,32767).join('');
 return safe.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
}
function reportColumn(n){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function reportSheetXml(report){
 const rows=[report.headers,...report.rows],lastCol=reportColumn(report.headers.length-1),lastRow=Math.max(1,rows.length);
 const cols=report.headers.map((h,i)=>`<col min="${i+1}" max="${i+1}" width="${Math.max(14,Math.min(/notes|description|details|coverage/i.test(h)?42:30,h.length+5))}" customWidth="1"/>`).join('');
 const body=rows.map((row,ri)=>{
  const cells=row.map((value,ci)=>{
   if(value===null||value===undefined||value==='')return '';
   const ref=reportColumn(ci)+(ri+1),style=ri===0?' s="1"':'';
   if(typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}"${style}><v>${value}</v></c>`;
   return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${reportXml(value)}</t></is></c>`;
  }).join('');
  return `<row r="${ri+1}"${ri===0?' ht="28" customHeight="1"':''}>${cells}</row>`;
 }).join('');
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCol}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${body}</sheetData><autoFilter ref="A1:${lastCol}${lastRow}"/></worksheet>`;
}
function reportReadmeRows(ctx,reports){
 const items=[
  ['Generated at (UTC)',ctx.generated.toISOString()],['Last Sheet check (UTC)',ctx.checked?ctx.checked.toISOString():'Not checked'],['Scope',ctx.scopeText],['Period',ctx.rangeText],['Scope rules',ctx.scopeDetail],['Source status',reportSourceCounts(ctx,ctx.people)],
  ['Privacy','This file may contain employee and financial information. Keep it private. Do not upload report packs, workbooks or CSV files to a public GitHub repository.'],
  ['Snapshot','These reports are generated in the browser from the latest available in-session data. They do not update after download. Refresh the dashboard and export again for new data.'],
  ['Missing and unavailable','A missing row or unavailable tab is not zero performance. Source connection status and last successful load are included. A stale tab contains an earlier in-session copy.'],
  ['Year','Month headings without a year remain unspecified. Calendar order is not confirmed chronology.'],
  ['Performance','Recorded percentages are unweighted averages of usable reported percentages and compatible actual/target ratios. Different KPIs have different meanings; comparisons are indicative, not like-for-like rankings. Percent values are expressed as 85.1 for 85.1%.'],
  ['Assessment','Met rate is met divided by assessed records; unassessed rows are not counted as failures. Calculated status assumes higher numeric actual is better.'],
  ['Duplicate and conflict','Duplicate month sections are visible in detail but excluded from all totals. Conflicting percentages are excluded from averages; conflicting statuses are excluded from assessed totals.'],
  ['Movement','Movement requires unique matching employee/KPI names, consecutive month labels and the same score basis. The preceding month can be outside the report range; changes are in percentage points.'],
  ['Projection','A simple linear extrapolation of at least three matched KPI pairs, clipped at zero. It is illustrative only and is not a prediction or confidence estimate.'],
  ['Department ownership','X GUARD departments use single KPI ownership to prevent double counting. Uthpala is on both Admin and HR rosters but recruitment KPIs belong to HR & Recruitment; Nimmi heads Admin, HR and Finance and leadership KPIs are kept separate.'],
  ['Units and work themes','Review groups are based on supplied roles. Work themes are keyword inferred and should be confirmed; neither is an official unit field from the Sheet.'],
  ['Report coverage','All reports are based on data in the currently published employee tabs. Categories not present in the Sheet are not fabricated. Empty reports contain headers only.'],
  ['Excel cell limit','Excel supports a maximum of 32,767 characters per cell. Longer text is truncated in the workbook; individual CSVs retain full text.'],
  ['CSV safety','Text beginning with common spreadsheet formula prefixes is prefixed with an apostrophe for safety. Numeric values remain numeric.']
 ];
 for(const r of REPORTS)items.push([`Report: ${r.name}`,`${reports[r.id].rows.length} rows. ${reports[r.id].note}`]);
 for(const e of ctx.people){const source=ctx.source[e.id];items.push([`Tab: ${COMPANIES[e.company].name} / ${e.name}`,`${reportSourceLabel(source.status)}; last successful load (UTC): ${reportSourceTime(source)||'none'}`]);}
 return items;
}
function reportReadme(ctx,reports){return 'KPI MANAGEMENT REVIEW - REPORT PACK\r\n'+'='.repeat(45)+'\r\n\r\n'+reportReadmeRows(ctx,reports).map(([k,v])=>`${k}: ${v}`).join('\r\n\r\n')+'\r\n';}
function buildReportWorkbook(ctx,reports){
 const sheets=[{name:'Read me',data:{headers:['Topic','Information'],rows:reportReadmeRows(ctx,reports)}},...REPORTS.map(r=>({name:r.sheet,data:reports[r.id]}))];
 const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';
 const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';
 const workbook='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'+sheets.map((s,i)=>`<sheet name="${reportXml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>';
 const wbRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+`<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF263F76"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
 const core=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>KPI Management Review Reports</dc:title><dc:creator>KPI Management Review</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${ctx.generated.toISOString()}</dcterms:created></cp:coreProperties>`;
 const app='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>KPI Management Review</Application></Properties>';
 const files=[{name:'[Content_Types].xml',data:types},{name:'_rels/.rels',data:rels},{name:'docProps/core.xml',data:core},{name:'docProps/app.xml',data:app},{name:'xl/workbook.xml',data:workbook},{name:'xl/_rels/workbook.xml.rels',data:wbRels},{name:'xl/styles.xml',data:styles},...sheets.map((s,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,data:reportSheetXml(s.data)}))];
 return reportZip(files);
}
function reportFilePrefix(ctx){return `kpi-${ctx.group?'both-companies':state.currentCompany}-${reportState.range==='all'?'all-months':ctx.selected||'no-period'}-${ctx.generated.toISOString().slice(0,10)}`;}
function reportDownload(bytes,name,type){const blob=new Blob([bytes],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function reportExportError(error){console.error(error);alert('Could not create the report file. Please retry, or export a single CSV. '+(error?.message||''));}
function downloadSelectedReport(){
 if(state.refreshing)return;
 try{const ctx=reportContext(),reports=buildReports(ctx),definition=REPORTS.find(r=>r.id===reportState.selected)||REPORTS[0];reportDownload(reportCsv(reports[definition.id]),`${reportFilePrefix(ctx)}-${definition.file}`,'text/csv;charset=utf-8');}catch(error){reportExportError(error);}
}
function downloadReportWorkbook(){
 if(state.refreshing)return;
 try{const ctx=reportContext(),reports=buildReports(ctx),xlsx=buildReportWorkbook(ctx,reports);reportDownload(xlsx,`${reportFilePrefix(ctx)}-reports.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}catch(error){reportExportError(error);}
}
function downloadReportPack(){
 if(state.refreshing)return;
 try{
  const ctx=reportContext(),reports=buildReports(ctx),xlsx=buildReportWorkbook(ctx,reports);
  const manifest={generatedAtUtc:ctx.generated.toISOString(),lastSheetCheckUtc:ctx.checked?ctx.checked.toISOString():null,scope:ctx.scopeText,scopeRules:ctx.scopeDetail,period:ctx.rangeText,reports:REPORTS.map(r=>({name:r.name,file:'CSV/'+r.file,rows:reports[r.id].rows.length,note:reports[r.id].note})),sources:ctx.people.map(e=>({company:COMPANIES[e.company].name,employee:e.name,status:reportSourceLabel(ctx.source[e.id].status),lastSuccessUtc:reportSourceTime(ctx.source[e.id])||null}))};
  const entries=[{name:'READ_ME.txt',data:reportReadme(ctx,reports)},{name:'REPORT_MANIFEST.json',data:JSON.stringify(manifest,null,2)},{name:'KPI_Management_Reports.xlsx',data:xlsx},...REPORTS.map(r=>({name:'CSV/'+r.file,data:reportCsv(reports[r.id])}))];
  reportDownload(reportZip(entries),`${reportFilePrefix(ctx)}-all-reports.zip`,'application/zip');
 }catch(error){reportExportError(error);}
}
function printSelectedReport(){
 if(state.refreshing)return;
 const ctx=reportContext(),reports=buildReports(ctx),definition=REPORTS.find(r=>r.id===reportState.selected)||REPORTS[0],data=reports[definition.id],sheet=$('report-print-sheet');
 const records=data.rows.length?data.rows.map((row,i)=>`<article class="report-print-record"><h3>Record ${i+1} of ${data.rows.length}</h3><div class="report-print-fields">${data.headers.map((h,j)=>`<div class="report-print-field"><b>${esc(h)}</b>${esc(reportValue(row[j]))}</div>`).join('')}</div></article>`).join(''):'<p>No rows are available for this report and selection.</p>';
 sheet.innerHTML=`<h1>KPI - MANAGEMENT REVIEW</h1><h2>${esc(definition.name)}</h2><div class="report-print-meta"><strong>Scope:</strong> ${esc(ctx.scopeText)}<br><strong>Period:</strong> ${esc(ctx.rangeText)}<br><strong>Source:</strong> ${esc(reportSourceCounts(ctx,ctx.people))}<br><strong>Generated (UTC):</strong> ${esc(ctx.generated.toISOString())}<br><strong>Filter rules:</strong> ${esc(ctx.scopeDetail)}</div><p class="report-print-caveat">${esc(data.note)} Blank values are not zero. This report is a snapshot and may contain sensitive information.</p>${records}`;
 document.body.classList.add('report-printing');window.print();
}
window.addEventListener('afterprint',()=>{document.body.classList.remove('report-printing');const sheet=$('report-print-sheet');if(sheet)sheet.innerHTML='';});
