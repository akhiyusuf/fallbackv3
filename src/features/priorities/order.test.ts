import { makeTask } from '@/features/task/testSupport/taskFixture';
import type { Instant, LocalDate } from '@/types';

import { groupByImportance } from './order';

const DATE = '2026-11-17' as LocalDate;

function task(id: string, patch: Parameters<typeof makeTask>[0] = {}) {
  return makeTask({ id, name: id, ...patch });
}

function names(list: readonly { name: string }[]) {
  return list.map((t) => t.name);
}

describe('groupByImportance (priority order)', () => {
  it('splits live tasks into High, Medium and Low', () => {
    const groups = groupByImportance(
      [task('a', { importance: 'high' }), task('b', { importance: 'med' }), task('c', { importance: 'low' }), task('d', { importance: 'high' })],
      DATE,
    );
    expect(names(groups.high)).toEqual(['a', 'd']);
    expect(names(groups.med)).toEqual(['b']);
    expect(names(groups.low)).toEqual(['c']);
  });

  it('leaves out a task with no importance', () => {
    const groups = groupByImportance([task('a', { importance: null }), task('b', { importance: 'high' })], DATE);
    expect(names(groups.high)).toEqual(['b']);
    expect(groups.med).toEqual([]);
    expect(groups.low).toEqual([]);
  });

  it('puts ranked tasks first, lowest rank first, then the tasks not placed yet, oldest first', () => {
    const groups = groupByImportance(
      [
        task('unplaced-new', { createdAt: '2026-03-01T00:00:00.000Z' as Instant }),
        task('ranked-2', { priorityRank: 2 }),
        task('unplaced-old', { createdAt: '2026-01-01T00:00:00.000Z' as Instant }),
        task('ranked-0', { priorityRank: 0 }),
      ],
      DATE,
    );
    expect(names(groups.high)).toEqual(['ranked-0', 'ranked-2', 'unplaced-old', 'unplaced-new']);
  });

  it('a task moved to the top (rank 0) comes before tasks ranked above it in the old order', () => {
    const groups = groupByImportance(
      [task('was-first', { priorityRank: 0 }), task('was-second', { priorityRank: 1 }), task('moved-up', { priorityRank: 0 })],
      DATE,
    );
    // Two tasks share rank 0: the sort is stable, so the one listed first keeps its place.
    expect(names(groups.high)).toEqual(['was-first', 'moved-up', 'was-second']);
  });

  it('equal ranks (ties) keep the order they were given in', () => {
    const groups = groupByImportance([task('x', { priorityRank: 3 }), task('y', { priorityRank: 3 })], DATE);
    expect(names(groups.high)).toEqual(['x', 'y']);
    const reversed = groupByImportance([task('y', { priorityRank: 3 }), task('x', { priorityRank: 3 })], DATE);
    expect(names(reversed.high)).toEqual(['y', 'x']);
  });

  it('unplaced tasks with the same creation time keep their given order (ties)', () => {
    const same = '2026-02-02T00:00:00.000Z' as Instant;
    const groups = groupByImportance([task('p', { createdAt: same }), task('q', { createdAt: same })], DATE);
    expect(names(groups.high)).toEqual(['p', 'q']);
  });

  it('a placed task always sorts before an unplaced one, whatever their creation times', () => {
    const groups = groupByImportance(
      [task('unplaced-ancient', { createdAt: '2020-01-01T00:00:00.000Z' as Instant }), task('placed-new', { priorityRank: 9, createdAt: '2026-11-01T00:00:00.000Z' as Instant })],
      DATE,
    );
    expect(names(groups.high)).toEqual(['placed-new', 'unplaced-ancient']);
  });

  it('drops finished things: a done to-do, a note, an ended course and a past one-off event', () => {
    const groups = groupByImportance(
      [
        task('done-todo', { type: 'todo', todoDoneAt: '2026-11-10T00:00:00.000Z' as Instant }),
        task('note', { type: 'todo', isNote: true }),
        task('open-todo', { type: 'todo' }),
        task('ended-course', { type: 'course', endDate: '2026-11-01' as LocalDate }),
        task('running-course', { type: 'course', endDate: '2026-12-01' as LocalDate }),
        task('past-event', { type: 'event', eventDate: '2026-11-01' as LocalDate }),
        task('future-event', { type: 'event', eventDate: '2026-12-24' as LocalDate }),
        task('repeating-event', { type: 'event', eventDate: null, cadence: { kind: 'daily' } }),
      ],
      DATE,
    );
    expect(names(groups.high)).toEqual(['open-todo', 'running-course', 'future-event', 'repeating-event']);
  });

  it('an ended course that ends today is still live', () => {
    const groups = groupByImportance([task('ends-today', { type: 'course', endDate: DATE })], DATE);
    expect(names(groups.high)).toEqual(['ends-today']);
  });
});
