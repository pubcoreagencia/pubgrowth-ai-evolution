import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  DEFAULT_SETTINGS,
  getEstimationSettings,
  resetEstimationSettings,
  saveEstimationSettings,
  type EstimationSettings,
} from "@/lib/estimation-settings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Info, RotateCcw, Save } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

interface FieldMeta {
  key: keyof EstimationSettings;
  label: string;
  help: string;
  group: "core" | "funnel";
}

const fields: FieldMeta[] = [
  { key: "viewsShareOfImpressions", label: "Views ÷ Impressões", help: "Views representam quantos % das impressões (padrão 10%).", group: "core" },
  { key: "remarketingReachRate", label: "Reimpacto remarketing", help: "% das views que recebem o vídeo novamente.", group: "funnel" },
  { key: "ctaViewRate", label: "Visualização de CTA", help: "% das views que veem o CTA reforçado.", group: "funnel" },
  { key: "offerViewRate", label: "Visualização da oferta", help: "% dos cliques que visualizam a oferta.", group: "funnel" },
  { key: "checkoutInitiationRate", label: "Início de checkout", help: "% dos cliques que iniciam o checkout.", group: "funnel" },
  { key: "recurringCustomerRate", label: "Clientes recorrentes", help: "% dos compradores que viram recorrentes.", group: "funnel" },
];

function SettingsPage() {
  const [values, setValues] = useState<EstimationSettings>(() => getEstimationSettings());

  const handleSave = () => {
    saveEstimationSettings(values);
    toast.success("Configurações salvas");
  };

  const handleReset = () => {
    resetEstimationSettings();
    setValues(DEFAULT_SETTINGS);
    toast.success("Valores restaurados");
  };

  const groups: Array<{ id: FieldMeta["group"]; title: string; desc: string }> = [
    {
      id: "core",
      title: "Cálculo de impressões",
      desc: "Único indicador projetado automaticamente pela plataforma.",
    },
    {
      id: "funnel",
      title: "Etapas intermediárias do funil",
      desc: "Taxas usadas apenas para desenhar as etapas do funil que não são informadas manualmente (remarketing, CTA, visualização de oferta, checkout, recorrência).",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Configurações do motor
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ajuste as taxas usadas pelo sistema. Apenas as impressões são simuladas —
        as demais métricas vêm dos valores reais informados em cada campanha.
      </p>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Todos os valores são expressos em <strong className="text-foreground">porcentagem</strong>. Ex: digite <code className="rounded bg-muted px-1">10</code> para 10%.
        </span>
      </div>

      <div className="mt-6 space-y-6">
        {groups.map((g) => (
          <section key={g.id} className="surface-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-6 w-1 rounded-full bg-[image:var(--gradient-primary)]" />
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.title}
                </h2>
                <p className="text-xs text-muted-foreground/80">{g.desc}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {fields
                .filter((f) => f.group === g.id)
                .map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={f.key} className="text-sm">
                      {f.label}
                    </Label>
                    <div className="relative">
                      <Input
                        id={f.key}
                        type="number"
                        step="0.1"
                        min="0"
                        value={(values[f.key] * 100).toFixed(2)}
                        onChange={(e) => {
                          const n = Number(e.target.value) / 100;
                          setValues((v) => ({ ...v, [f.key]: Number.isFinite(n) ? n : 0 }));
                        }}
                        className="pr-8"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{f.help}</p>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Restaurar padrões
        </Button>
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
