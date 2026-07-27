import { ROUTES } from '@/navigation';
import { confirmedDeleteDestination } from './deleteOrigin';

describe('confirmedDeleteDestination (S22 RULE 2 — confirmed delete, distinct from Keep-it/cancel)', () => {
  it('the most common path: S09 -> S20 -> S22 -> confirm -> S09 (Today), never Routines', () => {
    const dest = confirmedDeleteDestination({ openedFrom: 'manage', s20Origin: 'today', taskType: 'routine' });
    expect(dest).toBe(ROUTES.today);
  });

  it('S20 opened from a type browse tab -> that same tab', () => {
    expect(confirmedDeleteDestination({ openedFrom: 'manage', s20Origin: 'events', taskType: 'event' })).toBe(ROUTES.events);
    expect(confirmedDeleteDestination({ openedFrom: 'manage', s20Origin: 'courses', taskType: 'course' })).toBe(ROUTES.courses);
    expect(confirmedDeleteDestination({ openedFrom: 'manage', s20Origin: 'todos', taskType: 'todo' })).toBe(ROUTES.todos);
  });

  it('S20 opened from search (S14, unstable) -> falls back to the deleted task type tab', () => {
    const dest = confirmedDeleteDestination({ openedFrom: 'manage', s20Origin: 'search', taskType: 'course' });
    expect(dest).toBe(ROUTES.courses);
  });

  it('S20 with no origin at all (unknown) -> falls back to the deleted task type tab', () => {
    const dest = confirmedDeleteDestination({ openedFrom: 'manage', s20Origin: undefined, taskType: 'todo' });
    expect(dest).toBe(ROUTES.todos);
  });

  it('opened from S23 (as-needed) -> ALWAYS S10 Routines, regardless of forwarded origin', () => {
    expect(confirmedDeleteDestination({ openedFrom: 'as-needed', s20Origin: 'today', taskType: 'routine' })).toBe(ROUTES.routines);
    expect(confirmedDeleteDestination({ openedFrom: 'as-needed', s20Origin: 'search', taskType: 'routine' })).toBe(ROUTES.routines);
    expect(confirmedDeleteDestination({ openedFrom: 'as-needed', s20Origin: undefined, taskType: 'routine' })).toBe(ROUTES.routines);
  });

  it('never resolves to S14 (search) for either path', () => {
    const manage = confirmedDeleteDestination({ openedFrom: 'manage', s20Origin: 'search', taskType: 'routine' });
    const asNeeded = confirmedDeleteDestination({ openedFrom: 'as-needed', s20Origin: 'search', taskType: 'routine' });
    expect(manage).not.toBe(ROUTES.search);
    expect(asNeeded).not.toBe(ROUTES.search);
  });
});
