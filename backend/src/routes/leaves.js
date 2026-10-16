const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const c = require('../controllers/leaveController');
const uploadFiles = require('../middleware/upload');
const { uploadAttachments, listAttachments } = require('../controllers/attachmentController');

// Employee
router.post('/', auth, c.applyLeave);
router.get('/my', auth, c.getMyLeaves);
router.get('/balance', auth, c.getBalance);
router.put('/:id/cancel', auth, c.cancelLeave);

// Files of a leave
router.post('/:id/attachments', auth, uploadFiles, uploadAttachments);
router.get('/:id/attachments', auth, listAttachments);

// Admin only
router.get('/', auth, adminOnly, c.getAllLeaves);
router.put('/:id/approve', auth, adminOnly, c.approveLeave);
router.put('/:id/reject', auth, adminOnly, c.rejectLeave);

module.exports = router;