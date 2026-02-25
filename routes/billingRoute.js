import express from "express";
import { generateBilling, listBillings, markBillingPaid, getHospitalBillings, hospitalGenerateBilling } from "../controllers/billingController.js";
import authAdmin from "../middlewares/authAdmin.js";
import authHospital from "../middlewares/authHospital.js";

const billingRouter = express.Router();

// Admin routes
billingRouter.post("/admin/generate", authAdmin, generateBilling);
billingRouter.get("/admin/list", authAdmin, listBillings);
billingRouter.post("/admin/mark-paid", authAdmin, markBillingPaid);

// Hospital routes
billingRouter.get("/hospital/list", authHospital, getHospitalBillings);
billingRouter.post("/hospital/generate", authHospital, hospitalGenerateBilling);

export default billingRouter;
