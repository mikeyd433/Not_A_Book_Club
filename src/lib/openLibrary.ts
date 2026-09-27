export type OpenLibraryResult = {
  openLibraryId: string
  title: string
  author: string | null
  coverUrl: string | null
}

type OpenLibraryDoc = {
  key: string
  title: string
  author_name?: string[]
  cover_i?: number
}

export async function searchOpenLibrary(
  query: string,
): Promise<OpenLibraryResult[]> {
  if (!query.trim()) return []

  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=12`,
  )

  if (!res.ok) throw new Error('Open Library search failed')

  const json: { docs: OpenLibraryDoc[] } = await res.json()

  return json.docs.map((doc) => ({
    openLibraryId: doc.key.replace('/works/', ''),
    title: doc.title,
    author: doc.author_name?.[0] ?? null,
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : null,
  }))
}
