from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED,ZipInfo
from openpyxl import load_workbook
from openpyxl.writer.excel import ExcelWriter
import io,json,re,csv,hashlib
from datetime import datetime

source=Path('/home/user/browser-qa/report-pack-qa.zip')
out=Path('/home/user/KPI_ALL_REPORTS_SNAPSHOT.zip')
app=Path('/home/user/kpi-bi/index.html')
app_zip=Path('/home/user/KPI_MANAGEMENT_DASHBOARD.zip')
clock_note=('This snapshot was generated during the current session. Exact generation and last-load times are omitted because the export environment clock could not be independently verified. Generate a fresh pack in the dashboard to use your device clock.')
time_re=r'20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z'
with ZipFile(source) as zin:
    assert zin.testzip() is None
    files={n:zin.read(n) for n in zin.namelist()}
manifest=json.loads(files['REPORT_MANIFEST.json'])
assert manifest['scope']=='Both companies · whole group' and manifest['period'].startswith('All available')
assert len(manifest['reports'])==14 and len(manifest['sources'])==10 and all(s['status']=='Live' for s in manifest['sources'])
manifest['generatedAtUtc']=None;manifest['lastSheetCheckUtc']=None;manifest['timestampNote']=clock_note
for s in manifest['sources']:s['lastSuccessUtc']=None
files['REPORT_MANIFEST.json']=json.dumps(manifest,ensure_ascii=False,indent=2).encode('utf-8')
readme=files['READ_ME.txt'].decode('utf-8')
readme=re.sub(r'Generated at \(UTC\): '+time_re,'Generated: During this session; exact time not independently verified.',readme)
readme=re.sub(r'Last Sheet check \(UTC\): '+time_re,'Source checked: During this session; exact time not independently verified.',readme)
readme=re.sub(r'(last successful load \(UTC\): )'+time_re,r'\1not independently verified',readme)
readme=readme.replace('KPI MANAGEMENT REVIEW - REPORT PACK\r\n','KPI MANAGEMENT REVIEW - REPORT PACK\r\n'+clock_note+'\r\n',1)
files['READ_ME.txt']=readme.encode('utf-8')
for filename in ['CSV/10_reporting_coverage.csv','CSV/11_data_quality_checks.csv','CSV/12_source_connections.csv']:
    rows=list(csv.reader(io.StringIO(files[filename].decode('utf-8-sig'),newline='')))
    column=rows[0].index('Last successful load (UTC)')
    for row in rows[1:]:row[column]=''
    output=io.StringIO(newline='');writer=csv.writer(output,lineterminator='\r\n',quoting=csv.QUOTE_ALL);writer.writerows(rows)
    files[filename]=('\ufeff'+output.getvalue()).encode('utf-8')

wb=load_workbook(io.BytesIO(files['KPI_Management_Reports.xlsx']))
intro=wb['Read me']
for row in intro.iter_rows(min_row=2):
    topic=row[0].value
    if topic=='Generated at (UTC)':row[0].value='Generated';row[1].value='During this session; exact time not independently verified.'
    elif topic=='Last Sheet check (UTC)':row[0].value='Source checked';row[1].value='During this session; exact time not independently verified.'
    elif isinstance(topic,str) and topic.startswith('Tab:') and isinstance(row[1].value,str):row[1].value=re.sub(time_re,'not independently verified',row[1].value)
intro.append(['Export clock note',clock_note]);intro.auto_filter.ref=f'A1:B{intro.max_row}'
for sheet_name in ['Reporting coverage','Data quality','Source connections']:
    ws=wb[sheet_name];headers=[c.value for c in ws[1]];col=headers.index('Last successful load (UTC)')+1
    for row in ws.iter_rows(min_row=2):row[col-1].value=None
# openpyxl requires datetimes during serialization; remove the placeholder
# core-property elements afterwards rather than presenting an unverified time.
wb.properties.created=datetime(1980,1,1);wb.properties.modified=datetime(1980,1,1)
buf=io.BytesIO();ExcelWriter(wb,ZipFile(buf,'w',ZIP_DEFLATED,allowZip64=True)).save()
clean_xlsx=io.BytesIO()
with ZipFile(io.BytesIO(buf.getvalue())) as old,ZipFile(clean_xlsx,'w') as new:
    for name in old.namelist():
        data=old.read(name)
        if name=='docProps/core.xml':
            data=re.sub(rb'<dcterms:(?:created|modified)\b[^>]*>.*?</dcterms:(?:created|modified)>',b'',data)
        info=ZipInfo(name,date_time=(1980,1,1,0,0,0));info.compress_type=ZIP_DEFLATED;info.external_attr=0o100644<<16;new.writestr(info,data)
files['KPI_Management_Reports.xlsx']=clean_xlsx.getvalue()

def add_stable(z,name,data):
    entry=ZipInfo(name,date_time=(1980,1,1,0,0,0));entry.compress_type=ZIP_DEFLATED;entry.external_attr=0o100644<<16;z.writestr(entry,data)
with ZipFile(out,'w') as zout:
    for n,data in files.items():add_stable(zout,n,data)
with ZipFile(app_zip,'w') as zout:
    add_stable(zout,'index.html',app.read_bytes());add_stable(zout,'README.txt',Path('/home/user/kpi_release/README.txt').read_bytes())
with ZipFile(app_zip) as z:
    assert z.testzip() is None and set(z.namelist())=={'index.html','README.txt'}
    assert hashlib.sha256(z.read('index.html')).digest()==hashlib.sha256(app.read_bytes()).digest()
with ZipFile(out) as z:
    assert z.testzip() is None
    check=load_workbook(io.BytesIO(z.read('KPI_Management_Reports.xlsx')),data_only=False)
    assert len(check.sheetnames)==15
    assert not re.search(time_re,z.read('READ_ME.txt').decode())
    assert all(not row[6].value for row in list(check['Reporting coverage'].rows)[1:])
    for n in ['CSV/10_reporting_coverage.csv','CSV/11_data_quality_checks.csv','CSV/12_source_connections.csv']:
        rows=list(csv.reader(io.StringIO(z.read(n).decode('utf-8-sig'),newline='')));idx=rows[0].index('Last successful load (UTC)');assert all(not r[idx] for r in rows[1:])
    print('Report ZIP:',out,'bytes:',out.stat().st_size,'files:',len(z.namelist()),'workbook sheets:',len(check.sheetnames))
print('Dashboard ZIP:',app_zip,'bytes:',app_zip.stat().st_size,'HTML matches live app: True')
