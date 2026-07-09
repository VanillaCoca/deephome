"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WebListing } from "@/src/web/searchService";

// 收藏：登录后落库（RLS 保证只能读写自己的行）；匿名用户仅存内存。
// 乐观更新 —— 点击立刻生效，写库在后台进行。
export function useFavorites() {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    async function load(uid: string | null) {
      if (!uid) {
        if (mounted) setFavorites(new Set()); // 退出登录 → 清空
        return;
      }
      const { data } = await supabase!.from("favorites").select("mls_number").eq("user_id", uid);
      if (mounted) setFavorites(new Set((data ?? []).map((r: any) => r.mls_number as string)));
    }

    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      if (!mounted) return;
      setUserId(uid);
      load(uid);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      load(uid);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const toggle = useCallback(
    async (listing: WebListing) => {
      const mls = listing.mlsNumber;
      const wasFav = favorites.has(mls);

      // 乐观更新
      setFavorites((s) => {
        const next = new Set(s);
        wasFav ? next.delete(mls) : next.add(mls);
        return next;
      });

      if (!supabase || !userId) return; // 匿名：仅内存

      const { error } = wasFav
        ? await supabase.from("favorites").delete().eq("user_id", userId).eq("mls_number", mls)
        : await supabase.from("favorites").insert({ user_id: userId, mls_number: mls, listing });

      if (error) {
        // 写库失败 → 回滚乐观更新
        setFavorites((s) => {
          const next = new Set(s);
          wasFav ? next.add(mls) : next.delete(mls);
          return next;
        });
      }
    },
    [favorites, supabase, userId]
  );

  return { favorites, toggle, signedIn: Boolean(userId) };
}
