import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

console.log("[MES] Bootstrapping React app");

// Register service worker for PWA functionality
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload to update?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('[PWA] App ready to work offline');
  },
});

createRoot(document.getElementById("root")!).render(<App />);

