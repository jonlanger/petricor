import 'server-only'
import { cookies } from 'next/headers'
import { db } from './store'
import type { User } from '../domain/types'

export const SESSION_COOKIE = 'pc_user'

/** Demo auth: persona selection. Production: OIDC/SAML SSO with role claims (docs/ARCHITECTURE.md). */
export async function currentUser(): Promise<User | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value
  return db().users.find((u) => u.id === id) ?? null
}

export const can = {
  review: (u: User | null) => !!u && ['microbiologist', 'mycologist', 'director'].includes(u.role),
  operate: (u: User | null) => !!u,
  admin: (u: User | null) => !!u && u.role === 'director',
}
