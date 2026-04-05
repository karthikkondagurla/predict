import dotenv from 'dotenv';
dotenv.config();

import app from './api/index.js';
import request from 'supertest';

async function run() {
  const res = await request(app).get('/api/cron/series').set('Authorization', 'Bearer ' + (process.env.CRON_SECRET || ''));
  console.log(res.status, res.text);
  process.exit(0);
}
run();
