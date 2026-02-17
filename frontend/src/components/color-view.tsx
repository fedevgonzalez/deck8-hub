import { useState } from "react";
import { KeyGrid } from "@/components/key-grid";
import { ColorEditorDialog } from "@/components/color-editor-dialog";
import type { ActiveSlot, KeyConfig } from "@/lib/tauri";

interface ColorViewProps {
  keys: KeyConfig[];
  selectedKey: number | null;
  onSelectKey: (index: number) => void;
  onColorChange: (keyIndex: number, slot: ActiveSlot | "both", h: number, s: number, v: number) => void;
  onToggleOverride: (keyIndex: number) => void;
  onToggleKeySlot: (keyIndex: number) => void;
  onSaveCustom: () => void;
}

export function ColorView({
  keys,
  selectedKey,
  onSelectKey,
  onColorChange,
  onToggleOverride,
  onToggleKeySlot,
  onSaveCustom,
}: ColorViewProps) {
  const [editorOpen, setEditorOpen] = useState(false);

  const handleSelectKey = (i: number) => {
    onSelectKey(i);
    setEditorOpen(true);
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col items-center justify-center">
      <div className="color-panel relative animate-fade-in">
        {/* Key grid — PCB trace background */}
        <div className="relative z-[1] px-5 py-5 pcb-grid">
          <div className="relative flex justify-center">
            <KeyGrid
              keys={keys}
              selectedKey={selectedKey}
              onSelectKey={handleSelectKey}
              onToggleKeySlot={onToggleKeySlot}
              mode="color"
            />
          </div>
        </div>
        {/* Hint */}
        <div className="relative z-[1] px-5 pb-3 text-center">
          <span className="font-pixel text-[8px] text-white/15 uppercase tracking-wider">
            click a key to edit its color
          </span>
        </div>
      </div>

      {/* Color editor dialog */}
      {selectedKey !== null && keys[selectedKey] && (
        <ColorEditorDialog
          open={editorOpen}
          keyIndex={selectedKey}
          config={keys[selectedKey]}
          onColorChange={onColorChange}
          onToggleOverride={onToggleOverride}
          onSaveCustom={onSaveCustom}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}
