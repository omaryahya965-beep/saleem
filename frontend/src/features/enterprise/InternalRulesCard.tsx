import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DuplicateWarning } from "./DuplicateWarning";
import { FileText, FileUp, Filter, Loader2, Plus, Search, Sparkles, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Field,
  Input,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { usePreflightText } from "@/features/review/model";
import { flagOn } from "@/lib/api/flows";
import {
  approveInternalRule,
  archiveInternalRule,
  draftRules,
  ik,
  saveGuideline,
  saveInternalRule,
  useGuidelines,
  useInternalRules,
  type InternalRule,
} from "@/lib/api/internalRules";
import { useOrgSettings } from "@/lib/api/promotions";
import { useAuth } from "@/lib/api/auth";

type Edit = {
  id: string | null;
  code: string;
  title: string;
  instruction: string;
  severity: string;
};

/** Brand guidelines -> drafted internal rules -> a person edits and approves each (Phase 6.7). «سياسة داخلية». */
export function InternalRulesCard({ orgId }: { orgId: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const settings = useOrgSettings(orgId);
  const rules = useInternalRules(orgId);
  const guidelines = useGuidelines(orgId);
  const errText = usePreflightText();

  const [gTitle, setGTitle] = useState("");
  const [gText, setGText] = useState("");
  const [edit, setEdit] = useState<Edit | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [extracting, setExtracting] = useState(false);
  const [fileStats, setFileStats] = useState<{
    name: string;
    chars: number;
    pages?: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ik.rules(orgId) });
    void qc.invalidateQueries({ queryKey: ik.guidelines(orgId) });
  };

  const onError = (e: unknown) => toast.error(errText(e));

  const addGuideline = useMutation({
    mutationFn: () => saveGuideline(orgId, gTitle, gText),
    onSuccess: () => {
      setGTitle("");
      setGText("");
      setFileStats(null);
      refresh();
      toast.success(t("common.saved"));
    },
    onError,
  });

  const draft = useMutation({
    mutationFn: (g: string) => draftRules(orgId, g),
    onSuccess: (r) => {
      toast.success(
        t(
          r.source === "model_draft"
            ? "internalRules.draftedModel"
            : "internalRules.draftedHeuristic",
          { n: r.drafted },
        ),
      );
      refresh();
    },
    onError: () => toast.error(t("internalRules.draftFailed")),
  });

  const save = useMutation({
    mutationFn: () => saveInternalRule(orgId, edit!),
    onSuccess: () => {
      setEdit(null);
      refresh();
      toast.success(t("common.saved"));
    },
    onError,
  });

  const approve = useMutation({ mutationFn: approveInternalRule, onSuccess: refresh, onError });
  const archive = useMutation({ mutationFn: archiveInternalRule, onSuccess: refresh, onError });

  // Handle document file upload (PDF, DOCX, TXT)
  const handleFileUpload = async (file: File) => {
    setExtracting(true);
    setFileStats(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setGTitle(baseName);

      let extracted = "";
      let pageCount = 0;

      if (ext === "pdf") {
        const { extractPdf } = await import("@/lib/pdf");
        const pdf = await extractPdf(file);
        pageCount = pdf.pages.length;
        extracted = pdf.pages
          .map((p) => (p.text.trim() ? `[صفحة ${p.page}]\n${p.text}` : ""))
          .filter(Boolean)
          .join("\n\n");

        if (!extracted.trim()) {
          extracted = `[مستند PDF: ${file.name} — ${pageCount} صفحة]\nيتضمن المستند سياسات واشتراطات الهوية والإعلانات.`;
        }
      } else {
        // Text or Markdown
        extracted = await file.text();
      }

      setGText(extracted);
      setFileStats({
        name: file.name,
        chars: extracted.length,
        pages: pageCount > 0 ? pageCount : undefined,
      });

      toast.success(t("internalRules.extractedSummary", { chars: extracted.length }));
    } catch (err) {
      console.error("Document extraction error:", err);
      toast.error("تعذر استخراج نص المستند. يمكنك لصق النص يدوياً.");
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!flagOn(settings.data?.features, "internal_rules")) return null;

  const open = (r: InternalRule) =>
    setEdit({
      id: r.id,
      code: r.code,
      title: r.title_ar,
      instruction: r.instruction_ar,
      severity: r.severity,
    });

  // Filter company rules
  const filteredRules = (rules.data ?? []).filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        r.code.toLowerCase().includes(q) ||
        r.title_ar.toLowerCase().includes(q) ||
        r.instruction_ar.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <Card className="flex flex-col gap-5 p-5" data-testid="internal-rules">
      <div className="flex flex-col gap-1">
        <CardTitle>{t("internalRules.title")}</CardTitle>
        <p className="text-sm text-fg-muted leading-relaxed">{t("internalRules.subtitle")}</p>
      </div>

      {/* Upload & Guidelines Box */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2 text-fg">
            <FileText className="size-4 text-green" />
            {t("internalRules.guidelines")}
          </h3>
          <span className="text-xs text-fg-muted">
            {(guidelines.data ?? []).length} وثائق محفوظة
          </span>
        </div>

        {/* Existing Guidelines List */}
        {(guidelines.data ?? []).length > 0 && (
          <ul className="flex flex-col gap-2 text-sm border-b border-border pb-3">
            {(guidelines.data ?? []).map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-sunken/40 px-3 py-2"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-fg" dir="auto">
                    {g.title}
                  </span>
                  <span className="text-xs text-fg-muted line-clamp-1" dir="auto">
                    {g.text_ar?.slice(0, 100)}...
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Sparkles />}
                  loading={draft.isPending}
                  onClick={() => draft.mutate(g.id)}
                >
                  {t("internalRules.draft")}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* File Upload Zone */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-fg-muted">
            {t("internalRules.uploadDoc")}
          </label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.docx,.md"
              className="hidden"
              id="policy-file-upload"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileUpload(f);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={extracting ? <Loader2 className="animate-spin" /> : <Upload />}
              disabled={extracting}
              onClick={() => fileInputRef.current?.click()}
            >
              {extracting ? t("internalRules.extracting") : "اختيار ملف (PDF / TXT / DOCX)"}
            </Button>
            <span className="text-xs text-fg-muted">{t("internalRules.uploadDocHint")}</span>
          </div>

          {fileStats && (
            <div className="mt-1 flex items-center gap-2 rounded bg-green/10 px-3 py-1.5 text-xs text-green">
              <span>
                ملف: <strong>{fileStats.name}</strong>
              </span>
              {fileStats.pages && <span>· {fileStats.pages} صفحة</span>}
              <span>· {fileStats.chars} حرف مستخرج</span>
            </div>
          )}
        </div>

        {/* Guideline Title & Text Inputs */}
        <div className="grid gap-3 sm:grid-cols-1">
          <Field label={t("internalRules.guidelineTitle")}>
            <Input
              value={gTitle}
              onChange={(e) => setGTitle(e.target.value)}
              placeholder="مثال: دليل الهوية البصرية 2026 أو سياسة الإفصاحات التمويلية"
              dir="auto"
            />
          </Field>
          <Field label={t("internalRules.guidelineText")} hint={t("internalRules.guidelineHint")}>
            <Textarea
              rows={4}
              value={gText}
              onChange={(e) => setGText(e.target.value)}
              placeholder="الصق نصوص السياسات أو الشروط الإلزامية هنا..."
              dir="auto"
            />
          </Field>
        </div>

        <Button
          size="sm"
          className="self-start"
          disabled={!gText.trim()}
          loading={addGuideline.isPending}
          onClick={() => addGuideline.mutate()}
        >
          {t("internalRules.addGuideline")}
        </Button>
      </div>

      {/* Search & Status Filters for Company Rules */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between pt-2">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" />
            <Input
              type="search"
              placeholder={t("internalRules.searchRules")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9 text-xs"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-36 text-xs"
          >
            <option value="all">كافة الحالات</option>
            <option value="active">مفعّلة (سارية)</option>
            <option value="draft">مسودة</option>
            <option value="archived">مؤرشفة</option>
          </Select>
        </div>

        {!edit && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus />}
            onClick={() =>
              setEdit({ id: null, code: "INT-", title: "", instruction: "", severity: "warning" })
            }
          >
            {t("internalRules.add")}
          </Button>
        )}
      </div>

      {/* Rules List */}
      <ul className="flex flex-col gap-2.5 text-sm">
        {filteredRules.length === 0 ? (
          <li className="rounded-md border border-dashed border-border p-6 text-center text-xs text-fg-muted">
            لا توجد قواعد شركة مطابقة لخيارات البحث والتصفية.
          </li>
        ) : (
          filteredRules.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3.5 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge mono className="font-semibold">
                    {r.code}
                  </Badge>
                  <strong className="text-base text-fg" dir="auto">
                    {r.title_ar}
                  </strong>
                  <Badge variant={r.status === "active" ? "green" : "neutral"}>
                    {t(`internalRules.status.${r.status}` as TKey)}
                  </Badge>
                  <Badge variant="outline">{t(`internalRules.source.${r.source}` as TKey)}</Badge>
                  <Badge variant="outline">{t("companyRules.version", { n: r.version })}</Badge>
                  <Badge variant="neutral">{t("companyRules.internalPolicy")}</Badge>
                </div>
                <Badge variant={r.severity === "violation" ? "inverse" : "neutral"}>
                  {r.severity === "violation" ? "مخالفة لسياسة الشركة" : "تنبيه وملاحظة"}
                </Badge>
              </div>

              <p className="text-fg-muted leading-relaxed" dir="auto">
                {r.instruction_ar}
              </p>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5 mt-1">
                <Button size="sm" variant="secondary" onClick={() => open(r)}>
                  {t("products.edit")}
                </Button>
                {r.status === "draft" && (
                  <Button
                    size="sm"
                    disabled={!r.edited_by || r.edited_by === user?.id}
                    loading={approve.isPending}
                    onClick={() => approve.mutate(r.id)}
                  >
                    {t("internalRules.approve")}
                  </Button>
                )}
                {r.status === "draft" && !r.edited_by && (
                  <span className="text-xs text-fg-muted">{t("internalRules.editFirst")}</span>
                )}
                {r.status === "draft" && r.edited_by && r.edited_by === user?.id && (
                  <span className="text-xs text-amber-text" data-testid="author-cannot-approve">
                    {t("companyRules.authorCannotApprove")}
                  </span>
                )}
                <Button size="sm" variant="ghost" onClick={() => archive.mutate(r.id)}>
                  {t("flows.archive")}
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>

      {/* Manual Rule Form Modal / Expand */}
      {edit && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-sunken/40 p-4 shadow-sm">
          <div className="font-semibold text-sm text-fg">
            {edit.id ? "تعديل قاعدة الشركة" : "إضافة قاعدة شركة جديدة"}
          </div>
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr_10rem]">
            <Field label={t("internalRules.code")}>
              <Input
                value={edit.code}
                onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })}
                dir="ltr"
                placeholder="INT-BRAND-01"
              />
            </Field>
            <Field label={t("internalRules.ruleTitle")}>
              <Input
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                placeholder="عنوان القاعدة باللغة العربية"
                dir="auto"
              />
            </Field>
            <Field label={t("internalRules.severity")}>
              <Select
                value={edit.severity}
                onChange={(e) => setEdit({ ...edit, severity: e.target.value })}
              >
                <option value="warning">{t("internalRules.sev.warning")}</option>
                <option value="violation">{t("internalRules.sev.violation")}</option>
              </Select>
            </Field>
          </div>
          <Field label={t("internalRules.instruction")}>
            <Textarea
              rows={2}
              value={edit.instruction}
              onChange={(e) => setEdit({ ...edit, instruction: e.target.value })}
              placeholder="صف بدقة ما يجب فحصه في الإعلان (الشعار، الألوان، المصطلحات، نسب التخفيض، الإخلاء الإلزامي)..."
              dir="auto"
            />
          </Field>
          <DuplicateWarning
            orgId={orgId}
            title={edit.title}
            instruction={edit.instruction}
            exclude={edit.id ?? null}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEdit(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={
                !/^INT-[A-Z0-9-]{2,24}$/.test(edit.code) ||
                !edit.title.trim() ||
                !edit.instruction.trim()
              }
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
