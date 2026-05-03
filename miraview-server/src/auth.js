'use strict';

const crypto = require('crypto');
const { Router } = require('express');
const { stmts } = require('./db');

const router = Router();

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.session;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const session = stmts.getSession.get(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  req.user = { id: session.user_id, username: session.username };
  next();
}

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
};

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: 'Missing credentials' });
  const user = stmts.getUserByUsername.get(username);
  if (!user || user.password !== password) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  const token = crypto.randomBytes(32).toString('hex');
  stmts.insertSession.run(token, user.id, Math.floor(Date.now() / 1000));
  res.cookie('session', token, COOKIE_OPTS);
  res.json({ ok: true, username: user.username });
});

router.post('/logout', (req, res) => {
  const token = req.cookies && req.cookies.session;
  if (token) stmts.deleteSession.run(token);
  res.clearCookie('session', { path: '/' });
  res.json({ ok: true });
});

router.get('/status', (req, res) => {
  const token = req.cookies && req.cookies.session;
  if (!token) return res.json({ loggedIn: false });
  const session = stmts.getSession.get(token);
  if (!session) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, username: session.username });
});

module.exports = { router, requireAuth };
