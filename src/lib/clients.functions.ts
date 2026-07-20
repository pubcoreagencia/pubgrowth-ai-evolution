import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface Client {
  id: string;
  name: string;
  company: string | null;
  segment: string | null;
  notes: string | null;
  createdAt: string;
}

type Row = {
  id: string;
  name: string;
  company: string | null;
  segment: string | null;
  notes: string | null;
  created_at: string;
};

const toClient = (r: Row): Client => ({
  id: r.id,
  name: r.name,
  company: r.company,
  segment: r.segment,
  notes: r.notes,
  createdAt: r.created_at,
});

export const listClientsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Row[]).map(toClient);
  });

const clientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  company: z.string().trim().max(160).optional().nullable(),
  segment: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const createClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof clientSchema>) => clientSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("clients")
      .insert({
        user_id: context.userId,
        name: data.name,
        company: data.company ?? null,
        segment: data.segment ?? null,
        notes: data.notes ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toClient(row as Row);
  });

export const deleteClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });