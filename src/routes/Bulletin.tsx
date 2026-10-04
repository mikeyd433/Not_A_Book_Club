import { useMemo } from 'react'
import { usePosts, usePostToBulletin } from '@/lib/bulletin/queries'
import { buildForest, type Post } from '@/lib/bulletin/forest'
import Composer from '@/components/bulletin/Composer'
import PostNode from '@/components/bulletin/PostNode'
import QueryError from '@/components/QueryError'
import type { MyGroup } from '@/lib/group/useMyGroup'

export default function Bulletin({ group }: { group: MyGroup }) {
  const { data: posts, isError, error, refetch } = usePosts(group.id)
  const postToBulletin = usePostToBulletin(group.id)
  const isAdmin = group.role === 'admin'

  const roots = useMemo(() => buildForest((posts ?? []) as Post[]), [posts])

  if (isError) {
    return <QueryError error={error} onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">📌 Bulletin Board</h1>
        <p className="text-sm text-muted">
          Chat with the group about anything — not tied to any one book.
        </p>
      </div>

      <Composer
        onSubmit={async (input) => {
          await postToBulletin.mutateAsync(input)
        }}
      />

      {roots.length === 0 ? (
        <p className="rounded-card bg-surface p-4 text-center text-sm text-muted">
          Nothing posted yet — be the first!
        </p>
      ) : (
        <ul>
          {roots.map((node) => (
            <PostNode
              key={node.post.id}
              node={node}
              isAdmin={isAdmin}
              groupId={group.id}
              onReply={async (input, parentId) => {
                await postToBulletin.mutateAsync({ ...input, parentId })
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
