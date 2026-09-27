export type ShelfStatus =
  | 'reading'
  | 'paused'
  | 'finished'
  | 'dnf'
  | 'read_before_joining'
  | 'want_to_read'

export const SHELF_STATUS_LABELS: Record<ShelfStatus, string> = {
  reading: 'Reading now',
  paused: 'Paused',
  finished: 'Finished',
  dnf: 'Did not finish',
  read_before_joining: 'Read before joining',
  want_to_read: 'Want to read',
}

export type SortPref = 'chapter' | 'newest' | 'recently_unlocked' | 'most_reactions'
