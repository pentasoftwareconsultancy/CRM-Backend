import express from 'express';
import { 
    getCustomers, 
    getCustomerById, 
    updateCustomer,
    manualCreateCustomer
} from '../controllers/customer.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.route('/')
    // 7.1 GET /customers
    .get(protect, getCustomers)
    // 7.2 POST /customers (Manual creation, Admin/Manager only)
    .post(protect, authorize('admin', 'manager'), manualCreateCustomer);

router.route('/:id')
    // 7.3 GET /customers/:id
    .get(protect, getCustomerById)
    // 7.4 PUT /customers/:id
    .put(protect, updateCustomer);

export default router;