jest.mock('@/services/sfx', () => ({ play: jest.fn() }));

import { play } from '@/services/sfx';

import { useToastStore } from './toast';

const playMock = play as jest.Mock;

describe('toast sounds', () => {
  beforeEach(() => {
    playMock.mockClear();
    useToastStore.setState({ toast: null });
  });

  it('a warning toast plays the error sound', () => {
    useToastStore.getState().show('Could not save', 'warning');
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(playMock).toHaveBeenCalledWith('error');
  });

  it('a plain success toast plays the saved sound', () => {
    useToastStore.getState().show('Saved', 'success');
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(playMock).toHaveBeenCalledWith('saved');
  });

  it('a success toast with a state icon plays no sound of its own (the log sound plays instead)', () => {
    useToastStore.getState().show('Logged', 'success', { icon: 'ideal' });
    expect(playMock).not.toHaveBeenCalled();
  });

  it('a neutral toast plays nothing', () => {
    useToastStore.getState().show('Heads up');
    expect(playMock).not.toHaveBeenCalled();
  });

  it('a warning toast with an icon still plays the error sound', () => {
    useToastStore.getState().show('Skipped by mistake', 'warning', { icon: 'skip' });
    expect(playMock).toHaveBeenCalledWith('error');
  });

  it('the toast itself is still shown whatever the sound', () => {
    useToastStore.getState().show('Could not save', 'warning');
    expect(useToastStore.getState().toast).toMatchObject({ message: 'Could not save', tone: 'warning', icon: null });
  });
});
