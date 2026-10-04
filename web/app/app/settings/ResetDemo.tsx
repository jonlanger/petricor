'use client'
import { useState } from 'react'
export default function ResetDemo() {
  const [done, setDone] = useState(false)
  return (
    <div className="text-[13px]">
      <p className="text-muted">Restore the seeded lab: three instruments, two completed runs and one run mid-incubation on Bench A.</p>
      <button onClick={async () => { if (!confirm('Reset all demo data?')) return; await fetch('/api/admin/reset', { method: 'POST' }); setDone(true); location.reload() }}
        className="mt-3 rounded-lg border border-crit/30 px-3 py-2 font-medium text-crit hover:bg-crit-50">{done ? 'Reset ✓' : 'Reset demo data'}</button>
    </div>
  )
}
