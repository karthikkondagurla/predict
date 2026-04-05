import dotenv from 'dotenv';
dotenv.config();
import app from './api/index.js';
const server = app.listen(3001, () => {
  fetch('http://localhost:3001/api/cron/series', {
    headers: { 'Authorization': 'Bearer ' + (process.env.CRON_SECRET || '') }
  }).then(res => res.text()).then(txt => {
    console.log("Result:", txt);
    server.close();
    process.exit(0);
  });
});
