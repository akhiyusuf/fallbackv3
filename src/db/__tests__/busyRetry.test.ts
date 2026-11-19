import { runWithBusyRetry } from '../client';

describe('runWithBusyRetry (a briefly busy database)', () => {
  it('tries a "database is locked" failure once more and returns the second answer', async () => {
    const run = jest.fn().mockRejectedValueOnce(new Error('database is locked')).mockResolvedValueOnce('saved');
    await expect(runWithBusyRetry(run, 1)).resolves.toBe('saved');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('gives up after the second try', async () => {
    const run = jest.fn().mockRejectedValue(new Error('SQLITE_BUSY: database is locked'));
    await expect(runWithBusyRetry(run, 1)).rejects.toThrow('locked');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not retry any other error', async () => {
    const run = jest.fn().mockRejectedValue(new Error('CHECK constraint failed: task'));
    await expect(runWithBusyRetry(run, 1)).rejects.toThrow('CHECK');
    expect(run).toHaveBeenCalledTimes(1);
  });
});
