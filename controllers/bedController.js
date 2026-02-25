import mongoose from "mongoose";
import roomCategoryModel from "../models/roomCategoryModel.js";
import bedAllocationModel from "../models/bedAllocationModel.js";
import hospitalModel from "../models/hospitalModel.js";

// ─── helpers ────────────────────────────────────────────

const recalcHospitalBeds = async (hospitalId) => {
  const categories = await roomCategoryModel.find({ hospitalId });
  const totalBeds = categories.reduce((sum, c) => sum + c.totalBeds, 0);
  const availableBeds = categories.reduce((sum, c) => sum + c.availableBeds, 0);
  await hospitalModel.findByIdAndUpdate(hospitalId, { totalBeds, availableBeds });
};

// ─── Room Category CRUD (Admin) ─────────────────────────

const addRoomCategory = async (req, res) => {
  try {
    const { hospitalId, name, totalBeds, availableBeds } = req.body;

    if (!hospitalId || !name || totalBeds === undefined) {
      return res.json({ success: false, message: "Required data missing" });
    }

    const hospital = await hospitalModel.findById(hospitalId);
    if (!hospital) {
      return res.json({ success: false, message: "Hospital not found" });
    }

    const total = Number(totalBeds);
    const available = Number(availableBeds ?? totalBeds);

    if (total < 0 || available < 0) {
      return res.json({ success: false, message: "Bed counts cannot be negative" });
    }
    if (available > total) {
      return res.json({
        success: false,
        message: "Available beds cannot exceed total beds",
      });
    }

    const existing = await roomCategoryModel.findOne({ hospitalId, name });
    if (existing) {
      return res.json({
        success: false,
        message: "Room category already exists for this hospital",
      });
    }

    const category = new roomCategoryModel({
      hospitalId,
      name,
      totalBeds: total,
      availableBeds: available,
    });
    await category.save();
    await recalcHospitalBeds(hospitalId);

    res.json({ success: true, message: "Room category added", category });
  } catch (error) {
    console.log("Error in addRoomCategory:", error);
    res.json({ success: false, message: error.message });
  }
};

const updateRoomCategory = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { categoryId, totalBeds, availableBeds, name } = req.body;

    if (!categoryId) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ success: false, message: "Category ID required" });
    }

    const category = await roomCategoryModel
      .findById(categoryId)
      .session(session);
    if (!category) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ success: false, message: "Category not found" });
    }

    const newTotal =
      totalBeds !== undefined ? Number(totalBeds) : category.totalBeds;
    const newAvailable =
      availableBeds !== undefined
        ? Number(availableBeds)
        : category.availableBeds;

    if (newTotal < 0 || newAvailable < 0) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ success: false, message: "Bed counts cannot be negative" });
    }
    if (newAvailable > newTotal) {
      await session.abortTransaction();
      session.endSession();
      return res.json({
        success: false,
        message: "Available beds cannot exceed total beds",
      });
    }

    category.totalBeds = newTotal;
    category.availableBeds = newAvailable;
    if (name) category.name = name;
    await category.save({ session });

    await session.commitTransaction();
    session.endSession();

    await recalcHospitalBeds(category.hospitalId);

    res.json({ success: true, message: "Room category updated", category });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.log("Error in updateRoomCategory:", error);
    res.json({ success: false, message: error.message });
  }
};

const getRoomCategories = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const categories = await roomCategoryModel.find({ hospitalId });
    res.json({ success: true, categories });
  } catch (error) {
    console.log("Error in getRoomCategories:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Public endpoint – only name + available beds ───────

const getPublicRoomAvailability = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const categories = await roomCategoryModel
      .find({ hospitalId })
      .select("name availableBeds totalBeds");
    res.json({ success: true, categories });
  } catch (error) {
    console.log("Error in getPublicRoomAvailability:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Bed Allocation ─────────────────────────────────────

const admitPatient = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { hospitalId, roomCategoryId, patientId, admissionDate } = req.body;

    if (!hospitalId || !roomCategoryId || !patientId) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ success: false, message: "Required data missing" });
    }

    const category = await roomCategoryModel
      .findById(roomCategoryId)
      .session(session);
    if (!category) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ success: false, message: "Room category not found" });
    }

    if (category.availableBeds <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ success: false, message: "No beds available in this category" });
    }

    category.availableBeds -= 1;
    await category.save({ session });

    const allocation = new bedAllocationModel({
      hospitalId,
      roomCategoryId,
      patientId,
      admissionDate: admissionDate || new Date(),
      status: "admitted",
    });
    await allocation.save({ session });

    await session.commitTransaction();
    session.endSession();

    await recalcHospitalBeds(hospitalId);

    res.json({ success: true, message: "Patient admitted", allocation });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.log("Error in admitPatient:", error);
    res.json({ success: false, message: error.message });
  }
};

const dischargePatient = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { allocationId, dischargeDate } = req.body;

    if (!allocationId) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ success: false, message: "Allocation ID required" });
    }

    const allocation = await bedAllocationModel
      .findById(allocationId)
      .session(session);
    if (!allocation) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ success: false, message: "Allocation not found" });
    }

    if (allocation.status !== "admitted") {
      await session.abortTransaction();
      session.endSession();
      return res.json({ success: false, message: "Patient is not currently admitted" });
    }

    allocation.status = "discharged";
    allocation.dischargeDate = dischargeDate || new Date();
    await allocation.save({ session });

    const category = await roomCategoryModel
      .findById(allocation.roomCategoryId)
      .session(session);
    if (category) {
      category.availableBeds = Math.min(
        category.availableBeds + 1,
        category.totalBeds
      );
      await category.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    await recalcHospitalBeds(allocation.hospitalId);

    res.json({ success: true, message: "Patient discharged", allocation });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.log("Error in dischargePatient:", error);
    res.json({ success: false, message: error.message });
  }
};

const getAllocationHistory = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { page, limit } = req.query;

    const pageNumber = Math.max(parseInt(page || "1", 10), 1);
    const limitNumber = Math.min(Math.max(parseInt(limit || "20", 10), 1), 100);
    const skipCount = (pageNumber - 1) * limitNumber;

    const allocations = await bedAllocationModel
      .find({ hospitalId })
      .sort({ createdAt: -1 })
      .skip(skipCount)
      .limit(limitNumber);

    const totalCount = await bedAllocationModel.countDocuments({ hospitalId });

    res.json({
      success: true,
      allocations,
      pagination: { page: pageNumber, limit: limitNumber, total: totalCount },
    });
  } catch (error) {
    console.log("Error in getAllocationHistory:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Hospital Panel: Room Category CRUD ─────────────────

const hospitalAddRoomCategory = async (req, res) => {
  try {
    const { hospitalId, name, totalBeds, availableBeds } = req.body;

    if (!name || totalBeds === undefined) {
      return res.json({ success: false, message: "Name and total beds required" });
    }

    const total = Number(totalBeds);
    const available = Number(availableBeds ?? totalBeds);
    if (total < 0 || available < 0) return res.json({ success: false, message: "Bed counts cannot be negative" });
    if (available > total) return res.json({ success: false, message: "Available beds cannot exceed total beds" });

    const existing = await roomCategoryModel.findOne({ hospitalId, name });
    if (existing) return res.json({ success: false, message: "Room category already exists" });

    const category = new roomCategoryModel({ hospitalId, name, totalBeds: total, availableBeds: available });
    await category.save();
    await recalcHospitalBeds(hospitalId);

    res.json({ success: true, message: "Room category added", category });
  } catch (error) {
    console.log("Error in hospitalAddRoomCategory:", error);
    res.json({ success: false, message: error.message });
  }
};

const hospitalUpdateRoomCategory = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { hospitalId, categoryId, totalBeds, availableBeds, name } = req.body;
    if (!categoryId) { await session.abortTransaction(); session.endSession(); return res.json({ success: false, message: "Category ID required" }); }

    const category = await roomCategoryModel.findById(categoryId).session(session);
    if (!category) { await session.abortTransaction(); session.endSession(); return res.json({ success: false, message: "Category not found" }); }
    if (category.hospitalId.toString() !== hospitalId) { await session.abortTransaction(); session.endSession(); return res.json({ success: false, message: "Unauthorized" }); }

    const newTotal = totalBeds !== undefined ? Number(totalBeds) : category.totalBeds;
    const newAvailable = availableBeds !== undefined ? Number(availableBeds) : category.availableBeds;
    if (newTotal < 0 || newAvailable < 0) { await session.abortTransaction(); session.endSession(); return res.json({ success: false, message: "Bed counts cannot be negative" }); }
    if (newAvailable > newTotal) { await session.abortTransaction(); session.endSession(); return res.json({ success: false, message: "Available beds cannot exceed total beds" }); }

    category.totalBeds = newTotal;
    category.availableBeds = newAvailable;
    if (name) category.name = name;
    await category.save({ session });

    await session.commitTransaction();
    session.endSession();
    await recalcHospitalBeds(hospitalId);

    res.json({ success: true, message: "Room category updated", category });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.log("Error in hospitalUpdateRoomCategory:", error);
    res.json({ success: false, message: error.message });
  }
};

const hospitalGetRoomCategories = async (req, res) => {
  try {
    const { hospitalId } = req.body;
    const categories = await roomCategoryModel.find({ hospitalId });
    res.json({ success: true, categories });
  } catch (error) {
    console.log("Error in hospitalGetRoomCategories:", error);
    res.json({ success: false, message: error.message });
  }
};

const hospitalAdmitPatient = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { hospitalId, roomCategoryId, patientId, admissionDate } = req.body;
    if (!roomCategoryId || !patientId) { await session.abortTransaction(); session.endSession(); return res.json({ success: false, message: "Required data missing" }); }

    const category = await roomCategoryModel.findById(roomCategoryId).session(session);
    if (!category) { await session.abortTransaction(); session.endSession(); return res.json({ success: false, message: "Room category not found" }); }
    if (category.hospitalId.toString() !== hospitalId) { await session.abortTransaction(); session.endSession(); return res.json({ success: false, message: "Unauthorized" }); }
    if (category.availableBeds <= 0) { await session.abortTransaction(); session.endSession(); return res.json({ success: false, message: "No beds available" }); }

    category.availableBeds -= 1;
    await category.save({ session });

    const allocation = new bedAllocationModel({
      hospitalId, roomCategoryId, patientId,
      admissionDate: admissionDate || new Date(),
      status: "admitted",
    });
    await allocation.save({ session });

    await session.commitTransaction();
    session.endSession();
    await recalcHospitalBeds(hospitalId);

    res.json({ success: true, message: "Patient admitted", allocation });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.log("Error in hospitalAdmitPatient:", error);
    res.json({ success: false, message: error.message });
  }
};

const hospitalDischargePatient = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { hospitalId, allocationId, dischargeDate } = req.body;
    if (!allocationId) { await session.abortTransaction(); session.endSession(); return res.json({ success: false, message: "Allocation ID required" }); }

    const allocation = await bedAllocationModel.findById(allocationId).session(session);
    if (!allocation) { await session.abortTransaction(); session.endSession(); return res.json({ success: false, message: "Allocation not found" }); }
    if (allocation.hospitalId.toString() !== hospitalId) { await session.abortTransaction(); session.endSession(); return res.json({ success: false, message: "Unauthorized" }); }
    if (allocation.status !== "admitted") { await session.abortTransaction(); session.endSession(); return res.json({ success: false, message: "Patient is not currently admitted" }); }

    allocation.status = "discharged";
    allocation.dischargeDate = dischargeDate || new Date();
    await allocation.save({ session });

    const category = await roomCategoryModel.findById(allocation.roomCategoryId).session(session);
    if (category) {
      category.availableBeds = Math.min(category.availableBeds + 1, category.totalBeds);
      await category.save({ session });
    }

    await session.commitTransaction();
    session.endSession();
    await recalcHospitalBeds(hospitalId);

    res.json({ success: true, message: "Patient discharged", allocation });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.log("Error in hospitalDischargePatient:", error);
    res.json({ success: false, message: error.message });
  }
};

const hospitalGetAllocationHistory = async (req, res) => {
  try {
    const { hospitalId } = req.body;
    const { page, limit, status } = req.query;

    const pageNumber = Math.max(parseInt(page || "1", 10), 1);
    const limitNumber = Math.min(Math.max(parseInt(limit || "20", 10), 1), 100);
    const skipCount = (pageNumber - 1) * limitNumber;

    const filter = { hospitalId };
    if (status && ["admitted", "discharged", "transferred"].includes(status)) {
      filter.status = status;
    }

    const allocations = await bedAllocationModel
      .find(filter)
      .populate("roomCategoryId", "name")
      .populate("patientId", "name email image")
      .sort({ createdAt: -1 })
      .skip(skipCount)
      .limit(limitNumber);

    const totalCount = await bedAllocationModel.countDocuments(filter);

    res.json({ success: true, allocations, pagination: { page: pageNumber, limit: limitNumber, total: totalCount } });
  } catch (error) {
    console.log("Error in hospitalGetAllocationHistory:", error);
    res.json({ success: false, message: error.message });
  }
};

export {
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
};
