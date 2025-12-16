import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("[MES] Bootstrapping React app");

// In Lovable live preview, the PWA service worker can cache old JS/CSS/HTML and make it
// look like builds "finish" but the UI doesn't change. We disable SW + clear caches only
// on the preview domain to keep production PWA behavior intact.
async function disableServiceWorkerInPreview() {
  const host = window.location.hostname;
  const isPreview = host.endsWith("lovableproject.com");
  if (!isPreview) return;
  if (!("serviceWorker" in navigator)) return;

  const already = sessionStorage.getItem("lovable_preview_sw_disabled") === "1";
  if (already) return;

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    sessionStorage.setItem("lovable_preview_sw_disabled", "1");
    window.location.reload();
  } catch (e) {
    console.warn("[MES] Failed to disable service worker in preview:", e);
  }
}

void disableServiceWorkerInPreview();

createRoot(document.getElementById("root")!).render(<App />);

