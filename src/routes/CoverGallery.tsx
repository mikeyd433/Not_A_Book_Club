import { useParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useBook, useMyShelfEntry, coverPublicUrl } from '@/lib/books/queries'
import {
  useCovers,
  useDeleteCover,
  useSetDefaultCover,
  useSetPersonalCover,
} from '@/lib/covers/queries'
import CoverUploadPanel from '@/components/CoverUploadPanel'
import type { MyGroup } from '@/lib/group/useMyGroup'

export default function CoverGallery({ group }: { group: MyGroup }) {
  const { bookId } = useParams<{ bookId: string }>()
  const { user } = useAuth()
  const { data: book } = useBook(bookId!)
  const { data: covers } = useCovers(bookId!)
  const { data: myEntry } = useMyShelfEntry(bookId!)
  const deleteCover = useDeleteCover(bookId!)
  const setDefaultCover = useSetDefaultCover(bookId!)
  const setPersonalCover = useSetPersonalCover(bookId!)

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold">Covers</h1>

      <CoverUploadPanel bookId={bookId!} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {covers?.map((cover) => {
          const isDefault = cover.id === book?.default_cover_id
          const isMyPick = myEntry?.personal_cover_id === cover.id
          const canDelete =
            (cover.uploaded_by === user?.id && !isDefault) ||
            group.role === 'admin'

          return (
            <div key={cover.id} className="space-y-1.5">
              <div className="relative">
                <img
                  src={coverPublicUrl(cover.storage_path)}
                  alt=""
                  className="aspect-[2/3] w-full object-cover"
                />
                {isDefault && (
                  <span className="absolute left-1 top-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-contrast">
                    Default
                  </span>
                )}
                {isMyPick && (
                  <span className="absolute right-1 top-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-accent">
                    Your pick
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] text-muted">
                {cover.profiles?.display_name ?? 'Someone'}
              </p>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() =>
                    setPersonalCover.mutate(isMyPick ? null : cover.id)
                  }
                  className="min-h-9 w-full rounded-md border border-border px-2 py-1.5 text-[11px] font-medium"
                >
                  {isMyPick ? 'Clear pick' : 'Use as mine'}
                </button>
                {group.role === 'admin' && !isDefault && (
                  <button
                    onClick={() => setDefaultCover.mutate(cover)}
                    className="min-h-9 w-full rounded-md border border-accent px-2 py-1.5 text-[11px] font-medium text-accent"
                  >
                    Set default
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this cover?')) {
                        deleteCover.mutate(cover)
                      }
                    }}
                    className="min-h-9 w-full rounded-md border border-border px-2 py-1.5 text-[11px] font-medium text-red-600"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {covers?.length === 0 && (
        <p className="text-sm text-muted">
          No uploaded covers yet — {book?.open_library_cover_url ? 'the Open Library cover is showing for now.' : 'a placeholder is showing for now.'}
        </p>
      )}
    </div>
  )
}
