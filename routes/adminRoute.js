import express from "express";
import { addDoctor, adminDashboard, allDoctors, appointmentCancel, appointmentsAdmin, loginAdmin, hospitalManagement } from "../controllers/adminController.js";
import upload from "../middlewares/multer.js";
import authAdmin from "../middlewares/authAdmin.js";
import { changeAvailability } from "../controllers/doctorController.js";
import { addHospital, listHospitals, getRegisteredHospitals } from "../controllers/hospitalController.js";

const adminRouter = express.Router();

// Route for admin login
adminRouter.post('/login',  loginAdmin);

// Route for adding a doctor with image upload
adminRouter.post('/add-doctor', authAdmin, upload.single('image'), addDoctor);
// Route for adding a hospital
adminRouter.post('/add-hospital', authAdmin, addHospital);
adminRouter.get('/all-hospitals', authAdmin, listHospitals);
adminRouter.get('/registered-hospitals', authAdmin, getRegisteredHospitals);

// Route for getting all doctors
adminRouter.post('/all-doctors', authAdmin, allDoctors);
adminRouter.post('/change-availability', authAdmin, changeAvailability);

// Route for getting all appointments
adminRouter.get('/appointments', authAdmin, appointmentsAdmin);

// Rout for canceling an appointment
adminRouter.post('/cancel-appointment', authAdmin, appointmentCancel)

// Route for getting admin dashboard data
adminRouter.get('/dashboard', authAdmin, adminDashboard);

// Route for hospital management (aggregated view)
adminRouter.get('/hospital-management', authAdmin, hospitalManagement);

export default adminRouter;