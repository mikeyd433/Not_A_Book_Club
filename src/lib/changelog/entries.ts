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
    id: 'shelf-transfer-foreign-replies-collapsed',
    date: '2026-10-13',
    title: 'Replies carried over from another group start collapsed',
    body: "A reply that came along with a transferred book -- from someone in the old group who isn't in this one -- now stays tucked behind a \"replies from [group]\" tap instead of showing up inline right away. Your own transferred comments still show normally; it's just the other-group replies underneath them that wait for a tap.",
  },
  {
    id: 'shelf-transfer-comments-full-tree',
    date: '2026-10-13',
    title: "Transferred discussion isn't capped to your own reading position anymore",
    body: "When a transferred book brought its comments along, replies past wherever you personally were in the old group used to get left behind. They don't anymore -- the whole reply tree comes along (flagged ones aside), the same way comments always work: hidden until each reader in the new group catches up to that chapter themselves.",
  },
  {
    id: 'shelf-transfer-comments',
    date: '2026-10-13',
    title: 'Transferring a book now brings your discussion with it',
    body: "When the join-time picker adds a book that's new to the group, it now also carries over the comments you personally posted on it elsewhere, plus every reply to them (from anyone, not just you) that you're currently allowed to see -- same spoiler-lock rules as always, so nothing ahead of your own position comes along. Only applies to books it's adding fresh; one that already existed in the new group keeps its own separate discussion untouched.",
  },
  {
    id: 'shelf-transfer-everything',
    date: '2026-10-13',
    title: "The join picker now covers your whole shelf",
    body: "The checklist shown after joining a group used to only offer books that already existed in both groups. It now shows your entire shelf from every other group you're in -- every status, checked by default -- and adds a book there for you (with its chapters, if it's one you're reading) if it isn't already in the new group. Uncheck anything you'd rather leave behind.",
  },
  {
    id: 'cross-group-reading-progress-transfer',
    date: '2026-10-13',
    title: "Carry a book you're currently reading into a new group too",
    body: "The checklist shown after joining a group now also offers books you're still partway through elsewhere (reading or paused), not just ones you've finished -- picking one carries over your actual chapter position, not just the status, so you don't lose your place.",
  },
  {
    id: 'cross-group-profile-labels-and-replies',
    date: '2026-10-13',
    title: "Profile pages now label books and threads from your other groups",
    body: "If you're in more than one group, your profile's Shelf and Recent Activity already included books from all of them -- now a book from a group other than the one you're currently viewing is labeled with its group name (and isn't a dead-end link into the wrong group's page). Threads you started also get a \"View replies\" toggle to see what others said back.",
  },
  {
    id: 'cross-group-read-transfer',
    date: '2026-10-13',
    title: "Carry 'already read' books into a new group",
    body: "Joining a group that shares books with one you're already in (matched by edition) now offers a checklist right after you join -- pick which of those you've already read/DNF'd elsewhere to mark the same way here, instead of starting from scratch.",
  },
  {
    id: 'profile-activity-reply-labels',
    date: '2026-10-12',
    title: 'Replies are labeled on profile pages',
    body: "Recent activity on a profile page now marks a comment as \"↩ Reply\" (naming who they replied to, when visible) instead of looking like every comment started its own thread.",
  },
  {
    id: 'profile-activity-date-range',
    date: '2026-10-12',
    title: 'Recent activity now filters by date, not just a count',
    body: "Profile pages used to always show your last 20 comments, however old. There's now a range picker (7/30/90 days, or all time, defaulting to 30 days) so it actually reflects a time window instead of a fixed count.",
  },
  {
    id: 'profile-page-collapse-and-sort',
    date: '2026-10-12',
    title: 'Collapsible activity and a shelf sort on profile pages',
    body: "Recent activity on a profile page now groups by book, collapsed by default -- tap a book to expand its comments instead of scrolling a long flat list. The Shelf section there also got the same sort picker as Home (by status, title, or recently added).",
  },
  {
    id: 'groups-and-profile-pages',
    date: '2026-10-12',
    title: 'New Groups and Profile pages',
    body: "Two new pages: tap your group's name in the header to switch between every group you're in (it used to be buried in Settings), and tap your avatar to see your own shelf and recent activity -- the same view you get on anyone else's profile, just for you. Editing your name and photo still happens in Settings.",
  },
  {
    id: 'fix-invite-link-blank-page',
    date: '2026-10-12',
    title: 'Fixed a blank page when tapping an invite link to a group you’re already in',
    body: "Tapping an invite link to a group you already belong to used to redirect in an endless loop and land on a blank screen instead of ever showing the join screen. It now opens normally -- same place Settings' \"Join or create another group\" goes, with the code already filled in.",
  },
  {
    id: 'started-not-finished-chapter-1',
    date: '2026-10-12',
    title: '"I started Chapter 1" instead of "I finished"',
    body: "The button that opens up a book's discussion used to say \"I finished Chapter 1,\" which asked for more than it needed to -- you only have to start a chapter to join in. Other members' comments in that chapter still stay hidden behind a Reveal tap until you're ready for them, same as always.",
  },
  {
    id: 'home-sort-fixes',
    date: '2026-10-12',
    title: "Sorting Home now actually sorts everything",
    body: "Switching the Home sort picker to \"Title (A-Z)\" or \"Recently added\" used to leave the \"On others' shelves\" row in its own order, untouched by whatever you picked -- it now sorts along with the rest. Also fixed those same two modes occasionally listing a book twice (once under \"On others' shelves,\" once again under \"Your shelf\" as \"Not on your shelf\").",
  },
  {
    id: 'heatmap-counts-comments',
    date: '2026-10-12',
    title: 'Chapter heatmap now counts comments, not just reactions',
    body: "The chapter activity heatmap on a book's Reviews tab used to only count emoji reactions, so a chapter with plenty of discussion but no reactions showed as flat. It now counts each comment too, so the bars actually reflect where the conversation happened.",
  },
  {
    id: 'discover-progress-bars',
    date: '2026-10-07',
    title: "Progress bars on others' shelves",
    body: "When someone else in your group is currently reading a book you haven't shelved yet, the Home page now shows their progress bar and current chapter under \"On others' shelves,\" the same way it shows yours under your own shelf.",
  },
  {
    id: 'heic-photo-support',
    date: '2026-10-06',
    title: 'HEIC photos now actually work',
    body: "iPhone photos (HEIC format) couldn't be previewed or attached anywhere in the app before -- they now get converted automatically when you pick one, for comment/post attachments, your profile picture, and book covers alike. Takes a moment to convert; you'll see \"Converting…\" while it works.",
  },
  {
    id: 'photo-attach-preview-error',
    date: '2026-10-06',
    title: "Clearer message when a photo attachment can't be previewed",
    body: "A photo attached to a comment or post in a format your device couldn't display (HEIC photos are the usual culprit) used to just leave an empty box with a stray ✕ and no explanation. It now tells you the preview failed and to try a different photo.",
  },
  {
    id: 'achievements-paused',
    date: '2026-10-06',
    title: 'Achievements paused for now',
    body: "Taking achievements out of the app for the moment -- the strip on Home, the Achievements page, and the badges on member profiles are gone. Nothing earned is lost; it just isn't shown right now, in case it comes back in a more deliberate form later.",
  },
  {
    id: 'avatar-cache-fix-everywhere',
    date: '2026-10-06',
    title: 'Fixed profile photos not updating outside Settings',
    body: "The last fix only refreshed your own preview in Settings, and only until you navigated away. A new photo now shows up correctly everywhere it appears -- comments, posts, member profiles -- and stays that way.",
  },
  {
    id: 'avatar-crop-cache-fix',
    date: '2026-10-06',
    title: 'Fixed a new profile photo not actually showing up after cropping',
    body: "A re-cropped profile picture uploaded correctly but kept showing the old version -- your avatar reuses the same image address every time, which a cache held onto. It refreshes properly now.",
  },
  {
    id: 'cropper-zoom-stretch-fix',
    date: '2026-10-06',
    title: 'Fixed zoom distorting photos in the crop tool',
    body: "Zooming in on a profile picture (or a book cover) past a certain point stretched it vertically instead of scaling it evenly, cutting off the sides. Now scales uniformly like it should.",
  },
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
