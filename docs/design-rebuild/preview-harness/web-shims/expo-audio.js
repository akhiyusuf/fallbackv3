// Preview: microphone access is simulated (no audio is captured).
let granted = false;
const shape = () => ({ granted, status: granted ? 'granted' : 'undetermined', canAskAgain: true, expires: 'never' });
export const getRecordingPermissionsAsync = async () => shape();
export const requestRecordingPermissionsAsync = async () => { granted = true; return shape(); };
export const setAudioModeAsync = async () => {};
