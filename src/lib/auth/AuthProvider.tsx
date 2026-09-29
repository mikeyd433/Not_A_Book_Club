import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  authError: string | null
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  authError: null,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    // Supabase's client reads any access_token/error from the URL hash on
    // load, but leaves the hash itself in place -- so it stays in the
    // address bar and, worse, would get captured by a later
    // emailRedirectTo: window.location.href-style call. Read out any error
    // for display, then strip the hash once there's nothing left to read.
    if (window.location.hash) {
      const params = new URLSearchParams(window.location.hash.slice(1))
      const description = params.get('error_description')
      if (description) setAuthError(description)
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
        if (nextSession) setAuthError(null)
      },
    )

    return () => subscription.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, authError }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
