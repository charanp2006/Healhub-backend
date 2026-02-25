import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "user" },
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const hospitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    city: { type: String, required: true },
    address: {
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: { type: [Number], required: true },
    },
    image: { type: String, default: "" },
    about: { type: String, default: "" },
    specialties: { type: [String], default: [] },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    reviews: { type: [reviewSchema], default: [] },
    isRegistered: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true },
    totalBeds: { type: Number, default: 0 },
    availableBeds: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { minimize: false }
);

hospitalSchema.index({ location: "2dsphere" });
hospitalSchema.index({ email: 1 });
hospitalSchema.index({ name: 1 });
hospitalSchema.index({ city: 1 });
hospitalSchema.index({ specialties: 1 });
hospitalSchema.index({ ratingAverage: -1 });
hospitalSchema.index({ isRegistered: 1 });

const hospitalModel =
  mongoose.models.hospital || mongoose.model("hospital", hospitalSchema);

export default hospitalModel;
