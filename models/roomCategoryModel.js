import mongoose from "mongoose";

const roomCategorySchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "hospital",
      required: true,
    },
    name: { type: String, required: true },
    totalBeds: { type: Number, required: true, min: 0 },
    availableBeds: { type: Number, required: true, min: 0 },
    dailyRate: { type: Number, default: 0 }, // Cost per day
  },
  { timestamps: true }
);

roomCategorySchema.index({ hospitalId: 1 });
roomCategorySchema.index({ hospitalId: 1, name: 1 }, { unique: true });

const roomCategoryModel =
  mongoose.models.roomCategory ||
  mongoose.model("roomCategory", roomCategorySchema);

export default roomCategoryModel;
