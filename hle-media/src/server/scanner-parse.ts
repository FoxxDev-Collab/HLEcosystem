import path from "node:path";

// File extensions we treat as video files. Anything else in the library
// is silently ignored (poster art, NFO, subtitles, etc.).
export const VIDEO_EXTS = new Set([
  ".mp4", ".mkv", ".mov", ".m4v", ".avi", ".webm", ".ts", ".mpg", ".mpeg",
]);

// Top-level folder names that hint at the library layout. Plex/Jellyfin
// conventions. Anything else is parsed by content (presence of "Season N").
const SERIES_DIR_RE = /^(shows?|tv|tv shows?|series)$/i;
const MOVIE_DIR_RE = /^movies?$/i;

const TITLE_YEAR_RE = /^(.+?)\s*[\(\[](\d{4})[\)\]]\s*$/;
const EP_RE_SE = /S(\d{1,2})E(\d{1,3})/i;
const EP_RE_X = /\b(\d{1,2})x(\d{1,3})\b/;
const SEASON_DIR_RE = /^season\s*(\d+)$/i;

export type ParsedMovie = {
  kind: "movie";
  title: string;
  year: number | null;
};

export type ParsedEpisode = {
  kind: "episode";
  seriesTitle: string;
  seriesYear: number | null;
  season: number;
  episode: number;
  episodeTitle: string | null;
};

export type Parsed = ParsedMovie | ParsedEpisode | null;

function extractTitleYear(s: string): { title: string; year: number | null } {
  const m = s.match(TITLE_YEAR_RE);
  if (m && m[1] && m[2]) return { title: m[1].trim(), year: Number(m[2]) };
  return { title: s.trim(), year: null };
}

export function parsePath(relPath: string): Parsed {
  const parts = relPath.split(path.sep).filter(Boolean);
  if (parts.length === 0) return null;
  const fileName = parts[parts.length - 1] ?? "";
  const baseName = fileName.replace(/\.[^.]+$/, "");

  // Series detection: any segment matches "Season N", or the top-level folder
  // names a series category and the file has an SxxExx / NxN marker.
  const seasonIdx = parts.findIndex((p) => SEASON_DIR_RE.test(p));
  const isSeriesByDir = parts[0] !== undefined && SERIES_DIR_RE.test(parts[0]);

  if (seasonIdx !== -1 || isSeriesByDir) {
    let seriesFolder: string | undefined;
    let seasonFromDir: number | null = null;
    if (seasonIdx > 0) {
      seriesFolder = parts[seasonIdx - 1];
      const sm = parts[seasonIdx]?.match(SEASON_DIR_RE);
      if (sm) seasonFromDir = Number(sm[1]);
    } else if (isSeriesByDir && parts.length >= 3) {
      seriesFolder = parts[1];
    }
    if (!seriesFolder) return null;

    const epMatch = baseName.match(EP_RE_SE) ?? baseName.match(EP_RE_X);
    if (!epMatch) return null;
    const seasonNum = seasonFromDir ?? Number(epMatch[1]);
    const episodeNum = Number(epMatch[2]);

    const series = extractTitleYear(seriesFolder);
    const idx = baseName.indexOf(epMatch[0]);
    const after = idx >= 0 ? baseName.slice(idx + epMatch[0].length) : "";
    const epTitle = after.replace(/^[\s\-_.]+/, "").trim() || null;

    return {
      kind: "episode",
      seriesTitle: series.title,
      seriesYear: series.year,
      season: seasonNum,
      episode: episodeNum,
      episodeTitle: epTitle,
    };
  }

  // Movie: prefer the parent folder name (e.g. "Inception (2010)/Inception (2010).mkv");
  // fall back to the bare filename. Skip the parent if it is itself a category
  // folder ("Movies/").
  const parentFolder = parts.length >= 2 ? parts[parts.length - 2] : "";
  const sourceForTitle =
    parentFolder && !MOVIE_DIR_RE.test(parentFolder) ? parentFolder : baseName;
  const m = extractTitleYear(sourceForTitle);
  return { kind: "movie", title: m.title, year: m.year };
}
