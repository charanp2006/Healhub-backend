import express from "express";
import authAdmin from "../middlewares/authAdmin.js";
import {
    getOverviewStats,
    getAppointmentTrends,
    getDoctorPerformance,
    getSpecialityStats,
    getRecentActivity,
    getHospitalAnalytics
} from "../controllers/analyticsController.js";

const analyticsRouter = express.Router();

// All analytics routes are admin-protected
analyticsRouter.get('/overview', authAdmin, getOverviewStats);
analyticsRouter.get('/trends', authAdmin, getAppointmentTrends);
analyticsRouter.get('/doctor-performance', authAdmin, getDoctorPerformance);
analyticsRouter.get('/speciality-stats', authAdmin, getSpecialityStats);
analyticsRouter.get('/recent-activity', authAdmin, getRecentActivity);
analyticsRouter.get('/hospital', authAdmin, getHospitalAnalytics);

export default analyticsRouter;
