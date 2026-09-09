"""Run the frozen paired conversations through the native browser; retain all outcomes."""
import json,hashlib,pathlib,subprocess,sys
folder=pathlib.Path(__file__).parent
cases=(folder/'contextual-cases.json').read_text()
assert hashlib.sha256(cases.encode()).hexdigest()=='b69c46bfc4ddda87afbe57c3b225d2b59cecd613692b60dbd1884a736e93ae26'
arm=sys.argv[2]
assert arm in ['baseline','redesigned','fixture']
group=sys.argv[3] if len(sys.argv)>3 else 'core'
assert group in ['core','boundary','ui','smoke']
source=(folder/('contextual-'+group+'-checks.js')).read_text()
script=source.replace('__CASES__',cases).replace('__ARM__',json.dumps(arm))
wrapper=pathlib.Path.home()/'.codex/skills/playwright/scripts/playwright_cli.sh'
r=subprocess.run(['bash',str(wrapper),'-s='+sys.argv[1],'run-code',script],text=True,capture_output=True)
if '### Result\n' not in r.stdout:
 print(r.stdout);print(r.stderr);sys.exit(1)
report=json.loads(r.stdout.split('### Result\n',1)[1].split('\n### ',1)[0])
report['casesSha256']=hashlib.sha256(cases.encode()).hexdigest()
report['checkSourceSha256']=hashlib.sha256(source.encode()).hexdigest()
content=json.dumps(report,indent=2)+'\n'
out=pathlib.Path('artifacts/conversation')/('contextual-'+arm+'-'+hashlib.sha256(content.encode()).hexdigest()+'.json')
with out.open('x') as f:f.write(content)
out.chmod(0o444)
print(json.dumps({'artifact':str(out),'checks':len(report['results']),'failed':[r['name'] for r in report['results'] if not r['pass']],'error':report.get('error'),'responses':len(report.get('responses',[]))}))
