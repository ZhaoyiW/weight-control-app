import type { Metadata, Viewport } from "next"
import "./globals.css"
import DuoLayoutProvider from "@/components/DuoLayoutProvider"

export const metadata: Metadata = {
  title: "CalTrack",
  description: "Daily calorie & weight tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    // Lets the page draw under the status bar, so on the Duo the side nav can
    // sit in the status-bar column on the right. iOS then shows white status text.
    statusBarStyle: "black-translucent",
    title: "CalTrack",
  },
  icons: {
    apple: "/icon_192.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-bg">
        <DuoLayoutProvider>{children}</DuoLayoutProvider>
      </body>
    </html>
  )
}
