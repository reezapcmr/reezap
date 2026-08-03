import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type ViewerActivity = { likes: Set<string>; bookmarks: Set<string> };

const EMPTY: ViewerActivity = { likes: new Set(), bookmarks: new Set() };

/**
 * One cached round trip for the whole session instead of two queries per
 * listing card (a 30-item feed used to fire 60 requests before paint).
 */
export function useViewerActivity() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["viewer-activity", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [{ data: likes }, { data: bookmarks }] = await Promise.all([
        supabase.from("likes").select("listing_id").eq("user_id", user!.id),
        supabase.from("bookmarks").select("listing_id").eq("user_id", user!.id),
      ]);
      return {
        likes: new Set((likes ?? []).map((r) => r.listing_id)),
        bookmarks: new Set((bookmarks ?? []).map((r) => r.listing_id)),
      } satisfies ViewerActivity;
    },
  });

  return data ?? EMPTY;
}

/** Optimistic like/bookmark toggle that keeps the shared cache in sync. */
export function useToggleActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      kind,
      listingId,
      on,
    }: {
      kind: "likes" | "bookmarks";
      listingId: string;
      on: boolean;
    }) => {
      if (!user) throw new Error("not-signed-in");
      const { error } = on
        ? await supabase.from(kind).delete().eq("listing_id", listingId).eq("user_id", user.id)
        : await supabase.from(kind).insert({ listing_id: listingId, user_id: user.id });
      if (error) throw error;
    },
    onMutate: ({ kind, listingId, on }) => {
      const key = ["viewer-activity", user?.id];
      const prev = qc.getQueryData<ViewerActivity>(key);
      if (prev) {
        const next: ViewerActivity = {
          likes: new Set(prev.likes),
          bookmarks: new Set(prev.bookmarks),
        };
        if (on) next[kind].delete(listingId);
        else next[kind].add(listingId);
        qc.setQueryData(key, next);
      }
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (_d, { kind }) => {
      if (kind === "bookmarks") void qc.invalidateQueries({ queryKey: ["saved"] });
    },
  });
}
