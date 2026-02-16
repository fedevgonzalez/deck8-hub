import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Power, Monitor, Info, Sparkles, Sun, Gauge, Palette, Save } from "lucide-react";
import { toast } from "sonner";
import { RGB_EFFECTS } from "@/lib/rgb-effects";
import { hsvToRgb } from "@/lib/hsv";
import type { RgbMatrixState } from "@/lib/tauri";

interface SettingsViewProps {
  rgbMatrix: RgbMatrixState | null;
  connected: boolean;
  onRgbChange: (field: keyof RgbMatrixState, value: number) => void;
  onRgbColorChange: (h: number, s: number) => void;
  onRgbSave: () => void;
}

// Tauri autostart bindings — gracefully fail in browser
let autostartApi: {
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  isEnabled: () => Promise<boolean>;
} | null = null;

export function SettingsView({
  rgbMatrix,
  connected,
  onRgbChange,
  onRgbColorChange,
  onRgbSave,
}: SettingsViewProps) {
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

  const currentEffect = rgbMatrix
    ? RGB_EFFECTS.find((e) => e.id === rgbMatrix.effect) ?? { id: rgbMatrix.effect, name: `Effect ${rgbMatrix.effect}` }
    : null;

  const previewColor = rgbMatrix
    ? hsvToRgb(rgbMatrix.color_h, rgbMatrix.color_s, 255)
    : "#333";

  return (
    <div className="flex flex-1 min-h-0 flex-col items-center overflow-y-auto py-4">
      <div className="settings-panel animate-fade-in w-full max-w-md flex flex-col">

        {/* ── RGB Matrix ─────────────────────────────────── */}
        {rgbMatrix && connected && (
          <div className="px-5 py-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-violet-400/70" />
                <span className="font-pixel text-[11px] text-white/70 font-bold uppercase tracking-wider">
                  RGB Matrix
                </span>
              </div>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
                  "font-pixel text-[9px] uppercase tracking-wide font-bold",
                  "text-emerald-400/60 hover:text-emerald-400/90",
                  "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12]",
                  "border border-emerald-500/15 hover:border-emerald-500/30",
                  "transition-all duration-150",
                )}
                onClick={onRgbSave}
              >
                <Save className="w-3 h-3" />
                save to eeprom
              </button>
            </div>

            {/* Effect selector */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-white/20" />
                <span className="font-pixel text-[9px] text-white/40 uppercase tracking-wider">Effect</span>
                <span className="font-pixel text-[9px] text-violet-400/60 ml-auto">{currentEffect?.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 max-h-[140px] overflow-y-auto p-1.5 rounded-lg bg-[#0d0d0f] border border-white/[0.06]">
                {RGB_EFFECTS.map((effect) => (
                  <button
                    key={effect.id}
                    type="button"
                    className={cn(
                      "px-2 py-1.5 rounded-md text-left transition-all",
                      "font-pixel text-[8px] leading-tight truncate",
                      rgbMatrix.effect === effect.id
                        ? "bg-violet-500/20 text-violet-300/90 border border-violet-400/30"
                        : "bg-transparent text-white/30 border border-transparent hover:bg-white/[0.04] hover:text-white/50",
                    )}
                    onClick={() => onRgbChange("effect", effect.id)}
                    title={effect.name}
                  >
                    {effect.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Brightness */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Sun className="w-3 h-3 text-white/20" />
                <span className="font-pixel text-[9px] text-white/40 uppercase tracking-wider">Brightness</span>
                <span className="font-pixel text-[9px] text-white/50 tabular-nums ml-auto">{rgbMatrix.brightness}</span>
              </div>
              <Slider
                min={0}
                max={255}
                step={1}
                value={[rgbMatrix.brightness]}
                onValueChange={([v]) => onRgbChange("brightness", v)}
              />
            </div>

            {/* Speed */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Gauge className="w-3 h-3 text-white/20" />
                <span className="font-pixel text-[9px] text-white/40 uppercase tracking-wider">Speed</span>
                <span className="font-pixel text-[9px] text-white/50 tabular-nums ml-auto">{rgbMatrix.speed}</span>
              </div>
              <Slider
                min={0}
                max={255}
                step={1}
                value={[rgbMatrix.speed]}
                onValueChange={([v]) => onRgbChange("speed", v)}
              />
            </div>

            {/* Color (Hue + Saturation) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Palette className="w-3 h-3 text-white/20" />
                <span className="font-pixel text-[9px] text-white/40 uppercase tracking-wider">Color</span>
                <span
                  className="w-4 h-4 rounded-md border border-white/20 ml-auto"
                  style={{ backgroundColor: previewColor }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-pixel text-[8px] text-white/25 w-4">H</span>
                  <div className="flex-1 slider-hue">
                    <Slider
                      min={0}
                      max={255}
                      step={1}
                      value={[rgbMatrix.color_h]}
                      onValueChange={([h]) => onRgbColorChange(h, rgbMatrix.color_s)}
                    />
                  </div>
                  <span className="font-pixel text-[8px] text-white/40 tabular-nums w-6 text-right">{rgbMatrix.color_h}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-pixel text-[8px] text-white/25 w-4">S</span>
                  <div className="flex-1">
                    <Slider
                      min={0}
                      max={255}
                      step={1}
                      value={[rgbMatrix.color_s]}
                      onValueChange={([s]) => onRgbColorChange(rgbMatrix.color_h, s)}
                    />
                  </div>
                  <span className="font-pixel text-[8px] text-white/40 tabular-nums w-6 text-right">{rgbMatrix.color_s}</span>
                </div>
              </div>
            </div>

            <div className="border-b border-white/[0.06]" />
          </div>
        )}

        {/* ── App Settings ─────────────────────────────────── */}
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
