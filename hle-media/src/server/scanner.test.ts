import { describe, expect, test } from "bun:test";
import { parsePath } from "./scanner-parse";

describe("parsePath", () => {
  test("movie at top level with year folder", () => {
    expect(
      parsePath("Movies/Inception (2010)/Inception (2010).mkv"),
    ).toEqual({ kind: "movie", title: "Inception", year: 2010 });
  });

  test("movie at top level with bracket year", () => {
    expect(parsePath("Movies/Heat [1995].mp4")).toEqual({
      kind: "movie",
      title: "Heat",
      year: 1995,
    });
  });

  test("movie with no year", () => {
    expect(parsePath("Movies/Some Indie Film.mp4")).toEqual({
      kind: "movie",
      title: "Some Indie Film",
      year: null,
    });
  });

  test("movie when only the file is present (no parent folder)", () => {
    expect(parsePath("Up (2009).mp4")).toEqual({
      kind: "movie",
      title: "Up",
      year: 2009,
    });
  });

  test("episode with SxxExx and Season folder", () => {
    expect(
      parsePath(
        "Shows/Breaking Bad/Season 01/Breaking Bad - S01E02 - Cat in the Bag.mkv",
      ),
    ).toEqual({
      kind: "episode",
      seriesTitle: "Breaking Bad",
      seriesYear: null,
      season: 1,
      episode: 2,
      episodeTitle: "Cat in the Bag",
    });
  });

  test("episode with NxN format", () => {
    expect(
      parsePath("TV/The Office/Season 03/The Office - 3x14 - The Return.mp4"),
    ).toEqual({
      kind: "episode",
      seriesTitle: "The Office",
      seriesYear: null,
      season: 3,
      episode: 14,
      episodeTitle: "The Return",
    });
  });

  test("episode with year on the series folder", () => {
    expect(
      parsePath(
        "Shows/Battlestar Galactica (2003)/Season 02/Battlestar Galactica (2003) - S02E04.mkv",
      ),
    ).toEqual({
      kind: "episode",
      seriesTitle: "Battlestar Galactica",
      seriesYear: 2003,
      season: 2,
      episode: 4,
      episodeTitle: null,
    });
  });

  test("episode with no episode title", () => {
    expect(
      parsePath("Shows/Foo/Season 02/Foo S02E10.mp4"),
    ).toEqual({
      kind: "episode",
      seriesTitle: "Foo",
      seriesYear: null,
      season: 2,
      episode: 10,
      episodeTitle: null,
    });
  });

  test("season number from filename when no Season folder present", () => {
    // Edge case: top-level "Shows" but no Season folder. Pull season from
    // the filename's SxxExx marker.
    expect(
      parsePath("Shows/My Show/My Show - S05E12 - Finale.mp4"),
    ).toEqual({
      kind: "episode",
      seriesTitle: "My Show",
      seriesYear: null,
      season: 5,
      episode: 12,
      episodeTitle: "Finale",
    });
  });

  test("returns null for empty path", () => {
    expect(parsePath("")).toBeNull();
  });
});
