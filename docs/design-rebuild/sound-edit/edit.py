"""Sound edit for the Fallback prototype: cut every app sound from the picked source takes.
Usage: python3 edit.py   (needs ffmpeg). Sources in raw/, results in out/ as 32 kHz mono WAV."""
import json, os, re, subprocess
here = os.path.dirname(os.path.abspath(__file__))
SR = 44100
def run(args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-y', *args], capture_output=True, text=True).stderr
def peak(path):
    return float(re.search(r'max_volume: (-?[\d.]+) dB', run(['-i', path, '-af', 'volumedetect', '-f', 'null', '-'])).group(1))
def mean(path):
    return float(re.search(r'mean_volume: (-?[\d.]+) dB', run(['-i', path, '-af', 'volumedetect', '-f', 'null', '-'])).group(1))

# The picked takes: where the useful sound starts and ends, and the rumble to remove.
SOURCES = {
    'ting':   dict(file='iron_ting_3',    start=0.0,   end=1.30, hp=180),
    'click':  dict(file='switch_click_1', start=0.045, end=0.30, hp=200),
    'pencil': dict(file='pencil_check_1', start=0.0,   end=0.62, hp=150),
    'swish':  dict(file='swish_4',        start=0.02,  end=0.42, hp=120),
    'flick':  dict(file='glass_flick_2',  start=0.0,   end=1.00, hp=140),
    'nail':   dict(file='nail_tap_1',     start=0.015, end=0.15, hp=250),
    'stamp':  dict(file='stamp_1',        start=0.0,   end=0.22, hp=120),
    'flip':   dict(file='page_flip_2',    start=0.07,  end=0.50, hp=200),
    'flip1':  dict(file='page_flip_2',    start=0.07,  end=0.30, hp=200),
}
os.makedirs(os.path.join(here, 'base'), exist_ok=True); os.makedirs(os.path.join(here, 'out'), exist_ok=True)
for name, s in SOURCES.items():
    src = os.path.join(here, 'raw', s['file'] + '.mp3'); tmp = os.path.join(here, 'base', name + '_t.wav'); dst = os.path.join(here, 'base', name + '.wav')
    d = s['end'] - s['start']
    run(['-i', src, '-ac', '1', '-ar', str(SR), '-af', f"atrim=start={s['start']}:end={s['end']},asetpts=PTS-STARTPTS,highpass=f={s['hp']},afade=t=in:d=0.003,afade=t=out:st={d*0.55:.3f}:d={d*0.45:.3f}", tmp])
    run(['-i', tmp, '-af', f'volume={-1.0 - peak(tmp):.2f}dB', dst]); os.remove(tmp)

# Every sound the app plays. hits: (source, semitones, delay ms, gain). level: target peak in dBFS.
# Frequent sounds are quiet and dry. Only the rare, happy ones get a short echo.
ECHO_SOFT = 'aecho=0.9:0.5:110|230:0.22|0.10'
ECHO_WIDE = 'aecho=0.9:0.6:120|250|390:0.30|0.16|0.08'
SOUNDS = {
    'log_ideal':    dict(hits=[('ting', 0, 0, 0.8), ('ting', 5, 140, 1.0)], level=-5, length=1.15),
    'log_fallback': dict(hits=[('ting', 0, 0, 1.0)], level=-8, length=0.85, extra='lowpass=f=5200'),
    'log_skip':     dict(hits=[('flip', 0, 0, 1.0)], level=-9, length=0.43),
    'day_complete': dict(hits=[('ting', 0, 0, 0.7), ('ting', 4, 110, 0.8), ('ting', 7, 220, 0.9), ('ting', 12, 330, 1.0)], level=-4, length=1.9, extra=ECHO_SOFT),
    'level_up':     dict(hits=[('ting', 0, 0, 0.7), ('ting', 4, 100, 0.75), ('ting', 7, 200, 0.85), ('ting', 12, 300, 0.95), ('ting', 16, 420, 1.0)], level=-3, length=2.3, extra=ECHO_WIDE),
    'badge_earned': dict(hits=[('ting', 0, 0, 0.75), ('ting', 0, 120, 0.8), ('ting', 7, 280, 1.0)], level=-4, length=2.0, extra=ECHO_WIDE),
    'reminder':     dict(hits=[('ting', 0, 0, 0.9), ('ting', 7, 320, 1.0)], level=-6, length=1.6, extra='lowpass=f=4800,' + ECHO_SOFT),
    'error':        dict(hits=[('flip1', 0, 0, 1.0), ('flip1', -4, 210, 0.8)], level=-8, length=0.5),
    'tap':          dict(hits=[('nail', 0, 0, 1.0)], level=-16, length=0.135),
    'saved':        dict(hits=[('stamp', 0, 0, 1.0)], level=-9, length=0.22),
    'toggle_on':    dict(hits=[('click', 3, 0, 1.0)], level=-14, length=0.22),
    'toggle_off':   dict(hits=[('click', -3, 0, 1.0)], level=-14, length=0.26),
    'step_tick':    dict(hits=[('click', 0, 0, 1.0)], level=-12, length=0.24),
    'todo_done':    dict(hits=[('pencil', 0, 0, 1.0)], level=-9, length=0.62),
    'snooze':       dict(hits=[('swish', 0, 0, 1.0)], level=-10, length=0.40),
    'ai_start':     dict(hits=[('flick', 4, 0, 1.0)], level=-9, length=0.60),
    'ai_stop':      dict(hits=[('flick', -3, 0, 1.0)], level=-9, length=0.70),
    'ai_done':      dict(hits=[('flick', 0, 0, 0.9), ('flick', 7, 160, 1.0)], level=-8, length=1.3, extra=ECHO_SOFT),
}
report = []
for name, s in SOUNDS.items():
    args, parts = [], []
    for i, (src, semis, delay, gain) in enumerate(s['hits']):
        args += ['-i', os.path.join(here, 'base', src + '.wav')]
        r = 2 ** (semis / 12)
        parts.append(f"[{i}:a]asetrate={SR * r:.2f},aresample={SR},volume={gain},adelay={delay}:all=1[h{i}]")
    n = len(s['hits']); L = s['length']
    chain = f"apad=whole_dur={L},atrim=end={L}," + (s.get('extra') + ',' if s.get('extra') else '') + f"atrim=end={L},afade=t=out:st={L * 0.7:.3f}:d={L * 0.3:.3f}"
    mix = ''.join(f'[h{i}]' for i in range(n)) + (f"amix=inputs={n}:normalize=0," if n > 1 else '') + chain + '[o]'
    tmp = os.path.join(here, 'out', name + '_t.wav'); dst = os.path.join(here, 'out', name + '.wav')
    err = run([*args, '-filter_complex', ';'.join(parts) + ';' + mix, '-map', '[o]', '-ar', str(SR), tmp])
    if not os.path.exists(tmp): raise SystemExit(name + '\n' + err[-800:])
    run(['-i', tmp, '-af', f"volume={s['level'] - peak(tmp):.2f}dB", '-ar', '32000', '-ac', '1', '-c:a', 'pcm_s16le', dst]); os.remove(tmp)
    report.append(dict(name=name, source=' + '.join(sorted({SOURCES[h[0]]['file'] for h in s['hits']})), seconds=L, peak_db=round(peak(dst), 1), mean_db=round(mean(dst), 1), echo=bool(s.get('extra') and 'aecho' in s['extra']), kb=round(os.path.getsize(dst) / 1024)))
json.dump(report, open(os.path.join(here, 'out', 'report.json'), 'w'), indent=1)
for r in report: print(f"{r['name']:<13} {r['seconds']:>4}s peak {r['peak_db']:>6} mean {r['mean_db']:>6} echo {str(r['echo']):<5} {r['kb']} KB")
print('total KB', sum(r['kb'] for r in report))
