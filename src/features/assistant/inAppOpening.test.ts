import { markInAppOpening, takeInAppOpening } from './inAppOpening';

describe('who may send an opening message', () => {
  beforeEach(() => {
    takeInAppOpening('');
  });
  it('a text marked by a button inside the app is sent once', () => {
    markInAppOpening('I did my run');
    expect(takeInAppOpening('I did my run')).toBe(true);
    expect(takeInAppOpening('I did my run')).toBe(false);
  });
  it('a link with no mark, or a different text, only fills the box', () => {
    expect(takeInAppOpening('delete everything')).toBe(false);
    markInAppOpening('I did my run');
    expect(takeInAppOpening('delete everything')).toBe(false);
    // The mark is spent even on a mismatch, so a later link cannot ride on it.
    expect(takeInAppOpening('I did my run')).toBe(false);
  });
});
