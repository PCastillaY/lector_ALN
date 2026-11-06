import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Lector ALN | Biblioteca y lectura asistida",
  description: "Organiza tus documentos y prepárate para escucharlos con voces sintéticas naturales.",
  applicationName: "Lector ALN",
}

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f7f8fc",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
