import { useEffect, useState } from "react";

export type SyncSettingsForm = {
  subjectTerms: string;
  bodyTerms: string;
  fromAddresses: string;
  excludeSubjectTerms: string;
  days: number;
};

const STORAGE_KEY = "sheet-sync:gmail-search-settings";

export const DEFAULT_SYNC_SETTINGS: SyncSettingsForm = {
  subjectTerms: "RFQ, cotação, cotacao, quotation, quote",
  bodyTerms: "",
  fromAddresses: "",
  // Quando uma RFQ vira um pedido fechado, o assunto ganha uma tag "PO ####"
  // (ex.: "TSP PO 001.735 - HCI SC - RFQ 518723 - ..."). Isso não é mais uma
  // cotação em aberto, então fica de fora por padrão.
  excludeSubjectTerms: "PO",
  days: 30,
};

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Guarda os filtros de busca do Gmail no localStorage, para persistirem entre
 * visitas. É uma preferência por navegador (não compartilhada entre
 * dispositivos/usuários), o que serve bem para uma ferramenta interna de uma
 * pessoa só, e evita precisar de uma tabela nova no banco.
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
      // Ignora storage corrompido/bloqueado — usa os padrões.
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
    excludeSubjectTerms: splitList(form.excludeSubjectTerms),
    days: form.days,
  };

  return { form, setForm, save, loaded, parsed };
}
