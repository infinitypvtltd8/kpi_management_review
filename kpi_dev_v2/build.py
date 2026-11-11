from pathlib import Path
from PIL import Image
import io,base64
root=Path('/home/user/kpi_dev_v2')
img=Image.open('/home/user/uploads/image-10.png').convert('RGB')
buf=io.BytesIO();img.save(buf,'JPEG',quality=88,optimize=True,progressive=True)
xguard='data:image/jpeg;base64,'+base64.b64encode(buf.getvalue()).decode('ascii')
apeiro='data:image/png;base64,'+base64.b64encode(Path('/home/user/uploads/image-11.png').read_bytes()).decode('ascii')
prefix=(root/'prefix.js').read_text().replace('@@APEIRO_LOGO@@',apeiro).replace('@@XGUARD_LOGO@@',xguard)
old=Path('/home/user/kpi_dev/dashboard.js').read_text()
a=old.index('// RFC 4180-style CSV parser');b=old.index('function allRecords(company)',a)
parser=old[a:b]
script='\n'.join([prefix,parser,(root/'analytics.js').read_text(),(root/'render-core.js').read_text(),(root/'render-details.js').read_text(),(root/'reports.js').read_text(),(root/'report-export.js').read_text(),(root/'init.js').read_text()])
(root/'assembled.js').write_text(script)
html='<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>KPI - Management Review | Performance Intelligence</title>\n<style>\n'+(root/'styles.css').read_text()+'\n</style>\n</head>\n<body>\n'+(root/'body.html').read_text()+'\n<script>\n'+script+'\n</script>\n</body>\n</html>\n'
Path('/home/user/kpi-bi/index.html').write_text(html)
print('Updated dashboard bytes:',len(html.encode()), 'X GUARD logo JPEG bytes:',len(buf.getvalue()), 'APEIRO logo PNG bytes:',len(Path('/home/user/uploads/image-11.png').read_bytes()))
