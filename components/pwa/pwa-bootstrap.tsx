"use client"

import { useEffect, useState } from "react"

type PwaState = "registering" | "ready" | "unavailable"

export function PwaBootstrap() {
  const [online, setOnline] = useState(true)
  const [pwaState, setPwaState] = useState<PwaState>("registering")

  useEffect(() => {
    setOnline(navigator.onLine)
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .then(() => setPwaState("ready"))
        .catch(() => setPwaState("unavailable"))
    } else {
      setPwaState("unavailable")
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 sm:px-6">
      <span className="flex items-center gap-2" aria-live="polite">
        <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />
        {online ? "Con conexión" : "Sin conexión"}
      </span>
      <span>
        {pwaState === "ready"
          ? "Capa PWA activa · recursos de la aplicación en caché al utilizarlos"
          : pwaState === "registering"
            ? "Preparando disponibilidad offline…"
            : "PWA no disponible en este entorno"}
      </span>
    </div>
  )
}
