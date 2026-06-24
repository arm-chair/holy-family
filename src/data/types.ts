export type OptionKind = "reading" | "hymn" | "psalm" | "detail";

export type Rating = "up" | "down";

export interface ReadingText {
  id: string;
  title: string;
  book: string;
  citation: string;
  text: string;
}

export interface ChoiceOption {
  id: string;
  title: string;
  kind: OptionKind;
  citation?: string;
  originalLabel?: string;
  note?: string;
  reading?: ReadingText;
  searchTerms?: string;
  youtubeVideoId?: string;
}

export interface ChoiceSet {
  id: string;
  title: string;
  section: string;
  kind: OptionKind;
  description?: string;
  required: boolean;
  options: ChoiceOption[];
}
