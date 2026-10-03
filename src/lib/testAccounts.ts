import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// supabase-js's own error for a non-2xx response from an Edge Function is
// always the same unhelpful "Edge Function returned a non-2xx status code"
// -- the actual reason (e.g. "Only a group admin can manage test accounts",
// or the Anonymous Sign-Ins hint) is sitting in the response body, which
// FunctionsHttpError exposes as `.context` (a Response) rather than in
// `.message`. Without unwrapping it, every failure here looks identical
// and undiagnosable from the UI alone.
async function describeFunctionError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.text().catch(() => '')
    return new Error(body || error.message)
  }
  return error instanceof Error ? error : new Error('Something went wrong.')
}

// Lets an admin create a throwaway, email-less member (a real Supabase
// anonymous auth user, added to the group server-side -- see the
// test-accounts edge function) and swap the browser's *actual* auth
// session to it, so testing something like "does this comment stay hidden
// until revealed" reflects real RLS/auth.uid() behavior instead of
// approximating it. Swapping back restores the admin's own session.
//
// Everything here is per-device (localStorage), never synced to the
// account or any other device -- this is scaffolding for the person
// running it, not a feature other group members see or are affected by.
const ACCOUNTS_KEY = 'nabc-test-accounts'
const REAL_SESSION_KEY = 'nabc-real-session'
const ACTIVE_VIEW_KEY = 'nabc-active-view'

type SavedSession = { access_token: string; refresh_token: string }
export type SavedTestAccount = {
  userId: string
  label: string
  session: SavedSession
}

function readAccounts(): SavedTestAccount[] {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY)
    return raw ? (JSON.parse(raw) as SavedTestAccount[]) : []
  } catch {
    return []
  }
}

function writeAccounts(accounts: SavedTestAccount[]) {
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

export function listTestAccounts(): SavedTestAccount[] {
  return readAccounts()
}

// 'me' means the signed-in account is the admin's own; otherwise it's the
// user_id of whichever test account is currently active.
export function getActiveView(): string {
  return window.localStorage.getItem(ACTIVE_VIEW_KEY) ?? 'me'
}

export function getActiveTestAccount(): SavedTestAccount | null {
  const active = getActiveView()
  if (active === 'me') return null
  return readAccounts().find((a) => a.userId === active) ?? null
}

export async function createTestAccount(label: string): Promise<SavedTestAccount> {
  const { data, error } = await supabase.functions.invoke<{
    userId: string
    label: string
    access_token: string
    refresh_token: string
  }>('test-accounts', { body: { action: 'create', label } })
  if (error) throw await describeFunctionError(error)
  if (!data) throw new Error('No response from server.')

  const account: SavedTestAccount = {
    userId: data.userId,
    label: data.label,
    session: { access_token: data.access_token, refresh_token: data.refresh_token },
  }
  writeAccounts([...readAccounts(), account])
  return account
}

export async function deleteTestAccount(userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('test-accounts', {
    body: { action: 'delete', userId },
  })
  if (error) throw await describeFunctionError(error)

  writeAccounts(readAccounts().filter((a) => a.userId !== userId))

  if (getActiveView() === userId) {
    // The account whose session we're currently wearing no longer exists --
    // nothing to save back for it, just get back to the real session.
    window.localStorage.setItem(ACTIVE_VIEW_KEY, 'me')
    const real = readSavedSession(REAL_SESSION_KEY)
    if (real) await supabase.auth.setSession(real)
    window.location.assign(import.meta.env.BASE_URL)
  }
}

export type ClearedTestData = {
  comments: number
  reactions: number
  ratings: number
  chapterEdits: number
}

// Wipes every test account's comments/reactions/ratings/chapter edits
// across the whole group without deleting the accounts themselves -- for
// clearing out a mess made mid-test-session without having to recreate
// (and re-add to your shelf, re-position in chapters, etc.) the accounts
// you were using. Deleting a test comment cascades its own replies too,
// including from real members -- the confirm prompt in TestAccountsPanel
// says so up front rather than this function silently doing it.
export async function clearAllTestData(): Promise<ClearedTestData> {
  const { data, error } = await supabase.functions.invoke<ClearedTestData>('test-accounts', {
    body: { action: 'clear-data' },
  })
  if (error) throw await describeFunctionError(error)
  if (!data) throw new Error('No response from server.')
  return data
}

function readSavedSession(key: string): SavedSession | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as SavedSession) : null
  } catch {
    return null
  }
}

// Refreshes whichever slot ('me' or a test account's user_id) the browser
// is about to switch away from with its current tokens before swapping --
// Supabase rotates refresh tokens on use, so the pair saved at creation
// time can go stale after the first time a slot is actually used.
async function captureCurrentSessionInto(slot: string) {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return
  const saved: SavedSession = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  }
  if (slot === 'me') {
    window.localStorage.setItem(REAL_SESSION_KEY, JSON.stringify(saved))
    return
  }
  const accounts = readAccounts()
  const idx = accounts.findIndex((a) => a.userId === slot)
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], session: saved }
    writeAccounts(accounts)
  }
}

export async function switchToTestAccount(account: SavedTestAccount): Promise<void> {
  await captureCurrentSessionInto(getActiveView())
  const { error } = await supabase.auth.setSession(account.session)
  if (error) throw error
  window.localStorage.setItem(ACTIVE_VIEW_KEY, account.userId)
  // A hard reload rather than a route change: every query in the app is
  // cached by React Query in memory, and most cache keys aren't scoped by
  // user id, so switching the auth session alone would keep showing the
  // previous account's data until each query happened to refetch.
  window.location.assign(import.meta.env.BASE_URL)
}

export async function switchToReal(): Promise<void> {
  const current = getActiveView()
  if (current === 'me') return
  await captureCurrentSessionInto(current)
  const real = readSavedSession(REAL_SESSION_KEY)
  if (!real) {
    throw new Error("Couldn't find your saved session — please log in again.")
  }
  const { error } = await supabase.auth.setSession(real)
  if (error) throw error
  window.localStorage.setItem(ACTIVE_VIEW_KEY, 'me')
  window.location.assign(import.meta.env.BASE_URL)
}
