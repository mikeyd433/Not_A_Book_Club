import { coverPublicUrl } from '@/lib/books/queries'

type CoverBook = {
  title: string
  open_library_cover_url: string | null
  default_cover?: { storage_path: string } | null
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
  const src = personalCoverPath
    ? coverPublicUrl(personalCoverPath)
    : book.default_cover
      ? coverPublicUrl(book.default_cover.storage_path)
      : book.open_library_cover_url

  if (src) {
    return (
      <img
        src={src}
        alt={book.title}
        className={`aspect-[2/3] rounded-lg object-cover ${className}`}
      />
    )
  }

  return (
    <div
      className={`flex aspect-[2/3] items-center justify-center rounded-lg bg-accent p-2 text-center text-xs font-semibold text-accent-contrast ${className}`}
    >
      {book.title}
    </div>
  )
}
