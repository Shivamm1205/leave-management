const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const uploadFiles = require('../middleware/upload');
const {
  uploadDrafts, listDrafts, downloadAttachment, deleteAttachment,
} = require('../controllers/attachmentController');

router.post('/', auth, uploadFiles, uploadDrafts);   // upload before applying
router.get('/draft', auth, listDrafts);               // my unused uploads
router.get('/:id/download', auth, downloadAttachment);
router.delete('/:id', auth, deleteAttachment);

module.exports = router;