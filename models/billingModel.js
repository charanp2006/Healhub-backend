import mongoose from "mongoose";

const billingSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "hospital",
      required: true,
    },
    // Appointment-based billing
    totalAppointments: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    commissionPercentage: { type: Number, default: 10 }, // Platform commission %
    commissionAmount: { type: Number, default: 0 },
    netPayable: { type: Number, default: 0 }, // Amount hospital receives
    // Room/bed-based billing
    bedAllocations: { type: Number, default: 0 },
    bedRevenue: { type: Number, default: 0 },
    // Combined totals
    grandTotal: { type: Number, default: 0 },
    billingPeriodStart: { type: Date, required: true },
    billingPeriodEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

billingSchema.index({ hospitalId: 1 });
billingSchema.index({ status: 1 });
billingSchema.index({ billingPeriodStart: -1 });

const billingModel =
  mongoose.models.billing || mongoose.model("billing", billingSchema);

export default billingModel;
