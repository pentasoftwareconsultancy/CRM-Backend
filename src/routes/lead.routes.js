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

// Multer setup for handling file uploads (Saves file to buffer memory)
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() }); 

const router = express.Router();

router.route('/')
    .get(protect, getLeads) 
    .post(protect, createLead); 

// FR-10 Import: Uses multer to parse 'file' field before hitting the controller
router.post('/import', protect, authorize('admin', 'manager'), upload.single('file'), importLeads);
router.get('/export', protect, authorize('admin', 'manager'), exportLeads);

router.route('/:id')
    .get(protect, getLeadById)
    .put(protect, updateLead) 
    .delete(protect, authorize('admin', 'manager'), deleteLead); 

export default router;