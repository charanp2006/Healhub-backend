import express from "express";
import {
  getHospitalProfile,
  listHospitals,
  validateHospitalBooking,
  hospitalLogin,
  hospitalDashboard,
  hospitalAddDoctor,
  hospitalGetDoctors,
  hospitalProfile,
  updateHospitalProfile,
  hospitalPanelAnalytics,
} from "../controllers/hospitalController.js";
import authUser from "../middlewares/authUser.js";
import authHospital from "../middlewares/authHospital.js";
import upload from "../middlewares/multer.js";

const hospitalRouter = express.Router();

// Public / user-facing routes
hospitalRouter.get("/list", listHospitals);
hospitalRouter.post("/validate-booking", authUser, validateHospitalBooking);

// Hospital panel routes
hospitalRouter.post("/login", hospitalLogin);
hospitalRouter.get("/panel/dashboard", authHospital, hospitalDashboard);
hospitalRouter.post("/panel/add-doctor", upload.single('image'), authHospital, hospitalAddDoctor);
hospitalRouter.get("/panel/doctors", authHospital, hospitalGetDoctors);
hospitalRouter.get("/panel/profile", authHospital, hospitalProfile);
hospitalRouter.post("/panel/update-profile", upload.single('image'), authHospital, updateHospitalProfile);
hospitalRouter.get("/panel/analytics", authHospital, hospitalPanelAnalytics);

// This must come LAST because :hospitalId is a catch-all param
hospitalRouter.get("/:hospitalId", getHospitalProfile);

export default hospitalRouter;
