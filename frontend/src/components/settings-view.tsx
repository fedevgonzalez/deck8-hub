import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Power, Monitor, Info } from "lucide-react";
import { toast } from "sonner";

// Tauri autostart bindings — gracefully fail in browser
let autostartApi: {
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  isEnabled: () => Promise<boolean>;
} | null = null;

export function SettingsView() {
  const [autostart, setAutostart] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@tauri-apps/plugin-autostart")
      .then(async (mod) => {
        autostartApi = mod;
        const enabled = await mod.isEnabled();
        setAutostart(enabled);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleToggleAutostart = useCallback(async () => {
    if (!autostartApi) {
      toast.error("Not available outside Tauri");
      return;
    }
    try {
      if (autostart) {
        await autostartApi.disable();
        setAutostart(false);
        toast.success("Autostart disabled");
      } else {
        await autostartApi.enable();
        setAutostart(true);
        toast.success("Autostart enabled — will launch on login");
      }
    } catch (e) {
      toast.error(`Autostart failed: ${e}`);
    }
  }, [autostart]);

  return (
    <div className="flex flex-1 min-h-0 flex-col items-center justify-center">
      <div className="settings-panel animate-fade-in w-full max-w-md flex flex-col">

        {/* ── Settings ─────────────────────────────────── */}
        <div className="px-5 py-3 flex flex-col gap-2.5">
          {/* Autostart */}
          <div
            className={cn(
              "flex items-center gap-3 px-3.5 py-3 rounded-xl",
              "border transition-all duration-150",
              autostart
                ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                : "border-white/[0.06] bg-white/[0.02]",
            )}
          >
            <div className={cn(
              "flex items-center justify-center w-7 h-7 rounded-lg",
              autostart ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.06] text-white/25",
            )}>
              <Power className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-pixel text-[11px] text-white/80">Launch on startup</div>
              <div className="font-pixel text-[8px] text-white/30 uppercase tracking-wider mt-0.5">
                {autostart ? "enabled — starts minimized" : "disabled"}
              </div>
            </div>
            <button
              type="button"
              className="flex-shrink-0"
              onClick={handleToggleAutostart}
              disabled={loading}
            >
              <div className={cn(
                "w-9 h-5 rounded-full p-[2px] transition-all duration-150",
                loading ? "bg-white/8 cursor-wait"
                  : autostart ? "bg-emerald-400/90 cursor-pointer"
                    : "bg-white/12 cursor-pointer hover:bg-white/18",
              )}>
                <div className={cn(
                  "w-4 h-4 rounded-full transition-all duration-150",
                  autostart ? "translate-x-4 bg-white" : "translate-x-0 bg-white/30",
                )} />
              </div>
            </button>
          </div>

          {/* Minimize to tray */}
          <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.06] text-white/25">
              <Monitor className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-pixel text-[11px] text-white/80">Minimize to tray</div>
              <div className="font-pixel text-[8px] text-white/30 uppercase tracking-wider mt-0.5">
                always on — close hides to system tray
              </div>
            </div>
            <span className="font-pixel text-[8px] text-emerald-400/60 uppercase">on</span>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-5 py-2.5">
          <Info className="w-3 h-3 text-white/15" />
          <span className="font-pixel text-[8px] text-white/20 uppercase tracking-wider">
            Deck-8 Hub v0.1.0 — churrosoft
          </span>
        </div>
      </div>
    </div>
  );
}
