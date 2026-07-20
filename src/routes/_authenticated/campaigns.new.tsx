import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listClientsFn } from "@/lib/clients.functions";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCampaign } from "@/lib/campaigns-store";
import { toast } from "sonner";
import { ArrowLeft, Info, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Control } from "react-hook-form";
import type { UseFormSetValue } from "react-hook-form";

const schema = z.object({
  clientName: z.string().trim().min(1, "Informe o cliente").max(100),
  clientId: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  campaignName: z.string().trim().min(1, "Informe o nome da campanha").max(120),
  videoUrl: z
    .string()
    .trim()
    .min(1, "Informe o link do vídeo")
    .url("URL inválida")
    .max(500),
  startDate: z.string().min(1, "Informe a data inicial"),
  endDate: z.string().min(1, "Informe a data final"),
  dailyBudget: z.coerce.number().min(0, "Valor inválido"),
  budget: z.coerce.number().min(0, "Valor inválido").optional(),
  days: z.coerce.number().int().min(1, "Mínimo 1 dia"),
  objective: z.enum(["views", "engagement", "traffic", "conversion", "sales", "awareness"]),
  avgProductValue: z.coerce.number().min(0).optional(),
  avgUpsellValue: z.coerce.number().min(0).optional(),
  avgCrossSellValue: z.coerce.number().min(0).optional(),

  // Resultados informados manualmente
  views: z.coerce.number().min(0).optional(),
  likes: z.coerce.number().min(0).optional(),
  comments: z.coerce.number().min(0).optional(),
  shares: z.coerce.number().min(0).optional(),
  saves: z.coerce.number().min(0).optional(),
  linkClicks: z.coerce.number().min(0).optional(),
  purchases: z.coerce.number().min(0).optional(),
  upsells: z.coerce.number().min(0).optional(),
  crossSells: z.coerce.number().min(0).optional(),
  revenue: z.coerce.number().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/_authenticated/campaigns/new")({
  component: NewCampaign,
});

function NewCampaign() {
  const navigate = useNavigate();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientName: "",
      campaignName: "",
      videoUrl: "",
      startDate: "",
      endDate: "",
      dailyBudget: 0,
      days: 1,
      objective: "views",
    },
  });

  const start = form.watch("startDate");
  const end = form.watch("endDate");
  useEffect(() => {
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      const diff = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
      if (!Number.isNaN(diff)) form.setValue("days", diff, { shouldValidate: false });
    }
  }, [start, end, form]);

  const onSubmit = async (v: FormValues) => {
    try {
    const created = await createCampaign(
      {
        clientName: v.clientName,
        clientId: v.clientId ?? null,
        campaignName: v.campaignName,
        videoUrl: v.videoUrl,
        startDate: v.startDate,
        endDate: v.endDate,
        dailyBudget: v.dailyBudget,
        budget: v.budget ?? 0,
        days: v.days,
        objective: v.objective,
        avgProductValue: v.avgProductValue,
        avgUpsellValue: v.avgUpsellValue,
        avgCrossSellValue: v.avgCrossSellValue,
      },
      {
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: v.shares,
        saves: v.saves,
        linkClicks: v.linkClicks,
        purchases: v.purchases,
        upsells: v.upsells,
        crossSells: v.crossSells,
        revenue: v.revenue,
      },
    );
    toast.success("Campanha criada");
    navigate({ to: "/campaigns/$id", params: { id: created.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar campanha");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-10">
      <Link
        to="/campaigns"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para campanhas
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Nova campanha
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Preencha os dados da campanha e os resultados reais obtidos. Apenas as
        impressões são projetadas automaticamente a partir das views.
      </p>

      <div className="mt-6 flex items-start gap-2 rounded-lg border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Impressões são estimadas em <strong className="text-foreground">views ÷ 10%</strong> (taxa ajustável em{" "}
          <Link to="/settings" className="text-primary hover:underline">
            configurações
          </Link>
          ). Todos os demais indicadores usam os valores informados abaixo.
        </span>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
          <section className="surface-card p-6">
            <SectionTitle>Configuração da campanha</SectionTitle>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ClientPicker control={form.control} setValue={form.setValue} />
              <FormField
                control={form.control}
                name="campaignName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da campanha</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Lançamento verão" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Link do vídeo no Instagram</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.instagram.com/reel/..." {...field} />
                    </FormControl>
                    <FormDescription>Cole a URL do reel, post ou vídeo publicado.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data inicial</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data final</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dailyBudget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Investimento diário (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormDescription>Usado pelo motor de estimativas.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget total (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...field}
                        value={(field.value as number | undefined) ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Verba oficial descontada da carteira ao financiar.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade de dias</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="objective"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Objetivo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="views">Views</SelectItem>
                        <SelectItem value="engagement">Engajamento</SelectItem>
                        <SelectItem value="traffic">Tráfego</SelectItem>
                        <SelectItem value="conversion">Conversão</SelectItem>
                        <SelectItem value="sales">Vendas</SelectItem>
                        <SelectItem value="awareness">Reconhecimento</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="surface-card p-6">
            <SectionTitle>Resultados obtidos</SectionTitle>
            <p className="-mt-1 mb-4 text-xs text-muted-foreground">
              Informe os números reais da campanha — todos opcionais, exceto views (necessária para projetar impressões).
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <NumberField control={form.control} name="views" label="Views" />
              <NumberField control={form.control} name="likes" label="Curtidas" />
              <NumberField control={form.control} name="comments" label="Comentários" />
              <NumberField control={form.control} name="shares" label="Compartilhamentos" />
              <NumberField control={form.control} name="saves" label="Salvamentos" />
              <NumberField control={form.control} name="linkClicks" label="Cliques no link" />
              <NumberField control={form.control} name="purchases" label="Compras" />
              <NumberField control={form.control} name="upsells" label="Upsells" />
              <NumberField control={form.control} name="crossSells" label="Cross sells" />
            </div>
          </section>

          <section className="surface-card p-6">
            <SectionTitle>Receita</SectionTitle>
            <p className="-mt-1 mb-4 text-xs text-muted-foreground">
              Informe os tickets médios OU a receita total direta. Se ambos forem preenchidos, a receita total prevalece.
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <NumberField control={form.control} name="avgProductValue" label="Ticket produto (R$)" step="0.01" />
              <NumberField control={form.control} name="avgUpsellValue" label="Ticket upsell (R$)" step="0.01" />
              <NumberField control={form.control} name="avgCrossSellValue" label="Ticket cross sell (R$)" step="0.01" />
              <NumberField
                control={form.control}
                name="revenue"
                label="Receita total (R$)"
                step="0.01"
                className="col-span-2 md:col-span-3"
              />
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button asChild variant="ghost">
              <Link to="/campaigns">Cancelar</Link>
            </Button>
            <Button type="submit" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Gerar relatório
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="h-6 w-1 rounded-full bg-[image:var(--gradient-primary)]" />
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </h2>
    </div>
  );
}

function NumberField({
  control,
  name,
  label,
  step,
  className,
}: {
  control: Control<FormValues>;
  name: keyof FormValues;
  label: string;
  step?: string;
  className?: string;
}) {
  return (
    <FormField
      control={control}
      name={name as never}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="text-xs text-muted-foreground">{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              min="0"
              step={step ?? "1"}
              placeholder="0"
              value={(field.value as number | undefined) ?? ""}
              onChange={(e) =>
                field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ClientPicker({
  control,
  setValue,
}: {
  control: Control<FormValues>;
  setValue: UseFormSetValue<FormValues>;
}) {
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => listClientsFn(),
    initialData: [],
  });
  return (
    <FormField
      control={control}
      name="clientId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Cliente</FormLabel>
          <Select
            value={(field.value as string | undefined) ?? ""}
            onValueChange={(v) => {
              field.onChange(v);
              const c = clients.find((x) => x.id === v);
              if (c) setValue("clientName", c.name, { shouldValidate: true });
            }}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {clients.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  Nenhum cliente cadastrado. Crie um em /clients.
                </div>
              ) : (
                clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.company ? ` · ${c.company}` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
