import BottomNav from "@/components/BottomNav"

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-y-auto pb-safe">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
