import BottomNav from "@/components/BottomNav"

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full safe-shell duo-rail:pr-0">
      <main className="flex-1 overflow-y-auto pb-safe duo-rail:rail-gutter">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
