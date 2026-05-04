'use strict';

const { Router } = require('express');
const { stmts } = require('./db');
const { requireAuth } = require('./auth');
const path = require('path');
const fs = require('fs');

const router = Router();
router.use(requireAuth);

const SETTINGS_PATH = path.join(__dirname, '../quiz-settings.json');

function loadSettings() {
  return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
}

function safeSegment(s) {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
}

function getQuizDir(vaultName, docPath) {
  const dataDir = process.env.MIRAVIEW_DATA_DIR || '/data';
  return path.join(dataDir, 'quizzes', safeSegment(vaultName), safeSegment(docPath));
}

function listQuizFiles(vaultName, docPath) {
  const dir = getQuizDir(vaultName, docPath);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.startsWith('quiz-') && f.endsWith('.json'))
    .sort()
    .reverse(); // newest first
}

// GET /api/quiz/list?vault=X&path=Y
router.get('/list', (req, res) => {
  const { vault, path: docPath } = req.query;
  if (!vault || !docPath) return res.status(400).json({ error: 'Missing vault or path' });

  const files = listQuizFiles(vault, docPath);
  const dir = getQuizDir(vault, docPath);

  const quizzes = files.map(filename => {
    const quizId = filename.replace('quiz-', '').replace('.json', '');
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'));
      return { id: quizId, generatedAt: data.generatedAt, questionCount: data.questions.length };
    } catch {
      return null;
    }
  }).filter(Boolean);

  const history = stmts.getQuizRunHistory.all(req.user.id, vault, docPath);
  const lastRunByQuizId = {};
  for (const r of history) {
    if (!lastRunByQuizId[r.quiz_id]) {
      lastRunByQuizId[r.quiz_id] = { runAt: r.run_at, score: r.score, total: r.total };
    }
  }

  const result = quizzes.map(q => ({ ...q, lastRun: lastRunByQuizId[q.id] || null }));
  res.json({ quizzes: result });
});

// GET /api/quiz?vault=X&path=Y&id=timestamp
router.get('/', (req, res) => {
  const { vault, path: docPath, id } = req.query;
  if (!vault || !docPath || !id) return res.status(400).json({ error: 'Missing vault, path, or id' });

  const filePath = path.join(getQuizDir(vault, docPath), `quiz-${id}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Quiz not found' });

  try {
    res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    res.status(500).json({ error: 'Failed to read quiz file' });
  }
});

// POST /api/quiz/generate — body: { vaultName, docPath, articleText }
router.post('/generate', async (req, res) => {
  const { vaultName, docPath, articleText } = req.body || {};
  if (!vaultName || !docPath || !articleText) {
    return res.status(400).json({ error: 'Missing vaultName, docPath, or articleText' });
  }

  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
    if (Anthropic.default) Anthropic = Anthropic.default;
  } catch {
    return res.status(500).json({ error: 'Anthropic SDK not installed' });
  }

  try {
    const settings = loadSettings();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userPrompt = settings.userPromptTemplate
      .replace('{minQuestions}', settings.minQuestions)
      .replace('{maxQuestions}', settings.maxQuestions)
      .replace('{articleText}', articleText.slice(0, 20000));

    const response = await client.messages.create({
      model: settings.model,
      max_tokens: 4096,
      system: settings.systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0].text.trim();
    // Strip markdown code fences if Claude wrapped the JSON
    const jsonText = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    const parsed = JSON.parse(jsonText);

    const quizId = String(Math.floor(Date.now() / 1000));
    const quiz = { id: quizId, generatedAt: parseInt(quizId), questions: parsed.questions };

    const dir = getQuizDir(vaultName, docPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `quiz-${quizId}.json`), JSON.stringify(quiz, null, 2));

    res.json(quiz);
  } catch (err) {
    console.error('Quiz generation error:', err);
    res.status(500).json({ error: 'Quiz generation failed', detail: err.message });
  }
});

// POST /api/quiz/run — body: { vaultName, docPath, quizId, score, total }
router.post('/run', (req, res) => {
  const { vaultName, docPath, quizId, score, total } = req.body || {};
  if (!vaultName || !docPath || !quizId || score == null || total == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const now = Math.floor(Date.now() / 1000);
  stmts.insertQuizRun.run(req.user.id, vaultName, docPath, quizId, now, score, total);
  res.json({ ok: true, runAt: now, score, total });
});

// GET /api/quiz/status?vault=X&path=Y
router.get('/status', (req, res) => {
  const { vault, path: docPath } = req.query;
  if (!vault || !docPath) return res.status(400).json({ error: 'Missing vault or path' });

  const files = listQuizFiles(vault, docPath);
  const lastRun = stmts.getLastQuizRun.get(req.user.id, vault, docPath);

  res.json({
    hasQuiz: files.length > 0,
    quizCount: files.length,
    lastRun: lastRun ? lastRun.run_at : null,
    lastScore: lastRun ? lastRun.score : null,
    lastTotal: lastRun ? lastRun.total : null,
  });
});

module.exports = router;
