import sys,json,base64,re
S=sys.argv[1]
cb=open(f'{S}/cb/template.html').read()
css=re.search(r'<style>(.*?)</style>',cb,re.S).group(1)
css=css.replace("/* Layout: findings up top, then a sticky theme switcher. Below it a phone that shows all picks together (sticky on wide screens) beside a column of decision sheets with live option tiles. */","/* Layout: audit findings and real screenshots up top, then a sticky theme switcher. Below it a phone that flips between seven screens with all picks applied (sticky on wide screens) beside a column of decision sheets with live option tiles. */")
eng=open(f'{S}/cb/engine.js').read().split("if(typeof module")[0]
b=lambda n:base64.b64encode(open(f'{S}/pb/{n}.jpg','rb').read()).decode()
img={k:b(k) for k in ['today','routines','events','todos','task','progress','awards','settings','notif']}
head='<title>Fallback Polish Board</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;600&family=Nunito:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap">\n'
out=head+'<style>'+css+open(f'{S}/pb/extra.css').read()+'</style>\n'+open(f'{S}/pb/body.html').read()+'\n<script>\n'+eng+open(f'{S}/pb/app.js').read().replace('__IMG__',json.dumps(img))+'</script>\n'
open(f'{S}/pb/fallback-polish-board.html','w').write(out)
wrapped='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'+out+'</body></html>'
open(f'{S}/serve/polish.html','w').write(wrapped)
print(len(out)//1024,'KB')
