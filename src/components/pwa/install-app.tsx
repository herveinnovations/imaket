"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** Registers the service worker once and remembers Chrome/Edge's install prompt. */
export function PwaSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => { e.preventDefault(); deferred = e as BeforeInstallPromptEvent; listeners.forEach((l) => l()); };
    const onInstalled = () => { deferred = null; listeners.forEach((l) => l()); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  return null;
}

function useInstallState() {
  const [, force] = useState(0);
  const [env, setEnv] = useState({ standalone: false, ios: false, ready: false });
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    const ua = navigator.userAgent;
    setEnv({
      standalone: window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
      ios: /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document),
      ready: true,
    });
    return () => { listeners.delete(l); };
  }, []);
  return { ...env, canPrompt: !!deferred };
}

/**
 * "Install app" button. Chrome/Edge/Android: opens the browser's install dialog.
 * iPhone/iPad: shows the Share → Add to Home Screen steps. Other browsers: shows
 * how to install from the address bar. Hidden once iMaket runs as an app.
 */
export function InstallAppButton({ className, label = "Install the iMaket app" }: { className?: string; label?: string }) {
  const { standalone, ios, ready } = useInstallState();
  const [help, setHelp] = useState(false);
  if (!ready || standalone) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice.catch(() => null);
      deferred = null; listeners.forEach((l) => l());
      return;
    }
    setHelp(true);
  }

  return (
    <>
      <button type="button" onClick={install} className={cn("inline-flex items-center gap-2", className)}>
        <Download className="h-4 w-4" aria-hidden /> {label}
      </button>
      <Modal open={help} onClose={() => setHelp(false)} title="Install iMaket"
        description="Get iMaket on your home screen or desktop. It opens in its own window, like an app. Free, no app store needed.">
        {ios ? (
          <ol className="space-y-3 text-base">
            <li className="flex gap-3"><span className="font-semibold">1.</span><span>Open iMaket in <b>Safari</b>.</span></li>
            <li className="flex gap-3"><span className="font-semibold">2.</span><span>Tap the <b>Share</b> button <Share className="inline h-4 w-4 align-[-2px]" aria-label="Share" /> at the bottom of the screen.</span></li>
            <li className="flex gap-3"><span className="font-semibold">3.</span><span>Choose <b>Add to Home Screen</b> <SquarePlus className="inline h-4 w-4 align-[-2px]" aria-hidden />, then tap <b>Add</b>.</span></li>
          </ol>
        ) : (
          <ol className="space-y-3 text-base">
            <li className="flex gap-3"><span className="font-semibold">1.</span><span>Open iMaket in <b>Chrome</b> or <b>Edge</b>.</span></li>
            <li className="flex gap-3"><span className="font-semibold">2.</span><span>On a computer, click the install icon <Download className="inline h-4 w-4 align-[-2px]" aria-hidden /> at the right end of the address bar. On Android, open the <b>⋮</b> menu and tap <b>Install app</b>.</span></li>
            <li className="flex gap-3"><span className="font-semibold">3.</span><span>Click <b>Install</b>. iMaket appears on your desktop, Start menu or home screen.</span></li>
          </ol>
        )}
      </Modal>
    </>
  );
}
