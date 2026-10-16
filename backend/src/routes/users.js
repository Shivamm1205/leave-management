const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const uploadPhotoFile = require('../middleware/uploadPhoto');
const { getMe, updateMe } = require('../controllers/userController');
const { savePhoto, getPhoto, removePhoto } = require('../controllers/photoController');

router.get('/me', auth, getMe);
router.put('/me', auth, updateMe);

// Profile photo
router.get('/me/photo', auth, getPhoto);
router.put('/me/photo', auth, uploadPhotoFile, savePhoto);
router.delete('/me/photo', auth, removePhoto);

module.exports = router;