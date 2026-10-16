const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const {
  getEmployees,
  getDepartments,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
} = require('../controllers/userController');

// Everything under /api/admin needs a login AND the admin role
router.use(auth, adminOnly);

// Employees
router.get('/users', getEmployees);
router.post('/users', createEmployee);
router.put('/users/:id', updateEmployee);
router.delete('/users/:id', deactivateEmployee);

// Departments (for the filter dropdown)
router.get('/departments', getDepartments);

module.exports = router;