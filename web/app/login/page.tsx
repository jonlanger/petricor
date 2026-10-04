import { db } from '@/lib/server/store'
import LoginPicker from './LoginPicker'
import Logo from '@/components/brand/Logo'

export const metadata = { title: 'Sign in' }

export default async function Login({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams
  const users = db().users
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-blue p-12 text-white lg:flex lg:flex-col">
        <Logo className="h-8 text-[20px]" inverted />
        <div className="mt-auto">
          <div className="font-mono text-[56px] font-semibold leading-[0.98] tracking-tight">Petricor<br />Cloud</div>
          <p className="mt-6 max-w-md text-[17px] text-white/80">Review cultures, sign off results and trace every dish from collection to report — across every PC-6 in your lab.</p>
        </div>
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full border-[60px] border-white/10" />
      </section>
      <section className="flex flex-col justify-center px-6 py-16 sm:px-16">
        <div className="eyebrow">Demo workspace · Demo Microbiology Lab</div>
        <h1 className="mt-2 font-mono text-[32px] font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 max-w-md text-muted">Production sign-in uses your organisation&apos;s SSO. In this demo, choose a persona — each role sees different permissions.</p>
        <LoginPicker users={users} next={typeof sp.next === 'string' ? sp.next : '/app'} />
      </section>
    </main>
  )
}
