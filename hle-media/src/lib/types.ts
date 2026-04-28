// Client-side mirrors of the server types in src/server/library.ts.
// Kept duplicated rather than imported so the bundler never accidentally
// pulls server code into the client bundle.

export type LibraryItem =
  | {
      kind: "movie";
      id: string;
      title: string;
      year: number | null;
      posterPath: string | null;
      contentRating: string | null;
      durationSec: number | null;
    }
  | {
      kind: "series";
      id: string;
      title: string;
      year: number | null;
      posterPath: string | null;
      contentRating: string | null;
      episodeCount: number;
    };

export type MovieDetail = {
  id: string;
  title: string;
  year: number | null;
  synopsis: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  durationSec: number | null;
  contentRating: string | null;
  tmdbId: number | null;
  mediaFileId: string | null;
};

export type SeriesEpisode = {
  id: string;
  number: number;
  title: string;
  synopsis: string | null;
  durationSec: number | null;
  mediaFileId: string | null;
  airDate: string | null;
};

export type SeriesSeason = {
  id: string;
  number: number;
  title: string | null;
  posterPath: string | null;
  episodes: SeriesEpisode[];
};

export type SeriesDetail = {
  id: string;
  title: string;
  year: number | null;
  synopsis: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  contentRating: string | null;
  tmdbId: number | null;
  seasons: SeriesSeason[];
};

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MEMBER";
};

export type Household = { id: string; name: string };
