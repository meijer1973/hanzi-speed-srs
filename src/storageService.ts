import { Card, SRSSettings, AppConfig } from './types';

const STORAGE_KEYS = {
  CARDS: 'hanzi_srs_cards',
  SRS_SETTINGS: 'hanzi_srs_settings',
  CONFIG: 'hanzi_srs_config'
};

const DEFAULT_SRS: SRSSettings[] = [
  { step: 0, time_cap_seconds: 999, interval_hours: 4 },
  { step: 1, time_cap_seconds: 8, interval_hours: 12 },
  { step: 2, time_cap_seconds: 3, interval_hours: 24 },
  { step: 3, time_cap_seconds: 2, interval_hours: 48 },
  { step: 4, time_cap_seconds: 1, interval_hours: 72 },
  { step: 5, time_cap_seconds: 1, interval_hours: 72 },
  { step: 6, time_cap_seconds: 1, interval_hours: 168 },
  { step: 7, time_cap_seconds: 1, interval_hours: 336 },
  { step: 8, time_cap_seconds: 1, interval_hours: 720 },
];

export const storageService = {
  getCards: (): Card[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CARDS);
    return data ? JSON.parse(data) : [];
  },

  saveCards: (cards: Card[]) => {
    localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(cards));
  },

  getDueCards: (): Card[] => {
    const now = new Date();
    return storageService.getCards().filter(card => new Date(card.next_review_at) <= now);
  },

  addCard: (card: Omit<Card, 'id' | 'status' | 'next_review_at' | 'created_at'>) => {
    const cards = storageService.getCards();
    const newCard: Card = {
      ...card,
      id: Date.now(),
      status: 0,
      next_review_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    storageService.saveCards([newCard, ...cards]);
    return newCard;
  },

  importCards: (newItems: Omit<Card, 'id' | 'status' | 'next_review_at' | 'created_at'>[]) => {
    const cards = storageService.getCards();
    const prepared = newItems.map(item => ({
      ...item,
      id: Date.now() + Math.random(),
      status: 0,
      next_review_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }));
    storageService.saveCards([...prepared, ...cards]);
  },

  deleteCard: (id: number) => {
    const cards = storageService.getCards();
    storageService.saveCards(cards.filter(c => c.id !== id));
  },

  reviewCard: (id: number, timeTaken: number, success: boolean) => {
    const cards = storageService.getCards();
    const srsSettings = storageService.getSRSSettings();
    const cardIdx = cards.findIndex(c => c.id === id);
    if (cardIdx === -1) return;

    const card = cards[cardIdx];
    const currentSrs = srsSettings.find(s => s.step === card.status) || srsSettings[srsSettings.length - 1];

    let newStatus = card.status;
    let intervalHours = 4;

    if (success && timeTaken <= currentSrs.time_cap_seconds) {
      newStatus = card.status + 1;
      const nextSrs = srsSettings.find(s => s.step === newStatus);
      if (nextSrs) {
        intervalHours = nextSrs.interval_hours;
      } else {
        intervalHours = Math.round(currentSrs.interval_hours * 1.5);
      }
    } else {
      newStatus = Math.max(0, card.status - 1);
      const resetSrs = srsSettings.find(s => s.step === newStatus);
      intervalHours = resetSrs ? resetSrs.interval_hours : 4;
    }

    const nextReview = new Date();
    nextReview.setHours(nextReview.getHours() + intervalHours);

    cards[cardIdx] = {
      ...card,
      status: newStatus,
      next_review_at: nextReview.toISOString()
    };

    storageService.saveCards(cards);
    return cards[cardIdx];
  },

  getSRSSettings: (): SRSSettings[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SRS_SETTINGS);
    return data ? JSON.parse(data) : DEFAULT_SRS;
  },

  saveSRSSettings: (settings: SRSSettings[]) => {
    localStorage.setItem(STORAGE_KEYS.SRS_SETTINGS, JSON.stringify(settings));
  },

  getConfig: (): AppConfig => {
    const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
    return data ? JSON.parse(data) : {
      frontSides: ['characters'],
      backSides: ['meaning', 'pronunciation'],
      chineseFont: 'font-standard'
    };
  },

  saveConfig: (config: AppConfig) => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  }
};
