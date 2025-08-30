import { cookies } from 'next/headers'

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'admin_session'

export function isAuthed() {
  const c = cookies().get(SESSION_COOKIE_NAME)
  return c?.value === '1'
}
