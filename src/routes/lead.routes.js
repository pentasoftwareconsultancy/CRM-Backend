import express from 'express';
import { 
    getLeads, 
    createLead, 
    getLeadById, 
    updateLead, 
    deleteLead, 
    importLeads, 
    exportLeads 
} from '../controllers/lead.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import upload from '../middleware/upload.middleware.js';


const router = express.Router();

router.route('/')
    // 3.1 GET /leads
    .get(protect, getLeads) 
    // 3.2 POST /leads
    .post(protect, createLead); 

// Phase 2 features (Import/Export)
//router.post('/import', protect, authorize('admin', 'manager'), importLeads);


router.post(
  '/import',
  protect,
  authorize('admin', 'manager'),
  upload.single('file'),
  importLeads
);
router.get('/export', protect, authorize('admin', 'manager'), exportLeads);

router.route('/:id')
    // 3.3 GET /leads/:id
    .get(protect, getLeadById)
    // 3.4 PUT /leads/:id
    .put(protect, updateLead) 
    // 3.5 DELETE /leads/:id (Admin or Manager authorization check)
    .delete(protect, authorize('admin', 'manager'), deleteLead); 

export default router;