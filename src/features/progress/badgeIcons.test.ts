import { ACHIEVEMENTS } from '@/domain';

import { BADGE_ICONS } from './badgeIcons';

describe('badge glyphs', () => {
  it('every achievement has its own glyph, so no badge is dropped from the grid', () => {
    const missing = ACHIEVEMENTS.map((a) => a.key).filter((key) => !BADGE_ICONS[key]);
    expect(missing).toEqual([]);
  });
});
