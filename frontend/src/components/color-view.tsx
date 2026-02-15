import { KeyGrid } from "@/components/key-grid";
import { ColorPicker } from "@/components/color-picker";
import type { ActiveSlot, KeyConfig } from "@/lib/tauri";

interface ColorViewProps {
  keys: KeyConfig[];
  editSlot: ActiveSlot;
  selectedKey: number | null;
  onSelectKey: (index: number) => void;
  onColorChange: (keyIndex: number, slot: ActiveSlot, h: number, s: number, v: number) => void;
  onToggleOverride: (keyIndex: number) => void;
}

export function ColorView({
  keys,
  editSlot,
  selectedKey,
  onSelectKey,
  onColorChange,
  onToggleOverride,
}: ColorViewProps) {
  const selectedConfig = selectedKey !== null ? keys[selectedKey] : undefined;
  const selectedColor =
    selectedConfig &&
    (editSlot === "A" ? selectedConfig.slot_a : selectedConfig.slot_b);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left — Key Grid */}
      <div className="flex items-center justify-center p-6">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <KeyGrid
            keys={keys}
            editSlot={editSlot}
            selectedKey={selectedKey}
            onSelectKey={(i) => onSelectKey(selectedKey === i ? -1 : i)}
            mode="color"
          />
        </div>
      </div>

      {/* Right — Color Picker */}
      <div className="flex-1 border-l border-white/[0.04] p-6 flex flex-col justify-center">
        {selectedKey !== null && selectedConfig ? (
          selectedConfig.override_enabled ? (
            <div className="space-y-4 animate-fade-in">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                <ColorPicker
                  keyIndex={selectedKey}
                  slot={editSlot}
                  color={selectedColor!}
                  onChange={(h, s, v) => onColorChange(selectedKey, editSlot, h, s, v)}
                />
              </div>
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-foreground hover:underline transition-colors"
                onClick={() => onToggleOverride(selectedKey)}
              >
                Disable override
              </button>
            </div>
          ) : (
            <div className="text-center space-y-3 animate-fade-in">
              <div className="text-[11px] text-muted-foreground/80 font-medium">
                Override disabled — showing device animation
              </div>
              <button
                type="button"
                className="text-[11px] text-foreground/60 hover:text-foreground border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition-smooth"
                onClick={() => onToggleOverride(selectedKey)}
              >
                Enable override
              </button>
            </div>
          )
        ) : (
          <div className="text-center text-[11px] text-muted-foreground/50">
            select a key
          </div>
        )}
      </div>
    </div>
  );
}
