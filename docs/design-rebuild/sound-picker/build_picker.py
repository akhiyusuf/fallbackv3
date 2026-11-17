import json, base64, os, sys
here = os.path.dirname(os.path.abspath(__file__))
spec = json.load(open(os.path.join(here, 'picker_spec.json')))
clips = {}
for g in spec:
    for s in g['sources']:
        takes = []
        for n in range(1, 5):
            p = os.path.join(here, 'preview', f"{s['label']}_{n}.mp3")
            if os.path.exists(p) and os.path.getsize(p) > 2000:
                takes.append(n)
                clips[f"{s['label']}_{n}"] = 'data:audio/mpeg;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
        s['takes'] = takes
html = open(os.path.join(here, 'picker_template.html')).read()
html = html.replace('__SPEC__', json.dumps(spec)).replace('__CLIPS__', json.dumps(clips))
open(os.path.join(here, 'fallback-sound-picker.html'), 'w').write(html)
print(len(clips), 'clips', round(len(html) / 1e6, 2), 'MB')
