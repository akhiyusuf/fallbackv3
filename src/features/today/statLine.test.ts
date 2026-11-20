import { reentryStatLine, statLine } from './copy';

describe('the Today stat line names the days that were counted', () => {
  it('a full window reads "x of the last 30 days"', () => {
    expect(statLine(26, 30, 30)).toBe('26 of the last 30 days');
  });
  it('a partial window names the counted days, so it agrees with the percent beside it', () => {
    // 17 of 20.5 counted days is 83%; "17 of the last 30 days" beside 83% read as a mistake.
    expect(statLine(17, 20.5, 30)).toBe('17 of 21 days in the last 30');
    expect(statLine(1, 1, 30)).toBe('1 of 1 day in the last 30');
  });
  it('the re-entry line uses the same words', () => {
    expect(reentryStatLine(83, 17, 21, 30)).toBe('Your consistency is intact: 83% · 17 of 21 days in the last 30 you showed up, ideal or fallback.');
  });
});
