import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useMyGroup } from '@/lib/group/useMyGroup'
import Login from '@/routes/Login'
import JoinOrCreateGroup from '@/routes/JoinOrCreateGroup'
import Layout from '@/components/Layout'
import Home from '@/routes/Home'
import AddBook from '@/routes/AddBook'
import BookDetail from '@/routes/BookDetail'
import ChaptersEditor from '@/routes/ChaptersEditor'
import Thread from '@/routes/Thread'
import Settings from '@/routes/Settings'

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { data: group, isLoading: groupLoading } = useMyGroup()

  if (authLoading) {
    return <FullScreenSpinner />
  }

  if (!user) {
    return <Login />
  }

  if (groupLoading) {
    return <FullScreenSpinner />
  }

  if (!group) {
    return <JoinOrCreateGroup />
  }

  return (
    <Routes>
      <Route element={<Layout group={group} />}>
        <Route path="/" element={<Home group={group} />} />
        <Route path="/add-book" element={<AddBook group={group} />} />
        <Route path="/book/:bookId" element={<BookDetail group={group} />} />
        <Route
          path="/book/:bookId/chapters"
          element={<ChaptersEditor group={group} />}
        />
        <Route path="/book/:bookId/thread" element={<Thread group={group} />} />
        <Route path="/settings" element={<Settings group={group} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  )
}
