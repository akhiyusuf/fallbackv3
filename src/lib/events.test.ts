import { emit, on } from './events';
import type { AppEvent } from '@/types';

describe('event bus', () => {
  it('delivers an emitted event to a subscribed handler', () => {
    const seen: AppEvent[] = [];
    const off = on('task:changed', (e) => seen.push(e));
    emit({ type: 'task:changed', taskId: 't1' as never });
    expect(seen).toHaveLength(1);
    off();
  });

  it('unsubscribe stops further delivery', () => {
    const seen: AppEvent[] = [];
    const off = on('settings:changed', (e) => seen.push(e));
    off();
    emit({ type: 'settings:changed' });
    expect(seen).toHaveLength(0);
  });

  it('does not deliver a different event type to an unrelated handler', () => {
    const seen: AppEvent[] = [];
    on('level:up', (e) => seen.push(e));
    emit({ type: 'store:ready' });
    expect(seen).toHaveLength(0);
  });

  it('a handler unsubscribing itself mid-emit does not throw', () => {
    let off: () => void = () => {};
    off = on('store:erased', () => off());
    expect(() => emit({ type: 'store:erased' })).not.toThrow();
  });
});
