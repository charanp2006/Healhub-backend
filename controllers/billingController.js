import billingModel from "../models/billingModel.js";
import hospitalModel from "../models/hospitalModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import bedAllocationModel from "../models/bedAllocationModel.js";
import roomCategoryModel from "../models/roomCategoryModel.js";

// Admin: Generate billing for a hospital for a specific period
const generateBilling = async (req, res) => {
  try {
    const { hospitalId, billingPeriodStart, billingPeriodEnd, commissionPercentage = 10 } = req.body;

    if (!hospitalId || !billingPeriodStart || !billingPeriodEnd) {
      return res.json({ success: false, message: "Hospital ID and billing period are required" });
    }

    const hospital = await hospitalModel.findById(hospitalId);
    if (!hospital) {
      return res.json({ success: false, message: "Hospital not found" });
    }

    const startDate = new Date(billingPeriodStart);
    const endDate = new Date(billingPeriodEnd);

    if (startDate >= endDate) {
      return res.json({ success: false, message: "Invalid date range" });
    }

    // Get all doctors for this hospital
    const doctors = await doctorModel.find({ hospitalId }).select("_id");
    const doctorIds = doctors.map((d) => d._id.toString());

    if (doctorIds.length === 0) {
      return res.json({ success: false, message: "No doctors found for this hospital" });
    }

    // Get completed appointments in the billing period
    const appointments = await appointmentModel.find({
      docId: { $in: doctorIds },
      isCompleted: true,
      cancelled: { $ne: true },
      date: {
        $gte: startDate.getTime(),
        $lte: endDate.getTime(),
      },
    });

    const totalAppointments = appointments.length;
    const totalRevenue = appointments.reduce((sum, a) => sum + (a.amount || 0), 0);
    const commissionAmount = Math.round((totalRevenue * commissionPercentage) / 100);
    const netPayable = totalRevenue - commissionAmount;

    // Bed allocation billing
    const allocations = await bedAllocationModel.find({
      hospitalId,
      $or: [
        { admissionDate: { $gte: startDate, $lte: endDate } },
        { status: "admitted", admissionDate: { $lte: endDate } },
      ],
    }).populate("roomCategoryId", "dailyRate name");

    let bedRevenue = 0;
    allocations.forEach(a => {
      const rate = a.roomCategoryId?.dailyRate || 0;
      const admitDate = new Date(a.admissionDate);
      const discharge = a.dischargeDate ? new Date(a.dischargeDate) : endDate;
      const effStart = admitDate < startDate ? startDate : admitDate;
      const effEnd = discharge > endDate ? endDate : discharge;
      const days = Math.max(1, Math.ceil((effEnd - effStart) / (1000 * 60 * 60 * 24)));
      bedRevenue += days * rate;
    });

    const grandTotal = netPayable + bedRevenue;

    const billing = new billingModel({
      hospitalId,
      totalAppointments,
      totalRevenue,
      commissionPercentage,
      commissionAmount,
      netPayable,
      bedAllocations: allocations.length,
      bedRevenue,
      grandTotal,
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      status: "Pending",
    });

    await billing.save();

    res.json({ success: true, message: "Billing generated successfully", billing });
  } catch (error) {
    console.log("Error in generateBilling:", error);
    res.json({ success: false, message: error.message });
  }
};

// Admin: List all billings with filters
const listBillings = async (req, res) => {
  try {
    const { hospitalId, status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (hospitalId) filter.hospitalId = hospitalId;
    if (status && ["Pending", "Paid"].includes(status)) filter.status = status;

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.min(Math.max(parseInt(limit), 1), 50);
    const skip = (pageNum - 1) * limitNum;

    const total = await billingModel.countDocuments(filter);
    const billings = await billingModel
      .find(filter)
      .populate("hospitalId", "name city image")
      .sort({ billingPeriodEnd: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      billings,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.log("Error in listBillings:", error);
    res.json({ success: false, message: error.message });
  }
};

// Admin: Mark billing as paid
const markBillingPaid = async (req, res) => {
  try {
    const { billingId } = req.body;

    if (!billingId) {
      return res.json({ success: false, message: "Billing ID is required" });
    }

    const billing = await billingModel.findById(billingId);
    if (!billing) {
      return res.json({ success: false, message: "Billing not found" });
    }

    if (billing.status === "Paid") {
      return res.json({ success: false, message: "Billing is already marked as paid" });
    }

    billing.status = "Paid";
    await billing.save();

    res.json({ success: true, message: "Billing marked as paid" });
  } catch (error) {
    console.log("Error in markBillingPaid:", error);
    res.json({ success: false, message: error.message });
  }
};

// Hospital: Get own billings
const getHospitalBillings = async (req, res) => {
  try {
    const { hospitalId } = req.body; // Set by authHospital middleware
    const { status, page = 1, limit = 20 } = req.query;

    const filter = { hospitalId };
    if (status && ["Pending", "Paid"].includes(status)) filter.status = status;

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.min(Math.max(parseInt(limit), 1), 50);
    const skip = (pageNum - 1) * limitNum;

    const total = await billingModel.countDocuments(filter);
    const billings = await billingModel
      .find(filter)
      .sort({ billingPeriodEnd: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      billings,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.log("Error in getHospitalBillings:", error);
    res.json({ success: false, message: error.message });
  }
};

// Hospital: Generate billing for their own hospital
const hospitalGenerateBilling = async (req, res) => {
  try {
    const { hospitalId, billingPeriodStart, billingPeriodEnd, commissionPercentage = 10 } = req.body;

    if (!billingPeriodStart || !billingPeriodEnd) {
      return res.json({ success: false, message: "Billing period is required" });
    }

    const hospital = await hospitalModel.findById(hospitalId);
    if (!hospital) {
      return res.json({ success: false, message: "Hospital not found" });
    }

    const startDate = new Date(billingPeriodStart);
    const endDate = new Date(billingPeriodEnd);

    if (startDate >= endDate) {
      return res.json({ success: false, message: "Invalid date range" });
    }

    // Get all doctors for this hospital
    const doctors = await doctorModel.find({ hospitalId }).select("_id");
    const doctorIds = doctors.map((d) => d._id.toString());

    if (doctorIds.length === 0) {
      return res.json({ success: false, message: "No doctors found for this hospital" });
    }

    // Get completed appointments in the billing period
    const appointments = await appointmentModel.find({
      docId: { $in: doctorIds },
      isCompleted: true,
      cancelled: { $ne: true },
      date: {
        $gte: startDate.getTime(),
        $lte: endDate.getTime(),
      },
    });

    const totalAppointments = appointments.length;
    const totalRevenue = appointments.reduce((sum, a) => sum + (a.amount || 0), 0);
    const commissionAmount = Math.round((totalRevenue * commissionPercentage) / 100);
    const netPayable = totalRevenue - commissionAmount;

    // Bed allocation billing
    const allocations = await bedAllocationModel.find({
      hospitalId,
      $or: [
        { admissionDate: { $gte: startDate, $lte: endDate } },
        { status: "admitted", admissionDate: { $lte: endDate } },
      ],
    }).populate("roomCategoryId", "dailyRate name");

    let bedRevenue = 0;
    allocations.forEach(a => {
      const rate = a.roomCategoryId?.dailyRate || 0;
      const admitDate = new Date(a.admissionDate);
      const discharge = a.dischargeDate ? new Date(a.dischargeDate) : endDate;
      const effStart = admitDate < startDate ? startDate : admitDate;
      const effEnd = discharge > endDate ? endDate : discharge;
      const days = Math.max(1, Math.ceil((effEnd - effStart) / (1000 * 60 * 60 * 24)));
      bedRevenue += days * rate;
    });

    const grandTotal = netPayable + bedRevenue;

    const billing = new billingModel({
      hospitalId,
      totalAppointments,
      totalRevenue,
      commissionPercentage,
      commissionAmount,
      netPayable,
      bedAllocations: allocations.length,
      bedRevenue,
      grandTotal,
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      status: "Pending",
    });

    await billing.save();

    res.json({ success: true, message: "Billing generated successfully", billing });
  } catch (error) {
    console.log("Error in hospitalGenerateBilling:", error);
    res.json({ success: false, message: error.message });
  }
};

export { generateBilling, listBillings, markBillingPaid, getHospitalBillings, hospitalGenerateBilling };
