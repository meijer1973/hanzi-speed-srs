import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("flashcards.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    characters TEXT NOT NULL,
    meaning TEXT NOT NULL,
    pronunciation TEXT,
    status INTEGER DEFAULT 0,
    next_review_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS srs_settings (
    step INTEGER PRIMARY KEY,
    time_cap_seconds INTEGER,
    interval_hours INTEGER
  );
`);

// Seed default SRS settings if empty
const srsCount = db.prepare("SELECT COUNT(*) as count FROM srs_settings").get() as { count: number };
if (srsCount.count === 0) {
  const insertSrs = db.prepare("INSERT INTO srs_settings (step, time_cap_seconds, interval_hours) VALUES (?, ?, ?)");
  const defaultSrs = [
    [0, 999, 4],    // Step 0: Any success, 4h
    [1, 8, 12],     // Step 1: < 8s, 12h
    [2, 3, 24],     // Step 2: < 3s, 24h
    [3, 2, 48],     // Step 3: < 2s, 2 days
    [4, 1, 72],     // Step 4: < 1s, 3 days
    [5, 1, 72],     // Step 5: < 1s, 3 days
    [6, 1, 168],    // Step 6: < 1s, 7 days
    [7, 1, 336],    // Step 7: < 1s, 14 days
    [8, 1, 720],    // Step 8: < 1s, 30 days
  ];
  defaultSrs.forEach(s => insertSrs.run(s[0], s[1], s[2]));
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/cards", (req, res) => {
    const cards = db.prepare("SELECT * FROM cards ORDER BY created_at DESC").all();
    res.json(cards);
  });

  app.get("/api/cards/due", (req, res) => {
    const cards = db.prepare("SELECT * FROM cards WHERE next_review_at <= CURRENT_TIMESTAMP ORDER BY next_review_at ASC").all();
    res.json(cards);
  });

  app.post("/api/cards", (req, res) => {
    const { characters, meaning, pronunciation } = req.body;
    const info = db.prepare("INSERT INTO cards (characters, meaning, pronunciation) VALUES (?, ?, ?)").run(characters, meaning, pronunciation);
    res.json({ id: info.lastInsertRowid });
  });

  app.post("/api/cards/import", (req, res) => {
    const { cards } = req.body; // Array of {characters, meaning, pronunciation}
    const insert = db.prepare("INSERT INTO cards (characters, meaning, pronunciation) VALUES (?, ?, ?)");
    const insertMany = db.transaction((items) => {
      for (const item of items) insert.run(item.characters, item.meaning, item.pronunciation);
    });
    insertMany(cards);
    res.json({ success: true });
  });

  app.put("/api/cards/:id/review", (req, res) => {
    const { id } = req.params;
    const { timeTaken, success } = req.body;
    
    const card = db.prepare("SELECT * FROM cards WHERE id = ?").get(id) as any;
    if (!card) return res.status(404).json({ error: "Card not found" });

    const srs = db.prepare("SELECT * FROM srs_settings WHERE step = ?").get(card.status) as any;
    
    let newStatus = card.status;
    let intervalHours = 4;

    const maxStepSetting = db.prepare("SELECT MAX(step) as maxStep FROM srs_settings").get() as any;
    const lastSrs = db.prepare("SELECT * FROM srs_settings WHERE step = ?").get(maxStepSetting.maxStep) as any;
    const currentSrs = srs || lastSrs;

    if (success && timeTaken <= currentSrs.time_cap_seconds) {
      newStatus = card.status + 1;
      const nextSrs = db.prepare("SELECT * FROM srs_settings WHERE step = ?").get(newStatus) as any;
      if (nextSrs) {
        intervalHours = nextSrs.interval_hours;
      } else {
        intervalHours = Math.round(currentSrs.interval_hours * 1.5);
      }
    } else {
      // Failed: either wrong or too slow
      newStatus = Math.max(0, card.status - 1);
      const resetSrs = db.prepare("SELECT * FROM srs_settings WHERE step = ?").get(newStatus) as any;
      intervalHours = resetSrs ? resetSrs.interval_hours : 4;
    }

    const nextReview = new Date();
    nextReview.setHours(nextReview.getHours() + intervalHours);

    db.prepare("UPDATE cards SET status = ?, next_review_at = ? WHERE id = ?")
      .run(newStatus, nextReview.toISOString(), id);

    res.json({ newStatus, nextReview: nextReview.toISOString() });
  });

  app.get("/api/srs-settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM srs_settings ORDER BY step ASC").all();
    res.json(settings);
  });

  app.put("/api/srs-settings", (req, res) => {
    const { settings } = req.body; // Array of {step, time_cap_seconds, interval_hours}
    const update = db.prepare("INSERT OR REPLACE INTO srs_settings (step, time_cap_seconds, interval_hours) VALUES (?, ?, ?)");
    const updateMany = db.transaction((items) => {
      for (const item of items) update.run(item.step, item.time_cap_seconds, item.interval_hours);
    });
    updateMany(settings);
    res.json({ success: true });
  });

  app.delete("/api/cards/:id", (req, res) => {
    db.prepare("DELETE FROM cards WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
