import express from 'express';
import { 
    getOverviewReport,
    getSalesPerformanceReport,
    getConversionRateReport,
    getLostReasonsReport,
    exportReport,
    getWeeklyPerformanceReport // <-- NEW IMPORT
} from '../controllers/report.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();
const reportAuth = [protect, authorize('admin', 'manager')]; // Only Admin/Manager can view reports

router.route('/reports/overview')
    .get(reportAuth, getOverviewReport); // 8.1

router.route('/reports/sales-performance')
    .get(reportAuth, getSalesPerformanceReport); // 8.2

router.route('/reports/weekly-performance') // <-- NEW ROUTE FOR DASHBOARD CHART
    .get(reportAuth, getWeeklyPerformanceReport);

router.route('/reports/conversion-rate')
    .get(reportAuth, getConversionRateReport); // 8.3

router.route('/reports/lost-reasons')
    .get(reportAuth, getLostReasonsReport); // 8.4

router.route('/reports/export')
    .get(reportAuth, exportReport); // FR-34 (Placeholder)

export default router;