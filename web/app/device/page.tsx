import type { Metadata } from 'next'
import DeviceStation from './DeviceStation'

export const metadata: Metadata = { title: 'PC-6 touchscreen' }

export default async function Page({ searchParams }: PageProps<'/device'>) {
  const sp = await searchParams
  const id = typeof sp.id === 'string' ? sp.id : 'dev_a'
  const kiosk = sp.kiosk === '1'
  return <DeviceStation deviceId={id} kiosk={kiosk} operator={typeof sp.operator === 'string' ? sp.operator : undefined} />
}
