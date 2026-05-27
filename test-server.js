const express = require('express');
const app = express();
app.get('/api/test', (req, res) => res.status(403).json({error: 'test'}));
app.listen(3001, () => {
  fetch('http://localhost:3001/api/test')
    .then(r => r.text())
    .then(console.log)
    .then(() => process.exit(0));
});
