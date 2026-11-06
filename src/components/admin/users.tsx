"use client";
/* eslint-disable @next/next/no-img-element -- Google profile pictures are remote URLs */

import { useCallback, useEffect, useState } from "react";
import { Ban, Loader2, RefreshCw, Search, ShieldCheck, ShieldOff, Trash2, Undo2 } from "lucide-react";
import { useEvent } from "@/components/providers/event-provider";
import { useWalk } from "@/components/providers/walk-provider";
import { deleteUser, listUsers, setBlocked, setOrganiser, type ManagedUser } from "@/lib/admin-users";
import { useAuth } from "@/lib/auth";
import { backendMode } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Filter = "all" | "organisers" | "blocked";

const fmtDay = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "2-digit" }).format(new Date(iso)) : "Never";

/** Everyone who has signed in: organiser access, blocking and account deletion. */
export function Users() {
  if (backendMode === "local") {
    return (
      <p className="max-w-2xl rounded-[20px] border border-dashed border-uw-line p-6 text-[13.5px] leading-relaxed text-uw-slate">
        User accounts live in Supabase. Connect a Supabase project (see docs/SUPABASE_SETUP.md) to manage participants and organisers here.
      </p>
    );
  }
  return <UserManager />;
}

function UserManager() {
  const { account } = useAuth();
  const { model } = useEvent();
  const { reloadPosts } = useWalk();
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load users");
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on open
    load();
  }, [load]);

  const act = async (u: ManagedUser, run: () => Promise<void>, reloadFeed = false) => {
    setBusyId(u.id);
    try {
      await run();
      await load();
      if (reloadFeed) await reloadPosts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusyId(null);
    }
  };

  const label = (u: ManagedUser) => u.name || u.email || "this person";
  const toggleRole = (u: ManagedUser) => {
    const make = u.role !== "organiser";
    const msg = make
      ? `Make ${label(u)} an organiser? They can open this dashboard, edit the event and delete anyone's posts.`
      : `Remove organiser access from ${label(u)}?`;
    if (confirm(msg)) act(u, () => setOrganiser(u.id, make));
  };
  const toggleBlock = (u: ManagedUser) => {
    const msg = u.blocked
      ? `Unblock ${label(u)}? They can sign in again.`
      : `Block ${label(u)}? They're signed out within the hour and can't sign in again. Their posts stay until you delete them.`;
    if (confirm(msg)) act(u, () => setBlocked(u.id, !u.blocked));
  };
  const remove = (u: ManagedUser) => {
    const msg = `Permanently delete ${label(u)}'s account?\n\nTheir ${u.posts} post(s), photos, comments, likes and walking progress are deleted too. This can't be undone.`;
    if (confirm(msg)) act(u, () => deleteUser(u.id), true);
  };

  const needle = q.trim().toLowerCase();
  const shown = (users ?? []).filter(
    (u) =>
      (filter === "all" || (filter === "organisers" ? u.role === "organiser" : u.blocked)) &&
      (!needle || u.name.toLowerCase().includes(needle) || (u.email ?? "").toLowerCase().includes(needle)),
  );
  const counts = {
    all: users?.length ?? 0,
    organisers: users?.filter((u) => u.role === "organiser").length ?? 0,
    blocked: users?.filter((u) => u.blocked).length ?? 0,
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-uw-surface p-1 shadow-sm">
          {(["all", "organisers", "blocked"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn("tabular h-8 rounded-full px-3 text-[12.5px] font-medium capitalize", filter === f && "bg-uw-ink text-uw-paper")}>
              {f} {counts[f]}
            </button>
          ))}
        </div>
        <label className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-uw-slate" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" aria-label="Search users" className="h-10 w-full rounded-full bg-uw-surface pl-10 pr-4 text-[13px] shadow-sm outline-none focus:ring-2 focus:ring-uw-ink" />
        </label>
        <button onClick={load} className="press flex h-10 items-center gap-2 rounded-full bg-uw-surface px-4 text-[13px] font-medium shadow-sm">
          <RefreshCw className="size-4" /> Refresh
        </button>
      </div>

      {error && <p role="alert" className="rounded-[16px] bg-red-50 p-3 text-[13px] text-red-700">{error}</p>}

      {users === null && !error ? (
        <p className="flex items-center gap-2 p-6 text-[13.5px] text-uw-slate"><Loader2 className="size-4 animate-spin" /> Loading accounts…</p>
      ) : error && users === null ? null : shown.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-uw-line p-6 text-center text-[13.5px] text-uw-slate">{users?.length ? "Nobody matches." : "No one has signed in yet."}</p>
      ) : (
        <ul className="divide-y divide-uw-mist overflow-hidden rounded-[20px] bg-uw-surface">
          {shown.map((u) => {
            const me = u.id === account?.id;
            const busy = busyId === u.id;
            return (
              <li key={u.id} className={cn("grid gap-3 p-3.5 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-6", u.blocked && "bg-uw-paper/60")}>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar user={u} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold">
                      <span className="truncate">{u.name || "No name"}</span>
                      {me && <Badge className="bg-uw-mist text-uw-charcoal">You</Badge>}
                      {u.role === "organiser" && <Badge className="bg-uw-blue text-white">Organiser</Badge>}
                      {u.blocked && <Badge className="bg-red-600 text-white">Blocked</Badge>}
                    </p>
                    <p className="truncate text-[12.5px] text-uw-slate">{u.email ?? "No email"}</p>
                  </div>
                </div>

                <dl className="tabular grid max-w-[340px] grid-cols-4 gap-3 pl-[52px] text-[12px] text-uw-slate md:w-[320px] md:pl-0">
                  <Stat k="Joined" v={fmtDay(u.created_at)} />
                  <Stat k="Last in" v={fmtDay(u.last_sign_in_at)} />
                  <Stat k="Posts" v={String(u.posts)} />
                  <Stat k="Visited" v={`${u.visited}/${model.stops.length}`} />
                </dl>

                <div className="flex items-center gap-1 pl-[52px] md:pl-0">
                  {busy ? (
                    <Loader2 className="m-2 size-5 animate-spin text-uw-slate" aria-label="Working" />
                  ) : (
                    <>
                      <Action onClick={() => toggleRole(u)} disabled={me} label={u.role === "organiser" ? "Remove organiser" : "Make organiser"}>
                        {u.role === "organiser" ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4" />}
                      </Action>
                      <Action onClick={() => toggleBlock(u)} disabled={me || (u.role === "organiser" && !u.blocked)} label={u.blocked ? "Unblock" : "Block"}>
                        {u.blocked ? <Undo2 className="size-4" /> : <Ban className="size-4" />}
                      </Action>
                      <Action onClick={() => remove(u)} disabled={me || u.role === "organiser"} label="Delete account" danger>
                        <Trash2 className="size-4" />
                      </Action>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[12px] leading-relaxed text-uw-slate">
        Role changes apply when that person next signs in, or within the hour. Remove someone&apos;s organiser role before blocking or deleting them.
      </p>
    </div>
  );
}

function Avatar({ user }: { user: ManagedUser }) {
  if (user.avatar_url) return <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" loading="lazy" className="size-10 shrink-0 rounded-full object-cover" />;
  return <span className="grid size-10 shrink-0 place-items-center rounded-full bg-uw-mist text-[14px] font-semibold">{(user.name || user.email || "?").slice(0, 1).toUpperCase()}</span>;
}

const Badge = ({ className, children }: { className: string; children: React.ReactNode }) => (
  <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", className)}>{children}</span>
);

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div>
    <dt className="text-[10.5px] uppercase tracking-wider">{k}</dt>
    <dd className="mt-0.5 whitespace-nowrap text-[12.5px] font-medium text-uw-ink">{v}</dd>
  </div>
);

function Action({ onClick, disabled, label, danger, children }: { onClick: () => void; disabled?: boolean; label: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "press flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-uw-charcoal hover:bg-uw-mist disabled:pointer-events-none disabled:opacity-30",
        danger && "hover:bg-red-50 hover:text-red-700",
      )}
    >
      {children}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
