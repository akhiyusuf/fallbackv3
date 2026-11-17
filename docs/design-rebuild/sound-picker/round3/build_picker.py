import json, base64, os
here = os.path.dirname(os.path.abspath(__file__))
spec = json.load(open(os.path.join(here, 'picker_spec.json')))
clips = {}
def clip(name):
    p = os.path.join(here, 'preview', name + '.mp3')
    if os.path.exists(p) and os.path.getsize(p) > 2000:
        clips[name] = 'data:audio/mpeg;base64,' + base64.b64encode(open(p, 'rb').read()).decode(); return True
    return False
for g in spec['jobs']:
    for s in g['sources']:
        s['takes'] = [n for n in range(1, 5) if clip(f"{s['label']}_{n}")]
for r in spec['review']:
    assert clip('rev_' + r['id']), r['id']
html = open(os.path.join(here, 'picker_template.html')).read()
html = html.replace('__SPEC__', json.dumps(spec)).replace('__CLIPS__', json.dumps(clips))
open(os.path.join(here, 'fallback-sound-picker-3.html'), 'w').write(html)
print(len(clips), 'clips', round(len(html) / 1e6, 2), 'MB')
