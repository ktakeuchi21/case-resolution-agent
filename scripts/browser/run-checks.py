"""Run the repository's native Playwright CLI browser checks without shell interpolation."""
import json
import hashlib
import pathlib
import subprocess
import sys
name=sys.argv[2] if len(sys.argv)>2 else 'conversation-checks.js'
if name not in ['conversation-checks.js','governance-checks.js']: raise ValueError('Choose a repository browser check')
script=pathlib.Path(__file__).with_name(name).read_text()
wrapper=pathlib.Path.home()/'.codex/skills/playwright/scripts/playwright_cli.sh'
result=subprocess.run(['bash',str(wrapper),'-s='+sys.argv[1],'run-code',script],text=True,capture_output=True)
if '### Result\n' not in result.stdout:
    print(result.stdout)
    print(result.stderr,file=sys.stderr)
    sys.exit(1)
report=json.loads(result.stdout.split('### Result\n',1)[1].split('\n### ',1)[0])
report['checkSourceSha256']=hashlib.sha256(script.encode()).hexdigest()
content=json.dumps(report,indent=2)+'\n'
folder=pathlib.Path('artifacts/conversation');folder.mkdir(exist_ok=True)
path=folder/('browser-'+hashlib.sha256(content.encode()).hexdigest()+'.json')
with path.open('x') as output: output.write(content)
path.chmod(0o444)
print(json.dumps({'artifact':str(path),'checks':len(report['results']),'passed':all(r['pass'] for r in report['results'])}))
sys.exit(0 if all(r['pass'] for r in report['results']) else 1)
