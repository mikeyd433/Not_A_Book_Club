import { coverPublicUrl } from '@/lib/books/queries'

export type CoverBook = {
  title: string
  open_library_cover_url: string | null
  default_cover?: { storage_path: string } | null
}

// Same resolution order CoverThumb renders with -- shared so anything else
// that needs the actual image URL (rather than a cropped thumbnail, e.g.
// BookLayout's "view cover larger" lightbox) stays in sync with it.
export function resolveCoverSrc(
  book: CoverBook,
  personalCoverPath?: string | null,
): string | null {
  return personalCoverPath
    ? coverPublicUrl(personalCoverPath)
    : book.default_cover
      ? coverPublicUrl(book.default_cover.storage_path)
      : book.open_library_cover_url
}

export default function CoverThumb({
  book,
  personalCoverPath,
  className = '',
}: {
  book: CoverBook
  personalCoverPath?: string | null
  className?: string
}) {
  const src = resolveCoverSrc(book, personalCoverPath)

  if (src) {
    return (
      <img
        src={src}
        alt={book.title}
        className={`aspect-[2/3] object-cover ${className}`}
      />
    )
  }

  return (
    <div
      className={`flex aspect-[2/3] items-center justify-center bg-accent p-2 text-center text-xs font-semibold text-accent-contrast ${className}`}
    >
      {book.title}
    </div>
  )
}
