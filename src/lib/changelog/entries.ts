export type ChangelogEntry = {
  id: string
  date: string // YYYY-MM-DD, parsed as local time (see Changelog.tsx)
  title: string
  body: string
}

// Newest first. Add a new entry here whenever something user-visible
// ships -- the "new update" dot on the Settings gear icon and the "What's
// new" button compares the top entry's id against what's saved in
// localStorage (see seen.ts), so a fresh entry is what makes it light up.
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: 'owns-physical-copy',
    date: '2026-10-04',
    title: '📚 Flag books you own a physical copy of',
    body: "New checkbox on a book's Overview: mark that you own a physical copy and can loan it out. A \"Who owns a copy\" section shows everyone in the group who has.",
  },
  {
    id: 'cover-tap-to-expand',
    date: '2026-10-04',
    title: 'Tap a book\'s cover to see it larger',
    body: "On a book's page, tapping its cover now opens it full-size instead of jumping to Overview — use the Overview tab for that.",
  },
  {
    id: 'accent-color-for-all-covers',
    date: '2026-10-04',
    title: 'Every book now themes itself from its cover',
    body: "Previously only books with a manually uploaded cover picked up a matching accent color on their page — books still using their auto-fetched cover stayed the default purple. Now every book's cover gets sampled, including ones added before this fix.",
  },
  {
    id: 'not-on-anyones-shelf',
    date: '2026-10-04',
    title: 'Cleaned up Home\'s "Not on your shelf" group',
    body: 'Renamed to "Not on anyone\'s shelf" and it no longer repeats books already shown in "On others\' shelves" above it — each book now shows up once instead of twice when sorted by status.',
  },
  {
    id: 'bulletin-board',
    date: '2026-10-04',
    title: '📌 Bulletin Board',
    body: "A new tab for posting to the whole group without tying it to a book — threaded replies, reactions, photos and GIFs, and flagging, same as book discussions. Has its own notification toggle in Settings.",
  },
  {
    id: 'notify-already-read',
    date: '2026-10-04',
    title: "Notifications for books you've already read",
    body: "New opt-in in Settings: get notified about new comments on books you've finished or read before joining, not just ones you're actively reading or paused on. Muting a specific book still overrides this either way.",
  },
  {
    id: 'reread-read-before-joining',
    date: '2026-10-04',
    title: 'Reread mode now works for "read before joining" books',
    body: 'Starting a reread (re-locking spoilers and revealing chapter by chapter again) now works the same way for books marked "read before joining" as it already did for finished books. The reread button is also easier to find — it\'s no longer tucked behind "More options."',
  },
]
