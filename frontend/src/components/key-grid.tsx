import { KeyCell } from "@/components/key-cell";
import type { ActiveSlot, KeyConfig } from "@/lib/tauri";

interface KeyGridProps {
  keys: KeyConfig[];
  editSlot: ActiveSlot;
  selectedKey: number | null;
  onSelectKey: (index: number) => void;
  mode?: "color" | "keycode";
  keycodeLabels?: string[];
}

export function KeyGrid({
  keys,
  editSlot,
  selectedKey,
  onSelectKey,
  mode = "color",
  keycodeLabels,
}: KeyGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2" style={{ width: "344px" }}>
      {keys.map((config, i) => (
        <KeyCell
          key={i}
          index={i}
          config={config}
          editSlot={editSlot}
          isSelected={selectedKey === i}
          onClick={() => onSelectKey(i)}
          mode={mode}
          keycodeLabel={keycodeLabels?.[i]}
        />
      ))}
    </div>
  );
}
