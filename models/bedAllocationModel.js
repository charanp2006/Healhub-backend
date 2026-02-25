import mongoose from "mongoose";

const bedAllocationSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "hospital",
      required: true,
    },
    roomCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "roomCategory",
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    admissionDate: { type: Date, required: true },
    dischargeDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["admitted", "discharged", "transferred"],
      default: "admitted",
    },
  },
  { timestamps: true }
);

bedAllocationSchema.index({ hospitalId: 1 });
bedAllocationSchema.index({ roomCategoryId: 1 });
bedAllocationSchema.index({ patientId: 1 });
bedAllocationSchema.index({ status: 1 });

const bedAllocationModel =
  mongoose.models.bedAllocation ||
  mongoose.model("bedAllocation", bedAllocationSchema);

export default bedAllocationModel;
