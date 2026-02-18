import { KeyCell } from "@/components/key-cell";
import type { KeyConfig } from "@/lib/tauri";

/**
 * Maps visual grid position to hardware index.
 * Top row: left-to-right = 0,1,2,3
 * Bottom row: left-to-right = 7,6,5,4 (firmware scans right-to-left)
 */
const DISPLAY_ORDER = [0, 1, 2, 3, 7, 6, 5, 4];

interface KeyGridProps {
  keys: KeyConfig[];
  selectedKey: number | null;
  onSelectKey: (index: number) => void;
  onToggleKeySlot?: (index: number) => void;
  mode?: "color" | "keycode";
  keycodeLabels?: string[];
  soundNames?: (string | null)[];
}

export function KeyGrid({
  keys,
  selectedKey,
  onSelectKey,
  onToggleKeySlot,
  mode = "color",
  keycodeLabels,
  soundNames,
}: KeyGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2" style={{ width: "344px" }}>
      {DISPLAY_ORDER.map((hwIndex) => (
        <div key={hwIndex} className="key-stagger">
        <KeyCell
          config={keys[hwIndex]}
          isSelected={selectedKey === hwIndex}
          onClick={() => onSelectKey(hwIndex)}
          onToggleSlot={onToggleKeySlot ? () => onToggleKeySlot(hwIndex) : undefined}
          mode={mode}
          keycodeLabel={keycodeLabels?.[hwIndex]}
          soundName={soundNames?.[hwIndex]}
        />
        </div>
      ))}
    </div>
  );
}
