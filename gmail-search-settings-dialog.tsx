import { toast } from "sonner";
import type { SyncSettingsForm } from "@/hooks/use-sync-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PERIOD_OPTIONS = [7, 15, 30, 60, 90];

export function GmailSearchSettingsDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: SyncSettingsForm;
  onFormChange: (form: SyncSettingsForm) => void;
  onSave: () => void;
}) {
  function handleSave() {
    onSave();
    toast.success("Filtros de busca salvos.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Filtros de busca no Gmail</DialogTitle>
          <DialogDescription>
            Controla o que o botão "Sincronizar Gmail" procura. Ficam salvos neste navegador.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Assunto contém</Label>
            <Input
              value={form.subjectTerms}
              onChange={(e) => onFormChange({ ...form, subjectTerms: e.target.value })}
              placeholder="RFQ, cotação, quotation"
            />
            <p className="text-xs text-muted-foreground">
              Palavras separadas por vírgula. Um e-mail entra se o assunto tiver qualquer uma delas.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Vem de (endereços ou domínios de e-mail)</Label>
            <Input
              value={form.fromAddresses}
              onChange={(e) => onFormChange({ ...form, fromAddresses: e.target.value })}
              placeholder="fornecedor@empresa.com, @outraempresa.com.br"
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Se preencher, só entram e-mails vindos desses remetentes.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Corpo do e-mail contém</Label>
            <Input
              value={form.bodyTerms}
              onChange={(e) => onFormChange({ ...form, bodyTerms: e.target.value })}
              placeholder="preço unitário, orçamento"
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Palavras que, se aparecerem em qualquer lugar do e-mail, também contam.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Período</Label>
            <Select
              value={String(form.days)}
              onValueChange={(v) => onFormChange({ ...form, days: Number(v) })}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    Últimos {d} dias
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar filtros</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
