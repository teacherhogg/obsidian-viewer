'use strict';

const { Router } = require('express');
const { stmts } = require('./db');
const { requireAuth } = require('./auth');

const router = Router();

router.use(requireAuth);

router.post('/mark', (req, res) => {
  const { vaultName, docPath } = req.body || {};
  if (!vaultName || !docPath) return res.status(400).json({ error: 'Missing vaultName or docPath' });
  const now = Math.floor(Date.now() / 1000);
  const row = stmts.upsertRead.get(req.user.id, vaultName, docPath, now);
  res.json({ ok: true, readCount: row.read_count, lastRead: row.last_read });
});

router.get('/doc', (req, res) => {
  const { vault, path: docPath } = req.query;
  if (!vault || !docPath) return res.status(400).json({ error: 'Missing vault or path' });
  const row = stmts.getRead.get(req.user.id, vault, docPath);
  if (!row) return res.json({ read: false });
  res.json({ read: true, readCount: row.read_count, lastRead: row.last_read });
});

router.get('/vault', (req, res) => {
  const { vault } = req.query;
  if (!vault) return res.status(400).json({ error: 'Missing vault' });
  const rows = stmts.getReadsByVault.all(req.user.id, vault);
  res.json({ reads: rows.map(r => ({ docPath: r.doc_path, readCount: r.read_count, lastRead: r.last_read })) });
});

module.exports = router;
