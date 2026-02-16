import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActiveSlot, RgbMatrixState, StateSnapshot } from "@/lib/tauri";
import {
  connectDevice,
  getState,
  setKeyColor,
  toggleSlot,
  listProfiles,
  saveProfile,
  loadProfile,
  deleteProfile,
  onSlotToggled,
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
  })),
  active_slot: "A",
  current_profile_name: null,
  keymaps: [0, 0, 0, 0, 0, 0, 0, 0],
  device_info: null,
  rgb_matrix: null,
};

export function useDeck8() {
  const [state, setState] = useState<StateSnapshot>(DEFAULT_STATE);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [editSlot, setEditSlot] = useState<ActiveSlot>("A");
  const [profiles, setProfiles] = useState<string[]>([]);
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

  const refreshProfiles = useCallback(async () => {
    try {
      const list = await listProfiles();
      setProfiles(list);
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

  const toggle = useCallback(async () => {
    try {
      const newSlot = await toggleSlot();
      setState((prev) => ({
        ...prev,
        active_slot: newSlot as ActiveSlot,
      }));
    } catch (e) {
      toast.error(`Toggle failed: ${e}`);
    }
  }, []);

  const updateKeyColor = useCallback(
    (keyIndex: number, slot: ActiveSlot | "both", h: number, s: number, v: number) => {
      const color = { h, s, v };
      setState((prev) => {
        const keys = prev.keys.map((k, i) => {
          if (i !== keyIndex) return k;
          if (slot === "both") return { ...k, slot_a: color, slot_b: color };
          return slot === "A"
            ? { ...k, slot_a: color }
            : { ...k, slot_b: color };
        });
        return { ...prev, keys };
      });

      if (colorTimer.current) clearTimeout(colorTimer.current);
      colorTimer.current = setTimeout(async () => {
        try {
          // Send to active slot (or both)
          const activeSlot = slot === "both" ? "A" : slot;
          await setKeyColor(keyIndex, activeSlot, h, s, v);
          if (slot === "both") {
            await setKeyColor(keyIndex, "B", h, s, v);
          }
        } catch {
          // silent — device might be disconnected
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
      } catch {
        // Revert on failure
        await refreshState();
      }
    },
    [state.keys, refreshState],
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

  const doLoadProfile = useCallback(
    async (name: string) => {
      try {
        const snapshot = await loadProfile(name);
        setState(snapshot);
        await refreshProfiles();
        toast.success(`Loaded "${name}"`);
      } catch (e) {
        toast.error(`Load failed: ${e}`);
      }
    },
    [refreshProfiles],
  );

  const doSaveProfile = useCallback(
    async (name: string) => {
      try {
        await saveProfile(name);
        setState((prev) => ({ ...prev, current_profile_name: name }));
        await refreshProfiles();
        toast.success(`Saved "${name}"`);
      } catch (e) {
        toast.error(`Save failed: ${e}`);
      }
    },
    [refreshProfiles],
  );

  const doDeleteProfile = useCallback(
    async (name: string) => {
      try {
        await deleteProfile(name);
        setState((prev) => ({
          ...prev,
          current_profile_name:
            prev.current_profile_name === name
              ? null
              : prev.current_profile_name,
        }));
        await refreshProfiles();
        toast.success(`Deleted "${name}"`);
      } catch (e) {
        toast.error(`Delete failed: ${e}`);
      }
    },
    [refreshProfiles],
  );

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
    refreshProfiles();

    const unlisten = onSlotToggled((newSlot) => {
      setState((prev) => ({
        ...prev,
        active_slot: newSlot as ActiveSlot,
      }));
    });

    return () => {
      unlisten.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setEditSlot(state.active_slot);
  }, [state.active_slot]);

  return {
    state,
    selectedKey,
    setSelectedKey,
    editSlot,
    setEditSlot,
    profiles,
    connect: () => connect(false),
    toggle,
    updateKeyColor,
    updateKeycode,
    toggleKeyOverride,
    saveCustom: doSaveCustom,
    restoreDefaults: doRestoreDefaults,
    loadProfile: doLoadProfile,
    saveProfile: doSaveProfile,
    deleteProfile: doDeleteProfile,
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
