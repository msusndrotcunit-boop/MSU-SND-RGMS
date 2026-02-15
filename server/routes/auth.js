const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  const token = process.env.API_TOKEN || 'dev-token';
  const role = process.env.DEFAULT_ROLE || 'admin';
  const username = (req.body && req.body.username) || 'admin';
  res.json({ token, user: { id: 1, role, username } });
});

module.exports = router;
