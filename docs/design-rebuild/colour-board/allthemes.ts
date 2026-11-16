import { deriveTheme, contrast, seedForHue } from '../web/src/theme/engine';
import { THEME_SEEDS, THEME_HUES } from '../web/src/theme/tokens';
const seeds: [string, string][] = [...Object.entries(THEME_SEEDS), ...THEME_HUES.map((h) => [`hue-${h}`, seedForHue(h)] as [string, string])];
let bad = 0, n = 0;
for (const [name, seed] of seeds) for (const scheme of ['light', 'dark'] as const) {
  const { accent: a, color: c } = deriveTheme(seed, scheme);
  const checks: [string, number, number][] = [
    ['on/fill', contrast(a.on, a.fill), 4.5], ['onLarge/fill', contrast(a.onLarge, a.fill), 3], ['onBand/band', contrast(a.onBand, a.band), 4.5],
    ['text/bg', contrast(a.text, c.bg), 4.5], ['text/card', contrast(a.text, c.bgAlt), 4.5], ['text/soft', contrast(a.text, a.soft), 4.5],
    ['body/soft', contrast(c.text, a.soft), 4.5], ['muted/bg', contrast(c.textMuted, c.bg), 4.5], ['dim/bg', contrast(c.textDim, c.bg), 4.5], ['dim/card', contrast(c.textDim, c.bgAlt), 4.5],
    ['muted/surface', contrast(c.textMuted, c.surface), 4.5], ['idealDeep/bg', contrast(c.idealDeep, c.bg), 4.5], ['fbDeep/bg', contrast(c.fallbackDeep, c.bg), 4.5],
    ['ink/ideal', contrast(c.iconOnSignal, c.ideal), 4.5], ['ink/fb', contrast(c.iconOnSignal, c.fallback), 4.5], ['strong/bg', contrast(c.borderStrong, c.bg), 3],
    ['fill/card(mark)', contrast(a.fill, c.bgAlt), 2.2],
  ];
  for (const [k, v, min] of checks) { n++; if (v < min) { bad++; console.log('FAIL', name, scheme, k, v.toFixed(2), 'needs', min, seed, a.fill); } }
}
console.log(`${n} checks, ${bad} failing`);
const f = deriveTheme(THEME_SEEDS['forge-orange'], 'light').accent; console.log('forge', JSON.stringify(f));
