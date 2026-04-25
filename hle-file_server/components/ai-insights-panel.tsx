"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Tag,
  FileText,
  Hash,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  suggestTagsAction,
  generateSummaryAction,
  extractDocumentMetadataAction,
  applyTagSuggestionsAction,
  saveDescriptionAction,
  renameFileAction,
  type TagSuggestion,
} from "@/app/(app)/my-files/[fileId]/actions";

type SummaryData = { summary: string; keyPoints: string[] };
type MetadataData = {
  correspondent: string | null;
  date: string | null;
  title: string;
  referenceNumbers: string[];
};
type ActiveSection = "tags" | "summary" | "metadata" | null;

const SUMMARIZABLE = ["pdf", "text", "document", "code", "spreadsheet"];

export function AiInsightsPanel({
  fileId,
  category,
  hasContent,
}: {
  fileId: string;
  category: string;
  hasContent: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState<ActiveSection>(null);

  // Tags
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[] | null>(null);
  const [tagReasoning, setTagReasoning] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [tagError, setTagError] = useState<string | null>(null);
  const [isPendingTags, startTagsTransition] = useTransition();
  const [isApplyingTags, startApplyTagsTransition] = useTransition();

  // Summary
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isPendingSummary, startSummaryTransition] = useTransition();
  const [isSavingSummary, startSaveSummaryTransition] = useTransition();
  const [summarySaved, setSummarySaved] = useState(false);

  // Metadata
  const [metadataData, setMetadataData] = useState<MetadataData | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [isPendingMetadata, startMetadataTransition] = useTransition();
  const [isApplyingTitle, startApplyTitleTransition] = useTransition();
  const [titleApplied, setTitleApplied] = useState(false);

  const canSummarize = hasContent && SUMMARIZABLE.includes(category);
  const canExtract = hasContent;

  const toggle = (section: NonNullable<ActiveSection>) =>
    setActive((prev) => (prev === section ? null : section));

  const handleFetchTags = () => {
    setTagError(null);
    setTagSuggestions(null);
    setSelectedTags(new Set());
    startTagsTransition(async () => {
      const result = await suggestTagsAction(fileId);
      if ("error" in result) {
        setTagError(result.error);
      } else {
        setTagSuggestions(result.suggestions);
        setTagReasoning(result.reasoning);
        setSelectedTags(new Set(result.suggestions.map((s) => s.name)));
      }
    });
  };

  const handleApplyTags = () => {
    startApplyTagsTransition(async () => {
      const result = await applyTagSuggestionsAction(fileId, Array.from(selectedTags));
      if ("error" in result) {
        setTagError(result.error);
      } else {
        setTagSuggestions(null);
        router.refresh();
      }
    });
  };

  const toggleTag = (name: string) =>
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const handleFetchSummary = () => {
    setSummaryError(null);
    setSummaryData(null);
    setSummarySaved(false);
    startSummaryTransition(async () => {
      const result = await generateSummaryAction(fileId);
      if ("error" in result) {
        setSummaryError(result.error);
      } else {
        setSummaryData(result);
      }
    });
  };

  const handleSaveSummary = () => {
    if (!summaryData) return;
    startSaveSummaryTransition(async () => {
      const result = await saveDescriptionAction(fileId, summaryData.summary);
      if ("error" in result) {
        setSummaryError(result.error);
      } else {
        setSummarySaved(true);
        router.refresh();
      }
    });
  };

  const handleFetchMetadata = () => {
    setMetadataError(null);
    setMetadataData(null);
    setTitleApplied(false);
    startMetadataTransition(async () => {
      const result = await extractDocumentMetadataAction(fileId);
      if ("error" in result) {
        setMetadataError(result.error);
      } else {
        setMetadataData(result);
      }
    });
  };

  const handleApplyTitle = () => {
    if (!metadataData?.title) return;
    startApplyTitleTransition(async () => {
      const result = await renameFileAction(fileId, metadataData.title);
      if ("error" in result) {
        setMetadataError(result.error);
      } else {
        setTitleApplied(true);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium mb-2">
        <Sparkles className="size-4 text-violet-500" />
        AI Insights
      </div>

      {/* Tag Suggestions */}
      <SectionWrapper
        icon={<Tag className="size-3.5" />}
        label="Tag Suggestions"
        open={active === "tags"}
        onToggle={() => toggle("tags")}
      >
        {!tagSuggestions && !isPendingTags && (
          <Button size="sm" variant="outline" className="w-full" onClick={handleFetchTags}>
            <Sparkles className="size-3.5 mr-1.5" />
            Suggest Tags
          </Button>
        )}
        {isPendingTags && <PendingState label="Analyzing…" />}
        {tagError && <ErrorText>{tagError}</ErrorText>}
        {tagSuggestions && (
          <div className="space-y-2">
            {tagSuggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No tags suggested</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {tagSuggestions.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => toggleTag(s.name)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors",
                        selectedTags.has(s.name)
                          ? "bg-violet-100 border-violet-300 text-violet-800 dark:bg-violet-900/30 dark:border-violet-600 dark:text-violet-300"
                          : "bg-transparent border-muted-foreground/30 text-muted-foreground"
                      )}
                    >
                      {selectedTags.has(s.name) && <Check className="size-2.5" />}
                      {s.name}
                      {!s.tagId && <span className="opacity-50 text-[10px]">new</span>}
                    </button>
                  ))}
                </div>
                {tagReasoning && (
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    {tagReasoning}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleApplyTags}
                    disabled={selectedTags.size === 0 || isApplyingTags}
                  >
                    {isApplyingTags && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                    Apply {selectedTags.size} Tag{selectedTags.size !== 1 ? "s" : ""}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleFetchTags}
                    disabled={isPendingTags}
                  >
                    Retry
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </SectionWrapper>

      {/* Summary */}
      {canSummarize && (
        <SectionWrapper
          icon={<FileText className="size-3.5" />}
          label="Summary"
          open={active === "summary"}
          onToggle={() => toggle("summary")}
        >
          {!summaryData && !isPendingSummary && (
            <Button size="sm" variant="outline" className="w-full" onClick={handleFetchSummary}>
              <Sparkles className="size-3.5 mr-1.5" />
              Generate Summary
            </Button>
          )}
          {isPendingSummary && <PendingState label="Summarizing…" />}
          {summaryError && <ErrorText>{summaryError}</ErrorText>}
          {summaryData && (
            <div className="space-y-2">
              <p className="text-xs text-foreground leading-relaxed">{summaryData.summary}</p>
              {summaryData.keyPoints.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-1">
                  {summaryData.keyPoints.map((point, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="shrink-0 text-muted-foreground/60">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  variant={summarySaved ? "outline" : "default"}
                  onClick={handleSaveSummary}
                  disabled={isSavingSummary || summarySaved}
                >
                  {isSavingSummary && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                  {summarySaved ? "Saved" : "Save as Description"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleFetchSummary}
                  disabled={isPendingSummary}
                >
                  Retry
                </Button>
              </div>
            </div>
          )}
        </SectionWrapper>
      )}

      {/* Metadata Extraction */}
      {canExtract && (
        <SectionWrapper
          icon={<Hash className="size-3.5" />}
          label="Extract Info"
          open={active === "metadata"}
          onToggle={() => toggle("metadata")}
        >
          {!metadataData && !isPendingMetadata && (
            <Button size="sm" variant="outline" className="w-full" onClick={handleFetchMetadata}>
              <Sparkles className="size-3.5 mr-1.5" />
              Extract Info
            </Button>
          )}
          {isPendingMetadata && <PendingState label="Extracting…" />}
          {metadataError && <ErrorText>{metadataError}</ErrorText>}
          {metadataData && (
            <div className="space-y-3">
              <dl className="text-xs space-y-2">
                {metadataData.title && (
                  <MetaRow label="Suggested title" value={metadataData.title} />
                )}
                {metadataData.correspondent && (
                  <MetaRow label="From" value={metadataData.correspondent} />
                )}
                {metadataData.date && (
                  <MetaRow label="Date" value={metadataData.date} />
                )}
                {metadataData.referenceNumbers.length > 0 && (
                  <div>
                    <dt className="text-muted-foreground mb-1">References</dt>
                    <dd className="flex flex-wrap gap-1">
                      {metadataData.referenceNumbers.map((ref) => (
                        <Badge key={ref} variant="outline" className="text-xs font-mono">
                          {ref}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
              {metadataData.title && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    variant={titleApplied ? "outline" : "default"}
                    onClick={handleApplyTitle}
                    disabled={isApplyingTitle || titleApplied}
                  >
                    {isApplyingTitle && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                    {titleApplied ? "Renamed" : "Apply as Filename"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleFetchMetadata}
                    disabled={isPendingMetadata}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>
          )}
        </SectionWrapper>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionWrapper({
  icon,
  label,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-muted/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{label}</span>
        </div>
        {open ? (
          <ChevronUp className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          <Separator />
          {children}
        </div>
      )}
    </div>
  );
}

function PendingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-destructive">{children}</p>;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
