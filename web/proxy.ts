import { NextResponse, type NextRequest } from 'next/server'

/** Optimistic auth check: the cloud app requires a session; server components re-check the user. */
export function proxy(req: NextRequest) {
  if (!req.cookies.get('pc_user')) {
    const url = new URL('/login', req.url)
    url.searchParams.set('next', req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/app/:path*'] }
