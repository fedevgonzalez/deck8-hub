import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActiveSlot, RgbMatrixState, StateSnapshot } from "@/lib/tauri";
import {
  connectDevice,
  getState,
  setKeyColor,
  onSlotToggled,
  onStateUpdated,
  toggleKeySlot as ipcToggleKeySlot,
  setKeycode as ipcSetKeycode,
  setKeyOverride,
  saveCustom,
  restoreDefaults,
  deviceIndication,
  bootloaderJump,
  eepromReset,
  dynamicKeymapReset,
  macroReset,
  setRgbBrightness,
  setRgbEffect,
  setRgbSpeed,
  setRgbColor,
  saveRgbMatrix,
} from "@/lib/tauri";

const DEFAULT_STATE: StateSnapshot = {
  connected: false,
  keys: Array.from({ length: 8 }, () => ({
    slot_a: { h: 0x55, s: 0xff, v: 0x78 },
    slot_b: { h: 0x00, s: 0xff, v: 0x78 },
    override_enabled: false,
    active_slot: "A" as const,
  })),
  active_slot: "A",
  keymaps: [0, 0, 0, 0, 0, 0, 0, 0],
  device_info: null,
  rgb_matrix: null,
};

export function useDeck8() {
  const [state, setState] = useState<StateSnapshot>(DEFAULT_STATE);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rgbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Refresh helpers ─────────────────────────────────────

  const refreshState = useCallback(async () => {
    try {
      const s = await getState();
      setState(s);
    } catch {
      // Expected to fail outside Tauri
    }
  }, []);

  // ── Actions ─────────────────────────────────────────────

  const connect = useCallback(
    async (silent = false) => {
      try {
        const ok = await connectDevice();
        if (ok) {
          toast.success("Device connected");
        } else if (!silent) {
          toast.error("Device not found");
        }
        await refreshState();
      } catch (e) {
        if (!silent) toast.error(`Connection error: ${e}`);
      }
    },
    [refreshState],
  );

  const updateKeyColor = useCallback(
    (keyIndex: number, slot: ActiveSlot | "both", h: number, s: number, v: number) => {
      console.log(`[color] key=${keyIndex} slot=${slot} h=${h} s=${s} v=${v}`);
      const color = { h, s, v };
      setState((prev) => {
        const keys = prev.keys.map((k, i) => {
          if (i !== keyIndex) return k;
          if (slot === "both") return { ...k, slot_a: color, slot_b: color };
          return slot === "A"
            ? { ...k, slot_a: color, active_slot: "A" as const }
            : { ...k, slot_b: color, active_slot: "B" as const };
        });
        return { ...prev, keys };
      });

      if (colorTimer.current) clearTimeout(colorTimer.current);
      colorTimer.current = setTimeout(async () => {
        try {
          const activeSlot = slot === "both" ? "A" : slot;
          await setKeyColor(keyIndex, activeSlot, h, s, v);
          if (slot === "both") {
            await setKeyColor(keyIndex, "B", h, s, v);
          }
          console.log(`[color] key=${keyIndex} IPC OK`);
        } catch (e) {
          console.error(`[color] key=${keyIndex} IPC FAIL`, e);
        }
      }, 50);
    },
    [],
  );

  const updateKeycode = useCallback(
    async (keyIndex: number, keycode: number) => {
      // Optimistic update
      setState((prev) => {
        const keymaps = [...prev.keymaps];
        keymaps[keyIndex] = keycode;
        return { ...prev, keymaps };
      });
      try {
        await ipcSetKeycode(keyIndex, keycode);
      } catch (e) {
        toast.error(`Set keycode failed: ${e}`);
      }
    },
    [],
  );

  const toggleKeyOverride = useCallback(
    async (keyIndex: number) => {
      const newEnabled = !state.keys[keyIndex].override_enabled;
      console.log(`[override] key=${keyIndex} → ${newEnabled ? "ON" : "OFF"}`);
      // Optimistic toggle
      setState((prev) => {
        const keys = prev.keys.map((k, i) => {
          if (i !== keyIndex) return k;
          return { ...k, override_enabled: newEnabled };
        });
        return { ...prev, keys };
      });
      try {
        await setKeyOverride(keyIndex, newEnabled);
        console.log(`[override] key=${keyIndex} IPC OK`);
      } catch (e) {
        console.error(`[override] key=${keyIndex} IPC FAIL`, e);
        await refreshState();
      }
    },
    [state.keys, refreshState],
  );

  const doToggleKeySlot = useCallback(
    async (keyIndex: number) => {
      setState((prev) => {
        const oldSlot = prev.keys[keyIndex]?.active_slot ?? "A";
        const newSlot = oldSlot === "A" ? "B" : "A";
        console.log(`[slot-toggle] key=${keyIndex} ${oldSlot}→${newSlot}`);
        toast.info(`Key ${keyIndex + 1}: ${oldSlot} → ${newSlot}`);
        return {
          ...prev,
          keys: prev.keys.map((k, i) => {
            if (i !== keyIndex) return k;
            return { ...k, active_slot: newSlot as ActiveSlot };
          }),
        };
      });
      try {
        await ipcToggleKeySlot(keyIndex);
        console.log(`[slot-toggle] key=${keyIndex} IPC OK`);
      } catch (e) {
        console.error(`[slot-toggle] key=${keyIndex} IPC FAIL`, e);
        await refreshState();
      }
    },
    [refreshState],
  );

  const doSaveCustom = useCallback(async () => {
    try {
      await saveCustom();
    } catch {
      // silent — device might be disconnected
    }
  }, []);

  const doRestoreDefaults = useCallback(async () => {
    try {
      const snapshot = await restoreDefaults();
      setState(snapshot);
      toast.success("Defaults restored");
    } catch (e) {
      toast.error(`Restore failed: ${e}`);
    }
  }, []);

  // ── Device info & control actions ──────────────────────

  const doDeviceIndication = useCallback(async () => {
    try {
      await deviceIndication();
    } catch (e) {
      toast.error(`Identify failed: ${e}`);
    }
  }, []);

  const doBootloaderJump = useCallback(async () => {
    try {
      await bootloaderJump();
      setState((prev) => ({ ...prev, connected: false, device_info: null, rgb_matrix: null }));
      toast.success("Entering bootloader — device will disconnect");
    } catch (e) {
      toast.error(`Bootloader jump failed: ${e}`);
    }
  }, []);

  const doEepromReset = useCallback(async () => {
    try {
      await eepromReset();
      toast.success("EEPROM reset — reconnect device");
    } catch (e) {
      toast.error(`EEPROM reset failed: ${e}`);
    }
  }, []);

  const doDynamicKeymapReset = useCallback(async () => {
    try {
      await dynamicKeymapReset();
      await refreshState();
      toast.success("Keymap reset to defaults");
    } catch (e) {
      toast.error(`Keymap reset failed: ${e}`);
    }
  }, [refreshState]);

  const doMacroReset = useCallback(async () => {
    try {
      await macroReset();
      toast.success("Macros reset");
    } catch (e) {
      toast.error(`Macro reset failed: ${e}`);
    }
  }, []);

  // ── RGB Matrix actions ────────────────────────────────

  const updateRgb = useCallback(
    (field: keyof RgbMatrixState, value: number) => {
      setState((prev) => {
        if (!prev.rgb_matrix) return prev;
        return { ...prev, rgb_matrix: { ...prev.rgb_matrix, [field]: value } };
      });

      if (rgbTimer.current) clearTimeout(rgbTimer.current);
      rgbTimer.current = setTimeout(async () => {
        try {
          switch (field) {
            case "brightness":
              await setRgbBrightness(value);
              break;
            case "effect":
              await setRgbEffect(value);
              break;
            case "speed":
              await setRgbSpeed(value);
              break;
          }
        } catch { /* silent */ }
      }, 50);
    },
    [],
  );

  const updateRgbColor = useCallback(
    (h: number, s: number) => {
      setState((prev) => {
        if (!prev.rgb_matrix) return prev;
        return { ...prev, rgb_matrix: { ...prev.rgb_matrix, color_h: h, color_s: s } };
      });

      if (rgbTimer.current) clearTimeout(rgbTimer.current);
      rgbTimer.current = setTimeout(async () => {
        try {
          await setRgbColor(h, s);
        } catch { /* silent */ }
      }, 50);
    },
    [],
  );

  const doSaveRgb = useCallback(async () => {
    try {
      await saveRgbMatrix();
      toast.success("RGB settings saved to EEPROM");
    } catch (e) {
      toast.error(`Save failed: ${e}`);
    }
  }, []);

  // ── Initialization + event listener ─────────────────────

  useEffect(() => {
    // Silent auto-connect — no toast on failure
    connect(true);

    // Global toggle (tray menu "Toggle LEDs")
    const unlistenGlobal = onSlotToggled((newSlot) => {
      console.warn(`[GLOBAL EVENT] slot-toggled: all keys → ${newSlot}`);
      setState((prev) => ({
        ...prev,
        active_slot: newSlot as ActiveSlot,
        keys: prev.keys.map((k) => ({
          ...k,
          active_slot: newSlot as ActiveSlot,
        })),
      }));
    });

    // Per-key toggle (physical key press on Deck-8)
    const unlistenState = onStateUpdated((snapshot) => {
      console.log("[STATE EVENT] state-updated from physical key press");
      setState(snapshot);
    });

    return () => {
      unlistenGlobal.then((fn) => fn());
      unlistenState.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    selectedKey,
    setSelectedKey,
    connect: () => connect(false),
    updateKeyColor,
    updateKeycode,
    toggleKeyOverride,
    toggleKeySlot: doToggleKeySlot,
    saveCustom: doSaveCustom,
    restoreDefaults: doRestoreDefaults,
    deviceIndication: doDeviceIndication,
    bootloaderJump: doBootloaderJump,
    eepromReset: doEepromReset,
    dynamicKeymapReset: doDynamicKeymapReset,
    macroReset: doMacroReset,
    updateRgb,
    updateRgbColor,
    saveRgb: doSaveRgb,
  };
}
