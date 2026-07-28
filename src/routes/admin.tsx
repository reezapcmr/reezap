import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, TopBar } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { timeAgo, resolveMedia } from "@/lib/reezap";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin review — Reezap" },
      { name: "description", content: "Review verification requests and reported listings." },
      { property: "og:title", content: "Admin review — Reezap" },
      { property: "og:description", content: "Internal moderation tools for the Reezap team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function IdDocument({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void resolveMedia(path, "id-documents").then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [path]);
  if (!url)
    return (
      <div className="mt-3 flex h-40 items-center justify-center rounded-lg border border-border text-xs text-muted-foreground">
        Loading ID document…
      </div>
    );
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 block">
      <img
        src={url}
        alt="Submitted identity document"
        className="max-h-64 w-full rounded-lg border border-border object-contain"
      />
    </a>
  );
}

function AdminPage() {
  const { isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) void navigate({ to: "/" });
  }, [loading, user, isAdmin, navigate]);

  const { data: requests } = useQuery({
    queryKey: ["admin-verifications"],
    enabled: isAdmin,
    queryFn: async () =>
      (
        await supabase
          .from("verification_requests")
          .select("id,user_id,full_name,status,created_at,document_path,profiles(username,display_name)")
          .eq("status", "pending")
          .order("created_at")
      ).data ?? [],
  });

  const { data: reports } = useQuery({
    queryKey: ["admin-reports"],
    enabled: isAdmin,
    queryFn: async () =>
      (
        await supabase
          .from("reports")
          .select("id,target_type,target_id,reason,details,resolved,created_at")
          .eq("resolved", false)
          .order("created_at")
      ).data ?? [],
  });

  async function decide(id: string, userId: string, approve: boolean) {
    await supabase
      .from("verification_requests")
      .update({ status: approve ? "approved" : "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (approve) await supabase.from("profiles").update({ is_verified: true }).eq("id", userId);
    toast.success(approve ? "Vendor verified" : "Request rejected");
    void qc.invalidateQueries({ queryKey: ["admin-verifications"] });
  }

  async function resolve(id: string) {
    await supabase.from("reports").update({ resolved: true }).eq("id", id);
    toast.success("Report resolved");
    void qc.invalidateQueries({ queryKey: ["admin-reports"] });
  }

  if (!isAdmin) return null;

  return (
    <AppShell>
      <TopBar title="Admin" />
      <Tabs defaultValue="verify" className="p-4">
        <TabsList className="grid w-full grid-cols-2 rounded-full bg-secondary">
          <TabsTrigger value="verify" className="rounded-full">
            Verifications
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-full">
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="verify" className="space-y-3 pt-4">
          {!requests?.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No pending verification requests.
            </p>
          )}
          {requests?.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="font-semibold">{r.full_name}</p>
              <p className="text-xs text-muted-foreground">
                @{(r.profiles as { username: string } | null)?.username} ·{" "}
                {timeAgo(r.created_at)}
              </p>
              <IdDocument path={r.document_path} />
              <div className="mt-3 flex gap-2">
                <Button
                  onClick={() => decide(r.id, r.user_id, true)}
                  className="flex-1 rounded-full font-bold"
                >
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => decide(r.id, r.user_id, false)}
                  className="flex-1 rounded-full font-bold"
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="reports" className="space-y-3 pt-4">
          {!reports?.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">No open reports.</p>
          )}
          {reports?.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="font-semibold capitalize">
                {r.reason} · {r.target_type}
              </p>
              {r.details && <p className="mt-1 text-sm text-muted-foreground">{r.details}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{timeAgo(r.created_at)}</p>
              <Button
                variant="secondary"
                onClick={() => resolve(r.id)}
                className="mt-3 rounded-full font-bold"
              >
                Mark resolved
              </Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
