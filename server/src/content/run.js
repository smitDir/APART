require('dotenv').config();
const db = require('../db');
const { publishDuePosts } = require('./publisher');

db.ready
  .then(() => publishDuePosts())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[content/run] failed', err);
    process.exit(1);
  });
