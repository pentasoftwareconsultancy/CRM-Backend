import express from 'express';
import { 
    createFollowUp, 
    getFollowUps, 
    completeFollowUp,
    getLeadFollowUps,
    addNote,
    getLeadNotes,
    deleteNote,
    getLeadActivities
} from '../controllers/activity.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// --- Global Follow-up Route (5.3) ---
router.route('/followups')
    .get(protect, getFollowUps);

// --- Individual Follow-up Action (5.4) ---
router.patch('/followups/:id/complete', protect, completeFollowUp);

// --- Note Deletion (6.3) ---
router.delete('/notes/:id', protect, deleteNote); 

// --- Lead Specific Activity Routes (5.1, 5.2, 6.1, 6.2, 6.4) ---
router.route('/leads/:leadId/followups')
    .post(protect, createFollowUp) // 5.1
    .get(protect, getLeadFollowUps); // 5.2

router.route('/leads/:leadId/notes')
    .post(protect, addNote) // 6.1
    .get(protect, getLeadNotes); // 6.2

router.route('/leads/:leadId/activities')
    .get(protect, getLeadActivities); // 6.4

export default router;