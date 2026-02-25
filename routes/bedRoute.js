import express from "express";
import authAdmin from "../middlewares/authAdmin.js";
import authHospital from "../middlewares/authHospital.js";
import {
  addRoomCategory,
  updateRoomCategory,
  getRoomCategories,
  getPublicRoomAvailability,
  admitPatient,
  dischargePatient,
  getAllocationHistory,
  hospitalAddRoomCategory,
  hospitalUpdateRoomCategory,
  hospitalGetRoomCategories,
  hospitalAdmitPatient,
  hospitalDischargePatient,
  hospitalGetAllocationHistory,
} from "../controllers/bedController.js";

const bedRouter = express.Router();

// Public – limited data only
bedRouter.get("/availability/:hospitalId", getPublicRoomAvailability);

// Admin – full CRUD
bedRouter.post("/add-category", authAdmin, addRoomCategory);
bedRouter.post("/update-category", authAdmin, updateRoomCategory);
bedRouter.get("/categories/:hospitalId", authAdmin, getRoomCategories);
bedRouter.post("/admit", authAdmin, admitPatient);
bedRouter.post("/discharge", authAdmin, dischargePatient);
bedRouter.get("/history/:hospitalId", authAdmin, getAllocationHistory);

// Hospital panel – scoped to own hospital
bedRouter.post("/hospital/add-category", authHospital, hospitalAddRoomCategory);
bedRouter.post("/hospital/update-category", authHospital, hospitalUpdateRoomCategory);
bedRouter.get("/hospital/categories", authHospital, hospitalGetRoomCategories);
bedRouter.post("/hospital/admit", authHospital, hospitalAdmitPatient);
bedRouter.post("/hospital/discharge", authHospital, hospitalDischargePatient);
bedRouter.get("/hospital/history", authHospital, hospitalGetAllocationHistory);

export default bedRouter;
