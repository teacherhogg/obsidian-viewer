'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const { bootstrapUsers } = require('./db');
const { router: authRouter } = require('./auth');
const readsRouter = require('./reads');
const quizRouter = require('./quiz');

bootstrapUsers();

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRouter);
app.use('/api/reads', readsRouter);
app.use('/api/quiz', quizRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

const port = parseInt(process.env.API_INTERNAL_PORT || '3001', 10);
app.listen(port, () => console.log(`miraview-server listening on :${port}`));
