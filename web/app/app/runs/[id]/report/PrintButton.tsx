'use client'
export default function PrintButton() {
  return <button onClick={() => window.print()} className="mt-2 rounded-md bg-ink px-3 py-1 text-white print:hidden">Print / save PDF</button>
}
