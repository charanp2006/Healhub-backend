import express from "express";
import authAdmin from "../middlewares/authAdmin.js";
import authDoctor from "../middlewares/authDoctor.js";
import authHospital from "../middlewares/authHospital.js";
import upload from "../middlewares/multer.js";
import {
  addBlog,
  updateBlog,
  deleteBlog,
  adminListBlogs,
  adminGetBlog,
  listBlogs,
  getBlogBySlug,
  doctorAddBlog,
  doctorUpdateBlog,
  doctorDeleteBlog,
  doctorListBlogs,
  doctorGetBlog,
  hospitalAddBlog,
  hospitalUpdateBlog,
  hospitalDeleteBlog,
  hospitalListBlogs,
  hospitalGetBlog,
} from "../controllers/blogController.js";

const blogRouter = express.Router();

// ─── Public routes ──────────────────────────────────────
blogRouter.get("/list", listBlogs);
blogRouter.get("/post/:slug", getBlogBySlug);

// ─── Admin routes ───────────────────────────────────────
blogRouter.post("/add", authAdmin, upload.single("image"), addBlog);
blogRouter.post("/update", authAdmin, upload.single("image"), updateBlog);
blogRouter.post("/delete", authAdmin, deleteBlog);
blogRouter.get("/admin-list", authAdmin, adminListBlogs);
blogRouter.get("/admin/:blogId", authAdmin, adminGetBlog);

// ─── Doctor routes ──────────────────────────────────────
blogRouter.post("/doctor/add", upload.single("image"), authDoctor, doctorAddBlog);
blogRouter.post("/doctor/update", upload.single("image"), authDoctor, doctorUpdateBlog);
blogRouter.post("/doctor/delete", authDoctor, doctorDeleteBlog);
blogRouter.get("/doctor/list", authDoctor, doctorListBlogs);
blogRouter.get("/doctor/:blogId", authDoctor, doctorGetBlog);

// ─── Hospital routes ────────────────────────────────────
blogRouter.post("/hospital/add", upload.single("image"), authHospital, hospitalAddBlog);
blogRouter.post("/hospital/update", upload.single("image"), authHospital, hospitalUpdateBlog);
blogRouter.post("/hospital/delete", authHospital, hospitalDeleteBlog);
blogRouter.get("/hospital/list", authHospital, hospitalListBlogs);
blogRouter.get("/hospital/:blogId", authHospital, hospitalGetBlog);

export default blogRouter;
