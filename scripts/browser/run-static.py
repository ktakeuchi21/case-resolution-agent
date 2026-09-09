"""Retain bounded native-browser frontend checks without cookies or credentials."""
import hashlib,json,pathlib,subprocess,sys
name=sys.argv[2]
assert name in ['startup','transport']
source=(pathlib.Path(__file__).parent/('static-'+name+'-checks.js')).read_text()
r=subprocess.run(['bash',str(pathlib.Path.home()/'.codex/skills/playwright/scripts/playwright_cli.sh'),'-s='+sys.argv[1],'run-code',source],capture_output=True,text=True)
if '### Result\n' not in r.stdout:
 print(r.stdout);print(r.stderr);sys.exit(1)
report=json.loads(r.stdout.split('### Result\n',1)[1].split('\n### ',1)[0]);report['checkSourceSha256']=hashlib.sha256(source.encode()).hexdigest()
body=json.dumps(report,indent=2)+'\n';out=pathlib.Path('artifacts/mvp')/('static-'+name+'-'+hashlib.sha256(body.encode()).hexdigest()+'.json')
with out.open('x') as f:f.write(body)
out.chmod(0o444)
print(json.dumps({'artifact':str(out),'passed':sum(x['pass'] for x in report['results']),'total':len(report['results']),'error':report.get('error')}))
