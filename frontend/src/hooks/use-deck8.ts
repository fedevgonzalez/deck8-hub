import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActiveSlot, StateSnapshot } from "@/lib/tauri";
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
  restoreDefaults,
} from "@/lib/tauri";

const DEFAULT_STATE: StateSnapshot = {
  connected: false,
  keys: Array.from({ length: 8 }, () => ({
    slot_a: { h: 0x55, s: 0xff, v: 0x78 },
    slot_b: { h: 0x00, s: 0xff, v: 0x78 },
    override_enabled: true,
  })),
  active_slot: "A",
  current_profile_name: null,
  keymaps: [0, 0, 0, 0, 0, 0, 0, 0],
};

export function useDeck8() {
  const [state, setState] = useState<StateSnapshot>(DEFAULT_STATE);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [editSlot, setEditSlot] = useState<ActiveSlot>("A");
  const [profiles, setProfiles] = useState<string[]>([]);
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    (keyIndex: number, slot: ActiveSlot, h: number, s: number, v: number) => {
      setState((prev) => {
        const keys = prev.keys.map((k, i) => {
          if (i !== keyIndex) return k;
          return slot === "A"
            ? { ...k, slot_a: { h, s, v } }
            : { ...k, slot_b: { h, s, v } };
        });
        return { ...prev, keys };
      });

      if (colorTimer.current) clearTimeout(colorTimer.current);
      colorTimer.current = setTimeout(async () => {
        try {
          await setKeyColor(keyIndex, slot, h, s, v);
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
      // Optimistic toggle
      setState((prev) => {
        const keys = prev.keys.map((k, i) => {
          if (i !== keyIndex) return k;
          return { ...k, override_enabled: !k.override_enabled };
        });
        return { ...prev, keys };
      });
      try {
        const snapshot = await setKeyOverride(
          keyIndex,
          // We already toggled optimistically, so the new state is correct
          // But we read from the pre-toggle state for the IPC call:
          // Actually, we need the NEW value. Let's use the state that was set.
          !state.keys[keyIndex].override_enabled,
        );
        setState(snapshot);
      } catch {
        // Revert on failure
        await refreshState();
      }
    },
    [state.keys, refreshState],
  );

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
    restoreDefaults: doRestoreDefaults,
    loadProfile: doLoadProfile,
    saveProfile: doSaveProfile,
    deleteProfile: doDeleteProfile,
  };
}
