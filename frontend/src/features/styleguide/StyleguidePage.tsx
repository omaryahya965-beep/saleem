// Developer-only living style guide. Sample copy is inline per language on purpose:
// this page documents primitives and is excluded from production builds.
import {
  Bell,
  FilePlus2,
  LayoutList,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  AppShell,
  Badge,
  Brand,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Dialog,
  Dropzone,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  IssueCard,
  KeyValueList,
  LanguageToggle,
  Page,
  PageHeader,
  ProgressBar,
  RuleRow,
  SegmentedControl,
  Select,
  Skeleton,
  StatusChip,
  Stepper,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  VideoTimeline,
  toast,
  type IssueView,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import type { InspectedMedia } from "@/lib/media";

const swatches: [string, string, string][] = [
  ["ink", "#0E2620", "text-primary · 14.1:1 on paper"],
  ["ink-2", "#183830", "inverse surfaces"],
  ["green", "#0B6E4F", "primary · 5.5:1 on paper · white on green 6.3:1"],
  ["mint", "#7FD1AE", "accent on ink · 8.8:1"],
  ["paper", "#F3F1EA", "page background"],
  ["card", "#FBFAF6", "surface"],
  ["line", "#DCD8CB", "dividers (decorative)"],
  ["line-strong", "#8A877B", "control borders · 3.45:1"],
  ["muted", "#4B5552", "text-secondary · 6.8:1 on paper"],
  ["amber", "#A15C00", "warning markers"],
  ["amber-text", "#8A4F00", "warning text · 5.7:1 on amber-bg"],
  ["amber-bg", "#F7EDDC", "warning background"],
  ["red", "#B3261E", "violation · 5.4:1 on red-bg"],
  ["red-bg", "#F8E6E3", "violation background"],
  ["green-bg", "#E2EFE8", "ready background · green 5.3:1"],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8">
      <h2 className="text-xl font-bold text-fg">{title}</h2>
      {children}
    </section>
  );
}

export function StyleguidePage() {
  const { lang, t } = useI18n();
  const ar = lang === "ar";
  const [kind, setKind] = useState<"video" | "image" | "text">("video");
  const [sw, setSw] = useState(true);
  const [sw2, setSw2] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [time, setTime] = useState(12);
  const [selected, setSelected] = useState<string | null>("i2");
  const [media, setMedia] = useState<InspectedMedia | null>(null);

  const issues: IssueView[] = [
    {
      id: "i1",
      severity: "violation",
      time: 0,
      title: ar ? "إعلان دون إفصاح قبل بدايته" : "Ad without disclosure before it starts",
      ruleCode: "MAW-01",
      ruleTitle: ar ? "الإفصاح الواضح عن الإعلان" : "Clear ad disclosure",
      sourceName: ar ? "شروط منصة موثوق" : "Mawthooq terms",
      sourceUrl: "https://mawthooq.gcam.gov.sa",
      evidenceType: "transcript",
      evidence: ar ? "استخدموا كود SALEEM20 والرابط في البايو" : "Use code SALEEM20, link in bio",
      fix: ar
        ? "ابدأ المقطع بعبارة «إعلان مدفوع» وأضف #إعلان للوصف."
        : 'Open with "paid ad" and add #ad to the caption.',
    },
    {
      id: "i2",
      severity: "violation",
      time: 12,
      title: ar ? "ادعاء صحي مطلق ومضمون النتيجة" : "Absolute, guaranteed health claim",
      ruleCode: "COM-01",
      ruleTitle: ar ? "عدم الادعاءات المضللة" : "No misleading claims",
      sourceName: ar ? "ضوابط الإعلان – وزارة التجارة" : "Ad rules – Ministry of Commerce",
      sourceUrl: "https://mc.gov.sa",
      evidenceType: "transcript",
      evidence: ar
        ? "هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع"
        : "This tea slims you, lose 5 kg in a week",
      fix: ar
        ? "احذف وعود الوزن، واكتفِ بوصف تجربتك."
        : "Remove weight promises; describe your experience only.",
    },
    {
      id: "i3",
      severity: "warning",
      time: null,
      title: ar ? "لا يوجد عقد مكتوب مع الماركة" : "No written contract with the brand",
      ruleCode: "MAW-03",
      ruleTitle: ar ? "عقد مكتوب للإعلان" : "Written ad contract",
      sourceName: ar ? "شروط منصة موثوق" : "Mawthooq terms",
      sourceUrl: null,
      evidenceType: "metadata",
      evidence: null,
      fix: ar
        ? "وثّق الاتفاق كتابياً قبل النشر."
        : "Put the agreement in writing before publishing.",
    },
  ];

  const nav = [
    { key: "dash", label: t("nav.dashboard"), icon: <LayoutList />, active: false },
    { key: "new", label: t("nav.newCheck"), icon: <FilePlus2 />, active: true },
    { key: "rules", label: t("nav.rulebook"), icon: <ShieldCheck />, active: false },
    { key: "settings", label: t("nav.settings"), icon: <Settings />, active: false },
  ].map((n) => ({
    ...n,
    render: (p: { className: string; children: ReactNode }) => <a href="#" {...p} />,
  }));

  return (
    <AppShell
      brand={<Brand />}
      nav={nav}
      actions={
        <>
          <LanguageToggle />
          <IconButton label={ar ? "الإشعارات" : "Notifications"}>
            <Bell />
          </IconButton>
        </>
      }
      mobileActionBar={
        <Button block icon={<Upload />}>
          {ar ? "ارفع النسخة المعدّلة" : "Upload fixed version"}
        </Button>
      }
    >
      <Page className="flex flex-col gap-10">
        <PageHeader
          eyebrow={<Badge variant="outline">{t("styleguide.devOnly")}</Badge>}
          title={t("styleguide.title")}
          description={t("styleguide.subtitle")}
          actions={<Button icon={<Plus />}>{t("nav.newCheck")}</Button>}
        />

        <Section title={ar ? "الألوان والتباين" : "Colour & contrast"}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {swatches.map(([name, hex, note]) => (
              <div
                key={name}
                className="overflow-hidden rounded-md border border-border bg-surface"
              >
                <div className="h-14" style={{ background: hex }} />
                <div className="p-2.5 text-xs">
                  <p className="font-bold text-fg">{name}</p>
                  <p dir="ltr" className="font-mono text-fg-muted">
                    {hex}
                  </p>
                  <p dir="ltr" className="text-fg-muted">
                    {note}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title={ar ? "الخطوط" : "Typography"}>
          <p className="font-display text-5xl font-bold">{t("brand.promise")}</p>
          {(
            [
              ["4xl", "text-4xl"],
              ["3xl", "text-3xl"],
              ["2xl", "text-2xl"],
              ["xl", "text-xl"],
              ["lg", "text-lg"],
              ["base", "text-base"],
              ["sm", "text-sm"],
              ["xs", "text-xs"],
            ] as const
          ).map(([s, cls]) => (
            <p key={s} className={cls}>
              <span dir="ltr" className="me-3 inline-block w-12 font-mono text-xs text-fg-muted">
                {s}
              </span>
              {ar ? "سَليم يفحص محتواك قبل النشر — 00:12" : "SALEEM checks your content — 00:12"}
            </p>
          ))}
          <p className="prose-measure text-fg-muted">
            {ar
              ? "نص المتن بارتفاع سطر 1.7 وعرض أقصى يقارب 70 حرفاً. لا تباعد بين الحروف العربية، والأرقام جدولية في الأوقات."
              : "Body copy uses 1.7 line height and a ~70ch measure. No letter-spacing on Arabic; times use tabular numerals."}
          </p>
        </Section>

        <Section title={ar ? "الأزرار" : "Buttons"}>
          <div className="flex flex-wrap items-center gap-3">
            <Button>{ar ? "أساسي" : "Primary"}</Button>
            <Button variant="secondary">{ar ? "ثانوي" : "Secondary"}</Button>
            <Button variant="ghost">{ar ? "شفاف" : "Ghost"}</Button>
            <Button variant="danger">{ar ? "حذف" : "Delete"}</Button>
            <Button loading>{ar ? "جارٍ الرفع" : "Uploading"}</Button>
            <Button disabled>{ar ? "معطّل" : "Disabled"}</Button>
            <Button icon={<Upload />}>{ar ? "مع أيقونة" : "With icon"}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">sm 36</Button>
            <Button size="md">md 44</Button>
            <Button size="lg">lg 52</Button>
            <IconButton label={t("common.search")} variant="secondary">
              <Search />
            </IconButton>
            <Tooltip content={ar ? "تلميح إضافي" : "Supplementary hint"}>
              <Button variant="secondary">{ar ? "مرّر للتلميح" : "Hover for tooltip"}</Button>
            </Tooltip>
          </div>
        </Section>

        <Section title={ar ? "الحقول" : "Form controls"}>
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label={ar ? "رقم رخصة موثوق" : "Mawthooq license no."}
              optional
              optionalLabel={t("common.optional")}
              hint={ar ? "يظهر في سجل الامتثال." : "Shown on the compliance log."}
            >
              <Input placeholder="MW-2026-00000" dir="ltr" />
            </Field>
            <Field
              label={t("dropzone.title")}
              error={ar ? "هذا الحقل مطلوب." : "This field is required."}
            >
              <Input />
            </Field>
            <Field label={ar ? "الوصف" : "Caption"}>
              <Textarea
                placeholder={
                  ar ? "اكتب الوصف كما سيُنشر…" : "Write the caption as it will be published…"
                }
              />
            </Field>
            <div className="flex flex-col gap-5">
              <Field label={ar ? "المنصة" : "Platform"}>
                <Select defaultValue="snapchat">
                  {(["snapchat", "tiktok", "instagram", "x", "youtube"] as const).map((p) => (
                    <option key={p} value={p}>
                      {t(`platforms.${p}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={ar ? "معطّل" : "Disabled"}>
                <Input disabled value="—" readOnly />
              </Field>
            </div>
          </div>
          <Checkbox
            label={
              ar
                ? "أؤكد أن لدي الحق في رفع هذا المحتوى."
                : "I confirm I have the right to upload this content."
            }
            hint={ar ? "مطلوب لبدء الفحص." : "Required to start a check."}
          />
          <Card className="max-w-xl py-1 sm:py-1">
            <Switch
              checked={sw}
              onCheckedChange={setSw}
              label={ar ? "هذا إعلان مدفوع" : "This is a paid ad"}
              hint={
                ar
                  ? "أي محتوى بمقابل مالي أو هدية أو كود خصم."
                  : "Any content for money, gifts or a discount code."
              }
              className="border-b border-border"
            />
            <Switch
              checked={sw2}
              onCheckedChange={setSw2}
              label={ar ? "استخدمت الذكاء الاصطناعي" : "AI was used"}
              hint={
                ar
                  ? "توليد أو تعديل صوت أو صورة أو نص."
                  : "Generating or editing audio, images or text."
              }
            />
          </Card>
          <SegmentedControl
            label={ar ? "نوع المحتوى" : "Content type"}
            value={kind}
            onValueChange={setKind}
            options={(["video", "image", "text"] as const).map((k) => ({
              value: k,
              label: t(`kinds.${k}`),
            }))}
          />
          <Tabs defaultValue="all">
            <TabsList label={ar ? "تصفية" : "Filter"}>
              <TabsTrigger value="all" count={12}>
                {t("common.all")}
              </TabsTrigger>
              <TabsTrigger value="needs" count={3}>
                {t("status.needs_fixes")}
              </TabsTrigger>
              <TabsTrigger value="review" count={2}>
                {t("status.review")}
              </TabsTrigger>
              <TabsTrigger value="ready" count={7}>
                {t("status.ready")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="pt-3 text-sm text-fg-muted">
              {ar ? "محتوى التبويب" : "Tab content"}
            </TabsContent>
          </Tabs>
        </Section>

        <Section title={ar ? "الحالات والشارات" : "Status & badges"}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone="violation">{t("status.needs_fixes")}</StatusChip>
            <StatusChip tone="warning">{t("status.review")}</StatusChip>
            <StatusChip tone="ready">{t("status.ready")}</StatusChip>
            <StatusChip tone="processing">{t("status.processing")}</StatusChip>
            <StatusChip tone="neutral">{t("status.queued")}</StatusChip>
            <StatusChip tone="violation" size="sm">
              {t("severity.violation")}
            </StatusChip>
            <StatusChip tone="warning" size="sm">
              {t("severity.warning")}
            </StatusChip>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge mono>MAW-01</Badge>
            <Badge variant="outline">
              {ar ? "توضيحية – بانتظار المراجعة القانونية" : "Illustrative – pending legal review"}
            </Badge>
            <Badge variant="inverse">{t("common.demo")}</Badge>
            <Badge variant="green">v2026.10-a</Badge>
          </div>
        </Section>

        <Section title={ar ? "التقدّم" : "Progress"}>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <ProgressBar value={62} label={ar ? "تقدّم الفحص" : "Check progress"} />
              <p className="tabular mt-2 text-sm text-fg-muted">62%</p>
            </Card>
            <Card>
              <Stepper
                steps={[
                  { key: "u", label: ar ? "رفع الملف" : "Upload", state: "done" },
                  {
                    key: "f",
                    label: ar ? "استخراج اللقطات" : "Extract frames",
                    detail: ar ? "32 لقطة" : "32 frames",
                    state: "done",
                  },
                  { key: "t", label: ar ? "تفريغ الكلام" : "Transcribe speech", state: "current" },
                  { key: "a", label: ar ? "مطابقة القواعد" : "Match rules", state: "upcoming" },
                  { key: "x", label: ar ? "تعذّر التحليل" : "Analysis failed", state: "failed" },
                ]}
              />
            </Card>
          </div>
        </Section>

        <Section title={ar ? "الرفع" : "Dropzone"}>
          <Dropzone kind="video" value={media} onChange={setMedia} className="max-w-xl" />
        </Section>

        <Section title={ar ? "الخط الزمني وبطاقات الملاحظات" : "Timeline & issue cards"}>
          <Card className="max-w-xl">
            <VideoTimeline
              duration={42}
              currentTime={time}
              markers={issues
                .filter((i) => i.time !== null)
                .map((i) => ({ id: i.id, t: i.time ?? 0, severity: i.severity, title: i.title }))}
              selectedId={selected}
              onSeek={setTime}
              onSelectMarker={(id) => {
                setSelected(id);
                setTime(issues.find((i) => i.id === id)?.time ?? 0);
              }}
            />
          </Card>
          <div className="grid max-w-2xl gap-3">
            {issues.map((i) => (
              <IssueCard
                key={i.id}
                issue={i}
                selected={selected === i.id}
                onSelect={() => setSelected(i.id)}
              />
            ))}
          </div>
        </Section>

        <Section title={ar ? "القواعد والبيانات" : "Rules & facts"}>
          <Card>
            <RuleRow
              code="MAW-01"
              title={issues[0]!.ruleTitle}
              description={
                ar
                  ? "يجب الإفصاح كتابةً أو صوتاً قبل عرض الإعلان."
                  : "Disclose the ad in writing or speech before it starts."
              }
              sourceName={issues[0]!.sourceName}
              sourceUrl={issues[0]!.sourceUrl}
              version="2026.10-a"
              severity="violation"
              illustrative
              illustrativeLabel={ar ? "توضيحية" : "Illustrative"}
            />
            <RuleRow
              code="CNT-03"
              title={ar ? "حماية خصوصية الأسرة" : "Protect family privacy"}
              sourceName={ar ? "ضوابط المحتوى" : "Content rules"}
              sourceUrl={null}
              version="2026.10-a"
              severity="warning"
            />
          </Card>
          <Card>
            <CardTitle className="mb-2">{ar ? "بيانات الفحص" : "Check facts"}</CardTitle>
            <KeyValueList
              columns={2}
              items={[
                { key: ar ? "المنصة" : "Platform", value: t("platforms.snapchat") },
                { key: ar ? "التاريخ" : "Date", value: "14/10/2026" },
                { key: ar ? "دليل القواعد" : "Rulebook", value: "2026.10-a", ltr: true },
                { key: "SHA-256", value: "9f2c4a1e…a9c1e3b", ltr: true },
              ]}
            />
          </Card>
        </Section>

        <Section title={ar ? "الحالات الفارغة والأخطاء والتحميل" : "Empty, error & loading"}>
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState
              icon={<LayoutList />}
              title={ar ? "لا توجد فحوصات بعد" : "No checks yet"}
              body={ar ? "ارفع أول مقطع قبل نشره." : "Upload your first clip before you publish."}
              action={<Button>{t("nav.newCheck")}</Button>}
            />
            <ErrorState
              title={t("errors.pageFailedTitle")}
              body={t("errors.network")}
              retryLabel={t("common.retry")}
              onRetry={() => toast.message(t("common.retry"))}
            />
          </div>
          <Card className="flex items-center gap-4">
            <Skeleton className="h-16 w-12 rounded-sm" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-7 w-28 rounded-full" />
          </Card>
        </Section>

        <Section title={ar ? "النوافذ والإشعارات" : "Dialogs & toasts"}>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setDialog(true)}>
              {ar ? "افتح نافذة" : "Open dialog"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.success(ar ? "اكتمل الفحص" : "Check complete")}
            >
              {ar ? "إشعار نجاح" : "Success toast"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.error(ar ? "تعذّر رفع الملف" : "Upload failed")}
            >
              {ar ? "إشعار خطأ" : "Error toast"}
            </Button>
          </div>
          <Dialog
            open={dialog}
            onOpenChange={setDialog}
            title={ar ? "حذف الوسائط؟" : "Delete media?"}
            description={
              ar
                ? "سنحذف الفيديو واللقطات نهائياً، ونحتفظ بالملاحظات والبصمة فقط."
                : "We'll permanently delete the video and frames, keeping only findings and the hash."
            }
            footer={
              <>
                <Button variant="secondary" onClick={() => setDialog(false)}>
                  {t("common.cancel")}
                </Button>
                <Button variant="danger" onClick={() => setDialog(false)}>
                  {t("common.delete")}
                </Button>
              </>
            }
          />
        </Section>
      </Page>
    </AppShell>
  );
}
