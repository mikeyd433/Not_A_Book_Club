import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useBook, useMyShelfEntry, coverPublicUrl } from '@/lib/books/queries'
import {
  useCovers,
  useDeleteCover,
  useSetDefaultCover,
  useSetPersonalCover,
  useUploadCover,
} from '@/lib/covers/queries'
import CoverCropper from '@/components/CoverCropper'
import { fileToDataUrl } from '@/lib/image'
import type { MyGroup } from '@/lib/group/useMyGroup'

export default function CoverGallery({ group }: { group: MyGroup }) {
  const { bookId } = useParams<{ bookId: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: book } = useBook(bookId!)
  const { data: covers } = useCovers(bookId!)
  const { data: myEntry } = useMyShelfEntry(bookId!)
  const uploadCover = useUploadCover(bookId!)
  const deleteCover = useDeleteCover(bookId!)
  const setDefaultCover = useSetDefaultCover(bookId!)
  const setPersonalCover = useSetPersonalCover(bookId!)

  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [error, setError] = useState('')
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChosen(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      setCropSrc(await fileToDataUrl(file))
    } catch {
      setError("Couldn't read that file.")
    }
  }

  function handleLoadUrl() {
    if (!urlInput.trim()) return
    setError('')
    setCropSrc(urlInput.trim())
  }

  async function handleCropConfirm(blob: Blob, accent: { accent: string }) {
    const cover = await uploadCover.mutateAsync(blob)

    // The first cover uploaded auto-becomes the default (DB trigger), but
    // only *this* client has the accent color it computed while cropping —
    // carry it over now rather than re-fetching the image to recompute it.
    const { data: freshBook } = await supabase
      .from('books')
      .select('default_cover_id')
      .eq('id', bookId!)
      .single()
    if (freshBook?.default_cover_id === cover.id) {
      await supabase
        .from('books')
        .update({ accent_color: accent.accent })
        .eq('id', bookId!)
      queryClient.invalidateQueries({ queryKey: ['book', bookId] })
    }

    setCropSrc(null)
    setUrlInput('')
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold">Covers</h1>

      <div className="rounded-card bg-surface p-3">
        <p className="text-sm font-semibold">Add a cover</p>
        <p className="mt-1 text-xs text-muted">
          Anyone can add a cover. Every cover is cropped to about 2:3.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="min-h-11 rounded-lg border border-border px-3 py-2 text-sm font-semibold"
          >
            📷 Take photo
          </button>
          <button
            onClick={() => libraryInputRef.current?.click()}
            className="min-h-11 rounded-lg border border-border px-3 py-2 text-sm font-semibold"
          >
            🖼️ Photo library
          </button>
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void handleFileChosen(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleFileChosen(e.target.files?.[0])
            e.target.value = ''
          }}
        />

        <div className="mt-3 flex gap-2">
          <input
            type="url"
            placeholder="Or paste an image URL…"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent"
          />
          <button
            onClick={handleLoadUrl}
            className="min-h-11 shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-semibold"
          >
            Load
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

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
                  className="aspect-[2/3] w-full rounded-lg object-cover"
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

      {cropSrc && (
        <CoverCropper
          imageSrc={cropSrc}
          onCancel={() => setCropSrc(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  )
}
