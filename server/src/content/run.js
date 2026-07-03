require('dotenv').config();
const { publishDuePosts } = require('./publisher');

publishDuePosts().then(() => process.exit(0));
