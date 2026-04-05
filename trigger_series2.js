import dotenv from 'dotenv';
dotenv.config();

// Mute console.warn so it doesn't clutter
const warn = console.warn;
console.warn = () => {};

import './api/index.js'; // This executes the file and connects to redis
setTimeout(() => {
  fetch('http://localhost:3001/api/cron/series', {
    headers: { 'Authorization': 'Bearer ' + (process.env.CRON_SECRET || '') }
  }).then(res => res.text()).then(txt => {
    console.log("Result:", txt);
    process.exit(0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}, 1000); // Give express 1 sec to start
