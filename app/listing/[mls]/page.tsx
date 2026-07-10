"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { WebListing } from "@/src/web/searchService";
import { ListingDetail } from "@/components/ListingDetail";

// 深链页：可分享、可新标签打开。展示的是"这套房本身"。
// 注意：主搜索体验里详情【不】用这个页（那是同舞台分层），这里是独立可分享入口。
// Next 14 + React 18：params 是普通对象（不是 Promise），直接取即可。
export default function ListingPage({ params }: { params: { mls: string } }) {
  const mls = params.mls;
  const [listing, setListing] = useState<WebListing | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "notfound">("loading");

  useEffect(() => {
    fetch(`/api/listing/${encodeURIComponent(mls)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setListing(d as WebListing);
        setState("ok");
      })
      .catch(() => setState("notfound"));
  }, [mls]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-neutral-900">
          Deephome
        </Link>
        <Link href="/" className="text-sm text-neutral-500 transition hover:text-neutral-800">
          去搜索 →
        </Link>
      </header>

      {state === "loading" && (
        <div className="animate-pulse">
          <div className="aspect-[16/9] w-full rounded-2xl bg-neutral-100" />
          <div className="mt-6 h-7 w-1/3 rounded bg-neutral-100" />
        </div>
      )}
      {state === "notfound" && (
        <p className="py-24 text-center text-neutral-400">
          没有找到这套房源（MLS {mls}）。<Link href="/" className="ml-1 underline">回到搜索</Link>
        </p>
      )}
      {state === "ok" && listing && (
        <ListingDetail listing={listing} backLabel="回到搜索" onBack={() => (window.location.href = "/")} />
      )}
    </main>
  );
}
