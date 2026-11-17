"""Build the Fallback Banner Board page from board_spec.json and the cut-outs in ../dl (or ../).
Usage: python3 build_board.py"""
import base64, json, os, subprocess
here = os.path.dirname(os.path.abspath(__file__)); up = os.path.dirname(here)
spec = json.load(open(os.path.join(here, 'board_spec.json'))); images = {}
os.makedirs(os.path.join(here, 'img'), exist_ok=True)
for s in spec:
    for k in ('a', 'b'):
        src = os.path.join(up, s['files'][k]); webp = os.path.join(here, 'img', f"{s['n']}{k}.webp")
        subprocess.run(['convert', src, '-resize', '900x600>', '-quality', '84', webp], check=True)
        images[f"{s['n']}{k}"] = 'data:image/webp;base64,' + base64.b64encode(open(webp, 'rb').read()).decode()
    del s['files']
html = open(os.path.join(here, 'board_template.html')).read().replace('__STEPS__', json.dumps(spec)).replace('__IMAGES__', json.dumps(images))
open(os.path.join(here, 'fallback-banner-board.html'), 'w').write(html)
print(len(images), 'pictures', round(len(html) / 1e6, 2), 'MB')
