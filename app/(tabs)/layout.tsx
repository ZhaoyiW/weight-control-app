import BottomNav from "@/components/BottomNav"

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full safe-shell duo-rail:pr-0">
      {/* pt-4: keeps the first line clear of iOS's soft edge under the status bar */}
      <main className="flex-1 overflow-y-auto pt-4 pb-safe duo-rail:rail-gutter">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
