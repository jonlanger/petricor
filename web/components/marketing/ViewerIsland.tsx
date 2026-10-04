'use client'
import dynamic from 'next/dynamic'

const DeviceViewer = dynamic(() => import('@/components/three/DeviceViewer'), { ssr: false, loading: () => <div className="grid h-full place-items-center font-mono text-[12px] text-muted">Loading 3D model…</div> })

export default function ViewerIsland({ height = 'h-[560px] sm:h-[680px]' }: { height?: string }) {
  return (
    <div className={`mt-12 overflow-hidden rounded-3xl bg-gradient-to-b from-[#eef0f4] to-[#dfe1e7] ${height}`}>
      <DeviceViewer className="h-full w-full" initialExplode={0.35} />
    </div>
  )
}
