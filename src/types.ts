export interface Card {
  id: number;
  characters: string;
  meaning: string;
  pronunciation: string;
  status: number;
  next_review_at: string;
  created_at: string;
}

export interface SRSSettings {
  step: number;
  time_cap_seconds: number;
  interval_hours: number;
}

export type CardSide = 'characters' | 'meaning' | 'pronunciation';

export interface AppConfig {
  frontSides: CardSide[];
  backSides: CardSide[];
  chineseFont: string;
}
