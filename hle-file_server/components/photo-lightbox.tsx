"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFileSize, formatDateLong } from "@/lib/format";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Camera,
} from "lucide-react";

type LightboxFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdAt?: string;
  effectiveDate?: string;
  dateTaken?: string | null;
  cameraMake?: string | null;
  cameraModel?: string | null;
  width?: number | null;
  height?: number | null;
};

type PhotoLightboxProps = {
  files: LightboxFile[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
};

export function PhotoLightbox({ files, initialIndex, open, onClose }: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showInfo, setShowInfo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const file = files[currentIndex];
  const isVideo = file?.mimeType.startsWith("video/");

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setZoom(1);
    setRotation(0);
  }, [initialIndex]);

  const goNext = useCallback(() => {
    if (currentIndex < files.length - 1) {
      setCurrentIndex((i) => i + 1);
      setZoom(1);
      setRotation(0);
    }
  }, [currentIndex, files.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setZoom(1);
      setRotation(0);
    }
  }, [currentIndex]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowRight":
          goNext();
          break;
        case "ArrowLeft":
          goPrev();
          break;
        case "i":
          setShowInfo((v) => !v);
          break;
        case "+":
        case "=":
          setZoom((z) => Math.min(z + 0.25, 4));
          break;
        case "-":
          setZoom((z) => Math.max(z - 0.25, 0.5));
          break;
        case "r":
          setRotation((r) => (r + 90) % 360);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, goNext, goPrev, onClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      touchStartX.current = null;
      touchStartY.current = null;

      // Only treat as horizontal swipe if horizontal movement dominates
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) goNext();
      else goPrev();
    },
    [goNext, goPrev]
  );

  if (!open || !file) return null;

  const displayDate = file.dateTaken ?? file.effectiveDate ?? file.createdAt;
  const cameraLabel = [file.cameraMake, file.cameraModel].filter(Boolean).join(" ") || null;

  const infoRows: { label: string; value: string }[] = [
    { label: "Filename", value: file.name },
    ...(file.size ? [{ label: "Size", value: formatFileSize(BigInt(file.size)) }] : []),
    { label: "Type", value: file.mimeType },
    ...(displayDate ? [{ label: file.dateTaken ? "Date taken" : "Uploaded", value: formatDateLong(displayDate) }] : []),
    ...(file.createdAt && file.dateTaken ? [{ label: "Uploaded", value: formatDateLong(file.createdAt) }] : []),
    ...(cameraLabel ? [{ label: "Camera", value: cameraLabel }] : []),
    ...(file.width && file.height ? [{ label: "Dimensions", value: `${file.width} × ${file.height}` }] : []),
  ];

  const content = (
    <div
      className="fixed inset-0 z-50 lightbox-backdrop flex flex-col"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="text-white/80 hover:text-white hover:bg-white/10 shrink-0"
            onClick={onClose}
          >
            <X className="size-5" />
          </Button>
          <div className="min-w-0">
            <p className="text-white/90 text-sm font-medium truncate">{file.name}</p>
            {displayDate && (
              <p className="text-white/50 text-xs">{formatDateLong(displayDate)}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isVideo && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/70 hover:text-white hover:bg-white/10 hidden sm:flex"
                onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/70 hover:text-white hover:bg-white/10 hidden sm:flex"
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
              >
                <ZoomOut className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/70 hover:text-white hover:bg-white/10 hidden sm:flex"
                onClick={() => setRotation((r) => (r + 90) % 360)}
              >
                <RotateCw className="size-4" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => setShowInfo((v) => !v)}
          >
            <Info className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:text-white hover:bg-white/10"
            asChild
          >
            <a href={`/api/files/download/${file.id}`}>
              <Download className="size-4" />
            </a>
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 group">
        {/* Previous button */}
        {currentIndex > 0 && (
          <button
            className="absolute left-2 sm:left-4 z-10 flex items-center justify-center size-10 rounded-full bg-black/50 text-white/90 hover:bg-black/70 hover:text-white transition-all"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
          >
            <ChevronLeft className="size-6" />
          </button>
        )}

        {/* Image/Video */}
        <div
          className="max-w-full max-h-full flex items-center justify-center p-2 sm:p-4"
          onClick={(e) => e.stopPropagation()}
          style={isVideo ? undefined : {
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: "transform 0.2s cubic-bezier(0.2, 0, 0, 1)",
          }}
        >
          {isVideo ? (
            <video
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="w-full max-w-[95vw] sm:max-w-[90vw] max-h-[75vh] sm:max-h-[80vh] rounded-lg"
              key={file.id}
            >
              <source src={`/api/files/serve/${file.id}`} type={file.mimeType} />
            </video>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/files/serve/${file.id}`}
              alt={file.name}
              className="max-w-[95vw] sm:max-w-[90vw] max-h-[75vh] sm:max-h-[80vh] object-contain select-none"
              draggable={false}
              key={file.id}
            />
          )}
        </div>

        {/* Next button */}
        {currentIndex < files.length - 1 && (
          <button
            className="absolute right-2 sm:right-4 z-10 flex items-center justify-center size-10 rounded-full bg-black/50 text-white/90 hover:bg-black/70 hover:text-white transition-all"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
          >
            <ChevronRight className="size-6" />
          </button>
        )}

        {/* Info panel — side panel on md+, bottom sheet on mobile */}
        {showInfo && (
          <>
            {/* Desktop: right side panel */}
            <div
              className="hidden md:block absolute right-0 top-0 bottom-0 w-72 bg-black/70 backdrop-blur-xl border-l border-white/10 p-5 overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <InfoContent infoRows={infoRows} cameraLabel={cameraLabel} />
            </div>

            {/* Mobile: bottom sheet */}
            <div
              className="md:hidden absolute left-0 right-0 bottom-0 bg-black/80 backdrop-blur-xl border-t border-white/10 rounded-t-2xl p-5 max-h-[60vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white/90 font-semibold text-sm">Details</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setShowInfo(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <InfoContent infoRows={infoRows} cameraLabel={cameraLabel} />
            </div>
          </>
        )}
      </div>

      {/* Bottom bar — counter */}
      <div className="flex items-center justify-center py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Badge variant="secondary" className="bg-black/40 text-white/70 border-white/10">
          {currentIndex + 1} / {files.length}
        </Badge>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(content, document.body);
}

function InfoContent({
  infoRows,
  cameraLabel,
}: {
  infoRows: { label: string; value: string }[];
  cameraLabel: string | null;
}) {
  return (
    <div className="space-y-3 text-sm">
      {infoRows.map((row) => (
        <div key={row.label}>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">{row.label}</p>
          <p className="text-white/80 break-all flex items-center gap-1.5">
            {row.label === "Camera" && <Camera className="size-3 shrink-0 text-white/40" />}
            {row.value}
          </p>
        </div>
      ))}
      {!cameraLabel && (
        <p className="text-white/30 text-xs italic">No EXIF metadata available</p>
      )}
    </div>
  );
}
