/**
 * After a backup is made, put the FILE where the person can keep it.
 *
 * Android: React Native's Share sends only text, so sharing would hand over the file's path, not
 * the backup. Instead Android's own folder picker opens (Downloads, Drive, a USB stick...) and the
 * backup file is written into the folder chosen. Elsewhere the share sheet takes the file's URL.
 * Every step may be declined; nothing here ever throws.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Share } from 'react-native';

export type OfferResult = 'saved' | 'shared' | 'declined' | 'failed';

export interface OfferDeps {
  readonly os: string;
  readonly pickFolder: () => Promise<{ granted: boolean; directoryUri?: string }>;
  readonly createFile: (folderUri: string, name: string, mime: string) => Promise<string>;
  readonly read: (uri: string) => Promise<string>;
  readonly write: (uri: string, contents: string) => Promise<void>;
  readonly share: (uri: string) => Promise<void>;
}

const nativeDeps: OfferDeps = {
  os: Platform.OS,
  pickFolder: async () => {
    const r = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    return r.granted ? { granted: true, directoryUri: r.directoryUri } : { granted: false };
  },
  createFile: (folderUri, name, mime) => FileSystem.StorageAccessFramework.createFileAsync(folderUri, name, mime),
  read: (uri) => FileSystem.readAsStringAsync(uri),
  write: (uri, contents) => FileSystem.writeAsStringAsync(uri, contents),
  share: async (uri) => {
    await Share.share({ url: uri });
  },
};

/**
 * The file's own name without its extension. The folder's provider adds ".json" from the MIME type,
 * so a name left as "....fallbackbak" would be saved as "....fallbackbak.json". Both extensions this
 * app writes (the backup's ".fallbackbak" and a plain ".json") are dropped here.
 */
export function backupFileBaseName(uri: string): string {
  const last = uri.split('/').pop() || 'fallback-backup.json';
  return safeDecode(last).replace(/\.(json|fallbackbak)$/i, '') || 'fallback-backup';
}

/** A name with a stray "%" must not throw here: the file is still saved, under the raw name. */
function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export async function offerBackupFile(uri: string, deps: OfferDeps = nativeDeps): Promise<OfferResult> {
  try {
    if (deps.os !== 'android') {
      await deps.share(uri);
      return 'shared';
    }
    const folder = await deps.pickFolder();
    if (!folder.granted || !folder.directoryUri) return 'declined';
    const contents = await deps.read(uri);
    const dest = await deps.createFile(folder.directoryUri, backupFileBaseName(uri), 'application/json');
    await deps.write(dest, contents);
    return 'saved';
  } catch {
    return 'failed';
  }
}
