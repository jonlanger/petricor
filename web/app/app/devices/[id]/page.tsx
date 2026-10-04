import DeviceDetail from './DeviceDetail'
export const metadata = { title: 'Instrument' }
export default async function Page({ params }: PageProps<'/app/devices/[id]'>) {
  const { id } = await params
  return <DeviceDetail id={id} />
}
