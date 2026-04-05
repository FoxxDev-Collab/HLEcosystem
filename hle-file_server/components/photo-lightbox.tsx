"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";

type LightboxFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdAt?: string;
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

  if (!open || !file) return null;

  const content = (
    <div className="fixed inset-0 z-50 lightbox-backdrop flex flex-col" onClick={onClose}>
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
            {file.createdAt && (
              <p className="text-white/50 text-xs">{formatDateLong(file.createdAt)}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isVideo && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
              >
                <ZoomOut className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/70 hover:text-white hover:bg-white/10"
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

        {/* Info panel */}
        {showInfo && (
          <div
            className="absolute right-0 top-0 bottom-0 w-80 bg-black/60 backdrop-blur-xl border-l border-white/10 p-6 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white/90 font-semibold text-sm mb-4">Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Filename</p>
                <p className="text-white/80 break-all">{file.name}</p>
              </div>
              {file.size && (
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Size</p>
                  <p className="text-white/80">{formatFileSize(BigInt(file.size))}</p>
                </div>
              )}
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Type</p>
                <p className="text-white/80">{file.mimeType}</p>
              </div>
              {file.createdAt && (
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Uploaded</p>
                  <p className="text-white/80">{formatDateLong(file.createdAt)}</p>
                </div>
              )}
            </div>
          </div>
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
