jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: {}, readAsStringAsync: jest.fn(), writeAsStringAsync: jest.fn() }));

import { backupFileBaseName, offerBackupFile, type OfferDeps } from './offerBackupFile';

function deps(over: Partial<OfferDeps> = {}) {
  const written: Array<[string, string]> = [];
  const d: OfferDeps = {
    os: 'android',
    pickFolder: jest.fn(async () => ({ granted: true, directoryUri: 'content://tree/Downloads' })),
    createFile: jest.fn(async (folder: string, name: string) => `${folder}/${name}.json`),
    read: jest.fn(async () => '{"format":"fallback-backup"}'),
    write: jest.fn(async (uri: string, c: string) => {
      written.push([uri, c]);
    }),
    share: jest.fn(async () => undefined),
    ...over,
  };
  return { d, written };
}

describe('offering the backup FILE, not its path', () => {
  it('Android: the folder picker opens and the backup contents are written into the chosen folder', async () => {
    const { d, written } = deps();
    expect(await offerBackupFile('file:///data/fallback-backup-2026-11-20.json', d)).toBe('saved');
    expect(d.createFile).toHaveBeenCalledWith('content://tree/Downloads', 'fallback-backup-2026-11-20', 'application/json');
    expect(written).toEqual([['content://tree/Downloads/fallback-backup-2026-11-20.json', '{"format":"fallback-backup"}']]);
    expect(d.share).not.toHaveBeenCalled();
  });

  it('Android: closing the folder picker is a calm "declined", nothing written', async () => {
    const { d, written } = deps({ pickFolder: jest.fn(async () => ({ granted: false })) });
    expect(await offerBackupFile('file:///x/b.json', d)).toBe('declined');
    expect(written).toEqual([]);
  });

  it('Android: a failure at any step is "failed", never a throw', async () => {
    for (const over of [
      { pickFolder: jest.fn(async () => Promise.reject(new Error('no saf'))) },
      { read: jest.fn(async () => Promise.reject(new Error('gone'))) },
      { createFile: jest.fn(async () => Promise.reject(new Error('read-only'))) },
      { write: jest.fn(async () => Promise.reject(new Error('full'))) },
    ]) {
      const { d } = deps(over as Partial<OfferDeps>);
      expect(await offerBackupFile('file:///x/b.json', d)).toBe('failed');
    }
  });

  it('elsewhere the share sheet gets the file URL', async () => {
    const { d } = deps({ os: 'ios' });
    expect(await offerBackupFile('file:///x/b.json', d)).toBe('shared');
    expect(d.share).toHaveBeenCalledWith('file:///x/b.json');
    expect(d.pickFolder).not.toHaveBeenCalled();
  });

  it('the file name keeps the backup name and drops ".json" (the folder adds it from the type)', () => {
    expect(backupFileBaseName('file:///a/fallback-backup-2026-11-20T10%3A00.json')).toBe('fallback-backup-2026-11-20T10:00');
    expect(backupFileBaseName('')).toBe('fallback-backup');
  });
});
