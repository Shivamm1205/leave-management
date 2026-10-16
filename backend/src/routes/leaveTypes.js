const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deactivateLeaveType,
} = require('../controllers/leaveTypeController');

router.get('/', auth, getLeaveTypes);                       // everyone logged in
router.post('/', auth, adminOnly, createLeaveType);         // admin only
router.put('/:id', auth, adminOnly, updateLeaveType);
router.delete('/:id', auth, adminOnly, deactivateLeaveType);

module.exports = router;