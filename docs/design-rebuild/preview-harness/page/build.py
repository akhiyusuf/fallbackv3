import glob, sys
S = sys.argv[1]
bundle = open(glob.glob(S + '/web/dist/_expo/static/js/web/entry-*.js')[0], encoding='utf-8').read()
bundle = bundle.replace('</script', '<\\/script').replace('<!--', '<\\!--')
html = open(S + '/page/template.html', encoding='utf-8').read().replace('/*__BUNDLE__*/', bundle)
out = S + '/page/fallback-preview.html'
open(out, 'w', encoding='utf-8').write(html)
print(out, round(len(html.encode()) / 1e6, 2), 'MB')
