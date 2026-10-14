import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronLeft, Copy, Megaphone, Plus, UserPlus, Users, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  Page,
  PageHeader,
  Select,
  Skeleton,
  StatusChip,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from "@/components/ui";
import { statusOf } from "@/features/submissions/DashboardPage";
import { useUsage } from "@/features/settings/UsageMeter";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import {
  acceptInvite,
  createCampaign,
  createInvite,
  createOrg,
  errorCode,
  fetchMyOrgs,
  fetchOrg,
  removeMember,
  revokeInvite,
  setMemberRole,
  type OrgRole,
} from "@/lib/api/features";

const ROLES: OrgRole[] = ["owner", "admin", "reviewer", "creator"];

function useOrg(id: string) {
  return useQuery({ queryKey: ["org", id], queryFn: () => fetchOrg(id) });
}

function Stats({ subs }: { subs: { status: string; overall_status: string | null }[] }) {
  const { t } = useI18n();
  const done = subs.filter((s) => s.status === "done");
  const counts = {
    needs_fixes: done.filter((s) => s.overall_status === "needs_fixes").length,
    review: done.filter((s) => s.overall_status === "review").length,
    ready: done.filter((s) => s.overall_status === "ready").length,
  };
  const rate = done.length ? Math.round((counts.ready / done.length) * 100) : null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card className="flex flex-col gap-1">
        <span className="text-sm text-fg-muted">{t("org.readyRate")}</span>
        <span className="tabular text-3xl font-bold">{rate === null ? "—" : `${rate}%`}</span>
      </Card>
      {(["needs_fixes", "review", "ready"] as const).map((k) => (
        <Card key={k} className="flex flex-col gap-1">
          <StatusChip
            size="sm"
            tone={k === "ready" ? "ready" : k === "review" ? "warning" : "violation"}
            className="self-start"
          >
            {t(`status.${k}`)}
          </StatusChip>
          <span className="tabular text-3xl font-bold">{counts[k]}</span>
        </Card>
      ))}
    </div>
  );
}

function SubmissionList({
  subs,
  names,
}: {
  subs: {
    id: string;
    title: string | null;
    platform: string;
    status: string;
    overall_status: string | null;
    created_at: string;
    user_id: string | null;
  }[];
  names: Map<string, string>;
}) {
  const { t, formatDate } = useI18n();
  if (!subs.length)
    return (
      <EmptyState icon={<Megaphone />} title={t("org.noChecks")} body={t("org.noChecksBody")} />
    );
  return (
    <Card padded={false}>
      <ul className="divide-y divide-border">
        {subs.map((s) => {
          const st = statusOf(s);
          return (
            <li key={s.id}>
              <Link
                to="/checks/$id"
                params={{ id: s.id }}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-sunken"
              >
                <span className="min-w-0 flex-1">
                  <span dir="auto" className="block truncate font-medium">
                    {s.title || t("dashboard.untitled")}
                  </span>
                  <span className="text-sm text-fg-muted">
                    {names.get(s.user_id ?? "") ?? "—"} · {t(`platforms.${s.platform}` as never)} ·{" "}
                    {formatDate(s.created_at)}
                  </span>
                </span>
                <StatusChip tone={st.tone} size="sm">
                  {t(st.key)}
                </StatusChip>
                <ChevronLeft aria-hidden="true" className="size-5 text-fg-muted ltr:rotate-180" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** /org — my workspaces; create one (agency plan). */
export function OrgsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const usage = useUsage();
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: fetchMyOrgs });
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => createOrg(name),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ["orgs"] });
      void navigate({ to: "/org/$id", params: { id } });
    },
    onError: (e) => toast.error(t(`quota.${errorCode(e)}` as never)),
  });
  return (
    <Page className="flex flex-col gap-6">
      <PageHeader title={t("org.title")} description={t("org.subtitle")} />
      {orgs.isError ? (
        <ErrorState
          title={t("org.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void orgs.refetch()}
        />
      ) : orgs.isPending ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : orgs.data.length === 0 ? (
        <EmptyState icon={<Building2 />} title={t("org.emptyTitle")} body={t("org.emptyBody")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {orgs.data.map((o) => (
            <Link
              key={o.id}
              to="/org/$id"
              params={{ id: o.id }}
              className="rounded-lg border border-border bg-surface p-5 hover:border-border-strong"
            >
              <p className="text-lg font-bold">{o.name}</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-fg-muted">
                <Users aria-hidden="true" className="size-4" />
                {t("org.membersCount", { n: o.org_members.length })}
              </p>
            </Link>
          ))}
        </div>
      )}
      <Card className="flex flex-col gap-4">
        <CardTitle>{t("org.createTitle")}</CardTitle>
        {usage.data && !usage.data.orgs_allowed ? (
          <p className="text-fg-muted">{t("org.planRequired")}</p>
        ) : (
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (name.trim().length >= 2) create.mutate();
            }}
          >
            <Field label={t("org.name")} className="flex-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
            </Field>
            <Button type="submit" icon={<Plus />} loading={create.isPending} className="sm:mb-0.5">
              {t("org.create")}
            </Button>
          </form>
        )}
      </Card>
    </Page>
  );
}

/** /org/$id — overview, campaigns, members, invites. */
export function OrgPage({ id }: { id: string }) {
  const { t, formatDate } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useOrg(id);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("creator");
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [camp, setCamp] = useState({ name: "", brand: "", starts_on: "", ends_on: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["org", id] });
  const onErr = (e: unknown) => toast.error(t(`quota.${errorCode(e)}` as never));

  const invite = useMutation({
    mutationFn: () => createInvite(id, inviteEmail, inviteRole),
    onSuccess: (token) => {
      setLastLink(`${window.location.origin}/invite/${token}`);
      setInviteEmail("");
      void refresh();
    },
    onError: onErr,
  });
  const addCampaign = useMutation({
    mutationFn: () =>
      createCampaign({
        org_id: id,
        name: camp.name,
        brand: camp.brand || null,
        starts_on: camp.starts_on || null,
        ends_on: camp.ends_on || null,
        created_by: user!.id,
      }),
    onSuccess: () => {
      setCamp({ name: "", brand: "", starts_on: "", ends_on: "" });
      void refresh();
    },
    onError: onErr,
  });
  const roleMut = useMutation({
    mutationFn: (v: { user: string; role: OrgRole }) => setMemberRole(id, v.user, v.role),
    onSuccess: () => void refresh(),
    onError: onErr,
  });
  const removeMut = useMutation({
    mutationFn: (u: string) => removeMember(id, u),
    onSuccess: () => void refresh(),
    onError: onErr,
  });
  const revokeMut = useMutation({
    mutationFn: (i: string) => revokeInvite(i),
    onSuccess: () => void refresh(),
    onError: onErr,
  });

  if (q.isPending)
    return (
      <Page>
        <Skeleton className="h-48 w-full rounded-lg" />
      </Page>
    );
  if (q.isError)
    return (
      <Page narrow>
        <ErrorState
          title={t("org.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void q.refetch()}
        />
      </Page>
    );
  const { org, members, invites, campaigns, submissions } = q.data;
  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  const manager = myRole === "owner" || myRole === "admin";
  const names = new Map(members.map((m) => [m.user_id, m.display_name || m.email || "—"]));

  return (
    <Page className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <Link to="/org" className="text-sm text-green hover:underline">
            {t("org.title")}
          </Link>
        }
        title={org.name}
        description={myRole ? t("org.yourRole", { role: t(`org.roles.${myRole}`) }) : undefined}
        actions={
          <Button asChild>
            <Link to="/new" search={{ org: id }}>
              <Plus aria-hidden="true" />
              {t("nav.newCheck")}
            </Link>
          </Button>
        }
      />
      <Tabs defaultValue="overview">
        <TabsList label={t("org.sections")}>
          <TabsTrigger value="overview">{t("org.overview")}</TabsTrigger>
          <TabsTrigger value="campaigns" count={campaigns.length}>
            {t("org.campaigns")}
          </TabsTrigger>
          <TabsTrigger value="members" count={members.length}>
            {t("org.members")}
          </TabsTrigger>
          {manager && (
            <TabsTrigger value="invites" count={invites.length}>
              {t("org.invites")}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4 pt-5">
          <Stats subs={submissions} />
          <SubmissionList subs={submissions.slice(0, 20)} names={names} />
        </TabsContent>

        <TabsContent value="campaigns" className="flex flex-col gap-4 pt-5">
          {campaigns.length === 0 ? (
            <EmptyState icon={<Megaphone />} title={t("org.noCampaigns")} />
          ) : (
            <Card padded={false}>
              <ul className="divide-y divide-border">
                {campaigns.map((c) => {
                  const cs = submissions.filter((s) => s.campaign_id === c.id);
                  const flagged = cs.filter((s) => s.overall_status === "needs_fixes").length;
                  return (
                    <li key={c.id}>
                      <Link
                        to="/org/$id/campaigns/$cid"
                        params={{ id, cid: c.id }}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-sunken"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{c.name}</span>
                          <span className="text-sm text-fg-muted">
                            {[c.brand, c.starts_on && formatDate(c.starts_on)]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <Badge>{t("org.checksCount", { n: cs.length })}</Badge>
                        {flagged > 0 && (
                          <StatusChip tone="violation" size="sm">
                            {t("archive.flaggedShort", { n: flagged })}
                          </StatusChip>
                        )}
                        <ChevronLeft
                          aria-hidden="true"
                          className="size-5 text-fg-muted ltr:rotate-180"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          {manager && (
            <Card className="flex flex-col gap-4">
              <CardTitle>{t("org.newCampaign")}</CardTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("org.campaignName")}>
                  <Input
                    value={camp.name}
                    onChange={(e) => setCamp({ ...camp, name: e.target.value })}
                    dir="auto"
                  />
                </Field>
                <Field label={t("org.brand")} optional optionalLabel={t("common.optional")}>
                  <Input
                    value={camp.brand}
                    onChange={(e) => setCamp({ ...camp, brand: e.target.value })}
                    dir="auto"
                  />
                </Field>
                <Field label={t("org.startsOn")} optional optionalLabel={t("common.optional")}>
                  <Input
                    type="date"
                    value={camp.starts_on}
                    onChange={(e) => setCamp({ ...camp, starts_on: e.target.value })}
                  />
                </Field>
                <Field label={t("org.endsOn")} optional optionalLabel={t("common.optional")}>
                  <Input
                    type="date"
                    value={camp.ends_on}
                    onChange={(e) => setCamp({ ...camp, ends_on: e.target.value })}
                  />
                </Field>
              </div>
              <div>
                <Button
                  icon={<Plus />}
                  disabled={camp.name.trim().length < 2}
                  loading={addCampaign.isPending}
                  onClick={() => addCampaign.mutate()}
                >
                  {t("org.addCampaign")}
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="members" className="pt-5">
          <Card padded={false}>
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{m.display_name || "—"}</span>
                    <span dir="ltr" className="block truncate text-sm text-fg-muted rtl:text-end">
                      {m.email}
                    </span>
                  </span>
                  {manager && m.user_id !== user?.id ? (
                    <>
                      <label className="sr-only" htmlFor={`role-${m.user_id}`}>
                        {t("org.role")}
                      </label>
                      <Select
                        id={`role-${m.user_id}`}
                        value={m.role}
                        onChange={(e) =>
                          roleMut.mutate({ user: m.user_id, role: e.target.value as OrgRole })
                        }
                        className="h-10 w-40"
                      >
                        {ROLES.filter((r) => r !== "owner" || myRole === "owner").map((r) => (
                          <option key={r} value={r}>
                            {t(`org.roles.${r}`)}
                          </option>
                        ))}
                      </Select>
                      <IconButton
                        label={t("org.remove")}
                        onClick={() => removeMut.mutate(m.user_id)}
                      >
                        <X />
                      </IconButton>
                    </>
                  ) : (
                    <Badge>{t(`org.roles.${m.role}`)}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <p className="mt-3 text-sm text-fg-muted">{t("org.rolesHelp")}</p>
        </TabsContent>

        {manager && (
          <TabsContent value="invites" className="flex flex-col gap-4 pt-5">
            <Card className="flex flex-col gap-4">
              <CardTitle>{t("org.inviteTitle")}</CardTitle>
              <form
                className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) invite.mutate();
                }}
              >
                <Field label={t("auth.email")}>
                  <Input
                    type="email"
                    dir="ltr"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="rtl:text-end"
                  />
                </Field>
                <Field label={t("org.role")}>
                  <Select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                  >
                    {ROLES.filter((r) => r !== "owner").map((r) => (
                      <option key={r} value={r}>
                        {t(`org.roles.${r}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit" icon={<UserPlus />} loading={invite.isPending}>
                  {t("org.invite")}
                </Button>
              </form>
              {lastLink && (
                <div className="flex flex-col gap-2 rounded-md border border-green/20 bg-green-bg p-3 text-sm">
                  <p>{t("org.inviteCreated")}</p>
                  <div className="flex items-center gap-2">
                    <code
                      dir="ltr"
                      className="min-w-0 flex-1 truncate rounded-sm bg-surface px-2 py-1.5 font-mono text-xs"
                    >
                      {lastLink}
                    </code>
                    <IconButton
                      label={t("common.copy")}
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(lastLink)
                          .then(() => toast.success(t("common.copied")))
                      }
                    >
                      <Copy />
                    </IconButton>
                  </div>
                </div>
              )}
            </Card>
            {invites.length > 0 && (
              <Card padded={false}>
                <ul className="divide-y divide-border">
                  {invites.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                      <span dir="ltr" className="min-w-0 flex-1 truncate rtl:text-end">
                        {i.email}
                      </span>
                      <Badge>{t(`org.roles.${i.role}`)}</Badge>
                      <span className="text-fg-muted">
                        {t("org.expires", { date: formatDate(i.expires_at) })}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => revokeMut.mutate(i.id)}>
                        {t("org.revoke")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </Page>
  );
}

/** /org/$id/campaigns/$cid — campaign compliance view. */
export function CampaignPage({ id, cid }: { id: string; cid: string }) {
  const { t, formatDate } = useI18n();
  const q = useOrg(id);
  if (q.isPending)
    return (
      <Page>
        <Skeleton className="h-48 w-full rounded-lg" />
      </Page>
    );
  if (q.isError)
    return (
      <Page narrow>
        <ErrorState
          title={t("org.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void q.refetch()}
        />
      </Page>
    );
  const c = q.data.campaigns.find((x) => x.id === cid);
  if (!c)
    return (
      <Page narrow>
        <EmptyState icon={<Megaphone />} title={t("errors.notFoundTitle")} />
      </Page>
    );
  const subs = q.data.submissions.filter((s) => s.campaign_id === cid);
  const names = new Map(q.data.members.map((m) => [m.user_id, m.display_name || m.email || "—"]));
  return (
    <Page className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <Link to="/org/$id" params={{ id }} className="text-sm text-green hover:underline">
            {q.data.org.name}
          </Link>
        }
        title={c.name}
        description={[
          c.brand,
          c.starts_on &&
            `${formatDate(c.starts_on)}${c.ends_on ? ` – ${formatDate(c.ends_on)}` : ""}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <Button asChild>
            <Link to="/new" search={{ org: id, campaign: cid }}>
              <Plus aria-hidden="true" />
              {t("nav.newCheck")}
            </Link>
          </Button>
        }
      />
      <Stats subs={subs} />
      <SubmissionList subs={subs} names={names} />
    </Page>
  );
}

/** /invite/$token — accept an organization invite (signed in, matching email). */
export function InvitePage({ token }: { token: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const accept = useMutation({
    mutationFn: () => acceptInvite(token),
    onSuccess: (orgId) => {
      void qc.invalidateQueries({ queryKey: ["orgs"] });
      toast.success(t("org.joined"));
      void navigate({ to: "/org/$id", params: { id: orgId } });
    },
  });
  const code = accept.isError ? errorCode(accept.error) : null;
  return (
    <Page narrow>
      <Card className="flex flex-col items-start gap-4 sm:p-8">
        <Building2 aria-hidden="true" className="size-8 text-green" />
        <h1 className="text-2xl font-bold">{t("org.inviteHeading")}</h1>
        <p className="text-fg-muted">{t("org.inviteBody")}</p>
        {code && (
          <p role="alert" className="rounded-md bg-red-bg px-4 py-3 text-sm text-red">
            {t(`quota.${code}` as never)}
          </p>
        )}
        <Button loading={accept.isPending} onClick={() => accept.mutate()}>
          {t("org.acceptInvite")}
        </Button>
      </Card>
    </Page>
  );
}
