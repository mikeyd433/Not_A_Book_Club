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
