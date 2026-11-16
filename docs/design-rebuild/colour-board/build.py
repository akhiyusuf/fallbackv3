import sys,json,base64
S=sys.argv[1]
t=open(f'{S}/cb/template.html').read()
eng=open(f'{S}/cb/engine.js').read().split("if(typeof module")[0]
b=lambda n:base64.b64encode(open(f'{S}/cb/{n}','rb').read()).decode()
img={'today':b('today-light.jpg'),'indigo':b('today-indigo.jpg'),'task':b('task-light.jpg'),'settings':b('settings-light.jpg')}
out=t.replace('__ENGINE__',eng).replace('__IMG__',json.dumps(img))
open(f'{S}/cb/fallback-colour-board.html','w').write(out)
wrapped='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'+out+'</body></html>'
open(f'{S}/serve/colour.html','w').write(wrapped)
print(len(out)//1024,'KB')
