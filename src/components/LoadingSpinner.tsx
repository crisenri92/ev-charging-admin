export function LoadingSpinner({ bg = '#0f172a' }: { bg?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: bg }}>
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-400 border-t-transparent" />
    </div>
  )
}
