// Stand-in for expo-audio in tests: the real module needs a phone. A test that cares about the
// microphone or about which sound played replaces this with its own jest.mock().
const player = () => ({ play: jest.fn(), pause: jest.fn(), remove: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), volume: 1 });
const granted = { granted: true, status: 'granted', canAskAgain: true, expires: 'never' };
module.exports = {
  createAudioPlayer: jest.fn(player),
  useAudioPlayer: jest.fn(player),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  getRecordingPermissionsAsync: jest.fn(() => Promise.resolve(granted)),
  requestRecordingPermissionsAsync: jest.fn(() => Promise.resolve(granted)),
};
