import { useEffect, useState } from "react";

export type SyncSettingsForm = {
  subjectTerms: string;
  bodyTerms: string;
  fromAddresses: string;
  days: number;
};

const STORAGE_KEY = "sheet-sync:gmail-search-settings";

export const DEFAULT_SYNC_SETTINGS: SyncSettingsForm = {
  subjectTerms: "RFQ, cotação, cotacao, quotation, quote",
  bodyTerms: "",
  fromAddresses: "",
  days: 30,
};

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Persists the Gmail search filters in localStorage so they survive between
 * visits. This is a per-browser preference (not shared across devices/users),
 * which is fine for a single-person internal tool and avoids needing a new
 * database table.
 */
export function useSyncSettings() {
  const [form, setForm] = useState<SyncSettingsForm>(DEFAULT_SYNC_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setForm({
          ...DEFAULT_SYNC_SETTINGS,
          ...(JSON.parse(raw) as Partial<SyncSettingsForm>),
        });
      }
    } catch {
      // Ignore corrupt/blocked storage — fall back to defaults.
    } finally {
      setLoaded(true);
    }
  }, []);

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      return true;
    } catch {
      return false;
    }
  }

  const parsed = {
    subjectTerms: splitList(form.subjectTerms),
    bodyTerms: splitList(form.bodyTerms),
    fromAddresses: splitList(form.fromAddresses),
    days: form.days,
  };

  return { form, setForm, save, loaded, parsed };
}
