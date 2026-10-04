import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useMyGroup } from '@/lib/group/useMyGroup'
import Login from '@/routes/Login'
import JoinOrCreateGroup from '@/routes/JoinOrCreateGroup'
import Layout from '@/components/Layout'
import BookLayout from '@/components/BookLayout'
import Home from '@/routes/Home'
import Bulletin from '@/routes/Bulletin'
import BookDetail from '@/routes/BookDetail'
import Thread from '@/routes/Thread'

// Everyone hits Home, BookLayout, BookDetail, and Thread (the default
// landing point from Home) on essentially every visit -- those stay in the
// main bundle. Everything below is reached less often (once a session, or
// rarely at all), so it's worth a separate chunk each rather than making
// people reading Discussion on mobile download the admin/reset tooling,
// the achievements feed, and the review form upfront.
const Achievements = lazy(() => import('@/routes/Achievements'))
const AddBook = lazy(() => import('@/routes/AddBook'))
const ChaptersEditor = lazy(() => import('@/routes/ChaptersEditor'))
const Reviews = lazy(() => import('@/routes/Reviews'))
const Settings = lazy(() => import('@/routes/Settings'))
const Changelog = lazy(() => import('@/routes/Changelog'))
const CoverGallery = lazy(() => import('@/routes/CoverGallery'))
const MemberProfile = lazy(() => import('@/routes/MemberProfile'))

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
    <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
        <Route element={<Layout group={group} />}>
          <Route path="/" element={<Home group={group} />} />
          <Route path="/bulletin" element={<Bulletin group={group} />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/add-book" element={<AddBook group={group} />} />
          <Route path="/member/:userId" element={<MemberProfile />} />
          <Route element={<BookLayout />}>
            <Route path="/book/:bookId" element={<BookDetail group={group} />} />
            <Route
              path="/book/:bookId/chapters"
              element={<ChaptersEditor group={group} />}
            />
            <Route
              path="/book/:bookId/thread"
              element={<Thread group={group} />}
            />
            <Route
              path="/book/:bookId/reviews"
              element={<Reviews group={group} />}
            />
            <Route
              path="/book/:bookId/covers"
              element={<CoverGallery group={group} />}
            />
          </Route>
          <Route path="/settings" element={<Settings group={group} />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  )
}
