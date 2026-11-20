import { STALL_MS, serialWrite } from './writeQueue';

describe('one write at a time', () => {
  it('runs writes in the order asked, never overlapping', async () => {
    const log: string[] = [];
    const slow = serialWrite(async (name: string, ms: number) => {
      log.push(`start ${name}`);
      await new Promise((r) => setTimeout(r, ms));
      log.push(`end ${name}`);
      return name;
    });
    const results = await Promise.all([slow('a', 20), slow('b', 1), slow('c', 5)]);
    expect(results).toEqual(['a', 'b', 'c']);
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  it('a failed write does not block the next', async () => {
    const w = serialWrite(async (fail: boolean) => {
      if (fail) throw new Error('nope');
      return 'ok';
    });
    await expect(w(true)).rejects.toThrow('nope');
    await expect(w(false)).resolves.toBe('ok');
  });

  it('a write that never settles holds the queue only for STALL_MS, then later writes run', async () => {
    jest.useFakeTimers();
    try {
      const hang = serialWrite(() => new Promise<never>(() => undefined));
      const next = serialWrite(async () => 'saved');
      void hang();
      let done = false;
      const p = next().then((v) => {
        done = true;
        return v;
      });
      await jest.advanceTimersByTimeAsync(STALL_MS - 1);
      expect(done).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await expect(p).resolves.toBe('saved');
    } finally {
      jest.useRealTimers();
    }
  });
});
