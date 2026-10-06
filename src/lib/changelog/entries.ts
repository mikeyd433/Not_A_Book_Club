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
    id: 'avatar-cropper',
    date: '2026-10-06',
    title: 'Crop your own profile picture',
    body: "Changing your photo in Settings now opens a crop tool -- drag to reposition, slide to zoom, and rotate -- with a circular guide showing exactly how it'll look, instead of automatically cropping to a centered square.",
  },
  {
    id: 'condensed-bar-title-no-longer-cut-off',
    date: '2026-10-06',
    title: "Fixed long book titles getting cut off in Discussion's scrolled banner",
    body: 'The title and chapter picker shared one line, so a long title got truncated to make room for the picker. The picker now sits on its own line below the title instead, so the full title always shows.',
  },
  {
    id: 'book-progress-bar-and-animation',
    date: '2026-10-06',
    title: 'Your progress on a book, right in its header',
    body: "A book's page now shows your own progress bar under the title, on every tab. Progress bars everywhere also animate now -- a moving diagonal-stripe fill, with an \"Animate progress bars\" toggle in Settings → Appearance if you'd rather they stayed still.",
  },
  {
    id: 'condensed-bar-single-row',
    date: '2026-10-06',
    title: "Tightened up Discussion's scrolled banner",
    body: "The cover, title, and chapter picker in Discussion's condensed bar now share one row instead of leaving an empty gap down the middle.",
  },
  {
    id: 'condensed-bar-bigger-cover',
    date: '2026-10-05',
    title: "Bigger cover and title in Discussion's scrolled banner",
    body: "The cover and title in the condensed bar (shown once you scroll down in Discussion) were noticeably undersized for the space. Both are bigger now.",
  },
  {
    id: 'discussion-picker-bigger-at-top',
    date: '2026-10-05',
    title: "Discussion's chapter picker is bigger at the top of the page",
    body: "Now a full-size \"Current chapter\" button next to Oldest/Newest first when you're at the top of the page -- the small pill version only shows once you scroll, in the condensed bar with the cover and title.",
  },
  {
    id: 'progress-label-and-animation',
    date: '2026-10-05',
    title: 'Progress bars now say "Progress:" and fill in on load',
    body: '"Now reading" implied you were mid-chapter, when really it\'s the chapter you picked after finishing it -- relabeled to "Progress: [chapter]". The bar itself now animates filling in each time it appears, instead of just snapping straight to its value.',
  },
  {
    id: 'chapter-picker-under-bell',
    date: '2026-10-05',
    title: 'Tab row now lines up the same on every book page',
    body: "Discussion's chapter picker used to sit in its own row above the tabs, pushing Overview/Discussion/Chapters/Reviews lower than on every other tab. It now sits under the bell icon instead, so the tabs are at the same height no matter which tab you're on.",
  },
  {
    id: 'admin-activity-notifications',
    date: '2026-10-05',
    title: '🔎 Admin activity notifications',
    body: "New admin-only toggle in Settings → Notifications: get a push for every comment, bulletin post, new book, and chapter advance from the rest of the group -- handy for keeping an eye on things while beta testing. Off by default, and only visible to group admins.",
  },
  {
    id: 'progress-bar-now-reading',
    date: '2026-10-05',
    title: 'Progress bars now say "Now reading [chapter]"',
    body: 'Replaced the "Ch. X of Y" count under a book\'s progress bar with "Now reading" and the chapter\'s actual name. Finished (or read-before-joining) books no longer show a progress bar at all, since they\'re not "reading" any particular chapter.',
  },
  {
    id: 'chapter-number-suggestions-use-count',
    date: '2026-10-05',
    title: 'Fixed inflated chapter number suggestions on books with a Prologue',
    body: 'On a book with a Prologue (or any other front matter counted as a chapter), "+ Add chapter N as you go" and its suggested name could jump ahead of the real chapter count -- e.g. suggesting "Chapter 30" on a book with 25 chapters. It now counts chapters instead, so the suggestion matches what you\'d actually expect.',
  },
  {
    id: 'progress-bar-shows-chapter-label',
    date: '2026-10-05',
    title: "Fixed progress bars showing a different chapter than the book page",
    body: "A member's progress bar (on Home and their profile) could show a chapter number that didn't match what the book's own page showed for the same person, for the same reason as the last fix: it was counting position in the list instead of naming the actual chapter. It now shows the chapter's real name there too.",
  },
  {
    id: 'progress-hide-chapter-for-full-access',
    date: '2026-10-04',
    title: 'Simplified "Everyone\'s progress" for finished readers',
    body: 'Someone who\'s finished a book (or read it before joining) no longer shows a specific chapter next to their name there — just "Finished" or "Read before joining," since they have the whole thing either way.',
  },
  {
    id: 'discussion-gate-full-access',
    date: '2026-10-04',
    title: 'Fixed "read before joining" books gating Discussion at chapter 1',
    body: "Marking a book as read before joining (or finished) could still leave Discussion stuck asking you to confirm you'd \"read Chapter 1\" before showing anything, even though you already have full access. That gate now skips for anyone who's already unlocked the whole book.",
  },
  {
    id: 'progress-shows-chapter-label',
    date: '2026-10-04',
    title: "Fixed a confusing \"wrong chapter\" display",
    body: "A friend's progress (in \"Everyone's progress\" and on comments) could show a different chapter number than the one they actually picked, because it displayed an internal ordering number instead of the chapter's own name. Everywhere a chapter shows up now uses its actual name consistently.",
  },
  {
    id: 'wordmark-font',
    date: '2026-10-04',
    title: 'A little more personality in the header',
    body: '"Not A Book Club" in the top-left now has its own distinctive typeface instead of the plain system font.',
  },
  {
    id: 'multiple-groups',
    date: '2026-10-04',
    title: 'Join or start more than one group',
    body: 'Settings now has a "Your groups" switcher and a "Join or create another group" button, so you can belong to several groups and swap which one you\'re viewing. Invite links now work even if you\'re already in a group.',
  },
  {
    id: 'update-available-prompt',
    date: '2026-10-04',
    title: "You'll now be told when an update is ready",
    body: "Updates used to apply themselves silently in the background, with no way to tell whether you were on the latest version. A banner now appears with a one-tap Refresh when a new version is ready.",
  },
  {
    id: 'scroll-to-top-on-navigate',
    date: '2026-10-04',
    title: 'Fixed pages sometimes opening already scrolled down',
    body: "Opening a book (or switching its tabs) from partway down a scrolled page could land you mid-page instead of at the top. Every page now starts scrolled to the top.",
  },
  {
    id: 'accent-readability-clamp',
    date: '2026-10-04',
    title: 'Fixed hard-to-read cover colors on dark, moody covers',
    body: 'A book with a mostly dark cover (like Piranesi) could end up with a color too close to black to read as text. Colors sampled from a cover are now kept bright and saturated enough to stay legible, in both light and dark mode — existing books with an already-too-dark color were fixed too.',
  },
  {
    id: 'reuse-chapter-layout',
    date: '2026-10-04',
    title: 'Reuse a chapter layout from another group',
    body: "Adding a book that's already set up with chapters in another group now offers a one-tap way to copy that layout, instead of retyping the whole table of contents.",
  },
  {
    id: 'rename-group',
    date: '2026-10-04',
    title: 'Admins can rename the group',
    body: "Tap the group name in Settings (with a ✏️ next to it) to rename it — admins only.",
  },
  {
    id: 'cover-accent-cors-fix',
    date: '2026-10-04',
    title: "Fixed theming for books still stuck on the default color",
    body: "The earlier fix for this didn't actually work for most books — their auto-fetched cover couldn't be sampled in the browser at all. Color sampling for those now happens on the server instead, so every book's page should pick up its own color.",
  },
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
