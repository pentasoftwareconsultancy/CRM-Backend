import express from 'express';
import { 
    getDeals, 
    createDeal, 
    getDealById, 
    updateDeal, 
    updateDealStage,
    closeDeal
} from '../controllers/deal.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All deal routes require authentication
router.route('/')
    // 4.1 GET /deals
    .get(protect, getDeals) 
    // 4.2 POST /deals
    .post(protect, createDeal); 

router.route('/:id')
    // 4.3 GET /deals/:id
    .get(protect, getDealById)
    // 4.4 PUT /deals/:id
    .put(protect, updateDeal);

// Specific actions
router.patch('/:id/stage', protect, updateDealStage); // 4.5 PATCH /deals/:id/stage
router.patch('/:id/close', protect, closeDeal);       // 4.6 PATCH /deals/:id/close

export default router;