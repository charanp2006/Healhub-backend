import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    content: { type: String, required: true },
    excerpt: { type: String, default: "" },
    image: { type: String, default: "" },
    category: {
      type: String,
      enum: [
        "Health Tips",
        "Nutrition",
        "Mental Health",
        "Fitness",
        "Disease Awareness",
        "Medical News",
        "Hospital Updates",
        "Other",
      ],
      default: "Other",
    },
    tags: { type: [String], default: [] },
    author: { type: String, default: "Admin" },
    // Hospital affiliation (optional)
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "hospital", default: null },
    // Doctor author (optional)
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "doctor", default: null },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    views: { type: Number, default: 0 },
  },
  { minimize: false, timestamps: true }
);

blogSchema.index({ slug: 1 });
blogSchema.index({ category: 1 });
blogSchema.index({ isPublished: 1, publishedAt: -1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ hospitalId: 1 });
blogSchema.index({ doctorId: 1 });

const blogModel = mongoose.models.blog || mongoose.model("blog", blogSchema);

export default blogModel;
