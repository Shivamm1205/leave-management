const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { register, login, adminLogin, logout, me } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);              // employees only
router.post('/admin-login', adminLogin);   // admin only
router.post('/logout', logout);
router.get('/me', auth, me);

module.exports = router;