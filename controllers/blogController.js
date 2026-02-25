import { v2 as cloudinary } from "cloudinary";
import blogModel from "../models/blogModel.js";

// ─── helpers ────────────────────────────────────────────

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ─── Admin: Create blog ─────────────────────────────────

const addBlog = async (req, res) => {
  try {
    const { title, content, excerpt, category, tags, author, isPublished, hospitalId, doctorId } =
      req.body;
    const imageFile = req.file;

    if (!title || !content) {
      return res.json({ success: false, message: "Title and content are required" });
    }

    let baseSlug = slugify(title);
    let slug = baseSlug;
    let counter = 1;
    while (await blogModel.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    let imageUrl = "";
    if (imageFile) {
      const upload = await cloudinary.uploader.upload(imageFile.path, {
        resource_type: "image",
      });
      imageUrl = upload.secure_url;
    }

    const parsedTags = tags
      ? Array.isArray(tags)
        ? tags
        : JSON.parse(tags)
      : [];

    const published = isPublished === true || isPublished === "true";

    const blog = new blogModel({
      title,
      slug,
      content,
      excerpt: excerpt || content.substring(0, 160),
      image: imageUrl,
      category: category || "Other",
      tags: parsedTags,
      author: author || "Admin",
      hospitalId: hospitalId || null,
      doctorId: doctorId || null,
      isPublished: published,
      publishedAt: published ? new Date() : null,
    });

    await blog.save();
    res.json({ success: true, message: "Blog created", blog });
  } catch (error) {
    console.log("Error in addBlog:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Admin: Update blog ─────────────────────────────────

const updateBlog = async (req, res) => {
  try {
    const { blogId, title, content, excerpt, category, tags, author, isPublished, hospitalId, doctorId } =
      req.body;
    const imageFile = req.file;

    if (!blogId) {
      return res.json({ success: false, message: "Blog ID is required" });
    }

    const blog = await blogModel.findById(blogId);
    if (!blog) {
      return res.json({ success: false, message: "Blog not found" });
    }

    if (title !== undefined) {
      blog.title = title;
      // regenerate slug only if title changed
      let baseSlug = slugify(title);
      let slug = baseSlug;
      let counter = 1;
      while (true) {
        const existing = await blogModel.findOne({ slug });
        if (!existing || existing._id.toString() === blogId) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      blog.slug = slug;
    }

    if (content !== undefined) blog.content = content;
    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (category !== undefined) blog.category = category;
    if (author !== undefined) blog.author = author;
    if (hospitalId !== undefined) blog.hospitalId = hospitalId || null;
    if (doctorId !== undefined) blog.doctorId = doctorId || null;

    if (tags !== undefined) {
      blog.tags = Array.isArray(tags) ? tags : JSON.parse(tags);
    }

    if (imageFile) {
      const upload = await cloudinary.uploader.upload(imageFile.path, {
        resource_type: "image",
      });
      blog.image = upload.secure_url;
    }

    if (isPublished !== undefined) {
      const published = isPublished === true || isPublished === "true";
      if (published && !blog.isPublished) {
        blog.publishedAt = new Date();
      }
      blog.isPublished = published;
    }

    await blog.save();
    res.json({ success: true, message: "Blog updated", blog });
  } catch (error) {
    console.log("Error in updateBlog:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Admin: Delete blog ─────────────────────────────────

const deleteBlog = async (req, res) => {
  try {
    const { blogId } = req.body;

    if (!blogId) {
      return res.json({ success: false, message: "Blog ID is required" });
    }

    const blog = await blogModel.findByIdAndDelete(blogId);
    if (!blog) {
      return res.json({ success: false, message: "Blog not found" });
    }

    res.json({ success: true, message: "Blog deleted" });
  } catch (error) {
    console.log("Error in deleteBlog:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Admin: List all blogs (published + drafts) ────────

const adminListBlogs = async (req, res) => {
  try {
    const { page, limit, category, search, hospitalId, doctorId } = req.query;

    const pageNumber = Math.max(parseInt(page || "1", 10), 1);
    const limitNumber = Math.min(Math.max(parseInt(limit || "12", 10), 1), 50);
    const skipCount = (pageNumber - 1) * limitNumber;

    const filter = {};
    if (category) filter.category = category;
    if (search) filter.title = { $regex: escapeRegExp(search), $options: "i" };
    if (hospitalId) filter.hospitalId = hospitalId;
    if (doctorId) filter.doctorId = doctorId;

    const blogs = await blogModel
      .find(filter)
      .populate("hospitalId", "name city image")
      .populate("doctorId", "name speciality image")
      .sort({ _id: -1 })
      .skip(skipCount)
      .limit(limitNumber)
      .select("-content");

    const totalCount = await blogModel.countDocuments(filter);

    res.json({
      success: true,
      blogs,
      pagination: { page: pageNumber, limit: limitNumber, total: totalCount },
    });
  } catch (error) {
    console.log("Error in adminListBlogs:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Admin: Get single blog for editing ─────────────────

const adminGetBlog = async (req, res) => {
  try {
    const { blogId } = req.params;
    const blog = await blogModel.findById(blogId);
    if (!blog) {
      return res.json({ success: false, message: "Blog not found" });
    }
    res.json({ success: true, blog });
  } catch (error) {
    console.log("Error in adminGetBlog:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Public: List published blogs ───────────────────────

const listBlogs = async (req, res) => {
  try {
    const { page, limit, category, tag, search, hospitalId } = req.query;

    const pageNumber = Math.max(parseInt(page || "1", 10), 1);
    const limitNumber = Math.min(Math.max(parseInt(limit || "9", 10), 1), 30);
    const skipCount = (pageNumber - 1) * limitNumber;

    const filter = { isPublished: true };
    if (category) filter.category = category;
    if (tag) filter.tags = tag;
    if (search) filter.title = { $regex: escapeRegExp(search), $options: "i" };
    if (hospitalId) filter.hospitalId = hospitalId;

    const blogs = await blogModel
      .find(filter)
      .populate("hospitalId", "name city image")
      .populate("doctorId", "name speciality image")
      .sort({ publishedAt: -1 })
      .skip(skipCount)
      .limit(limitNumber)
      .select("-content");

    const totalCount = await blogModel.countDocuments(filter);

    res.json({
      success: true,
      blogs,
      pagination: { page: pageNumber, limit: limitNumber, total: totalCount },
    });
  } catch (error) {
    console.log("Error in listBlogs:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Public: Get single blog by slug ────────────────────

const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const blog = await blogModel.findOneAndUpdate(
      { slug, isPublished: true },
      { $inc: { views: 1 } },
      { new: true }
    ).populate("hospitalId", "name city image address")
     .populate("doctorId", "name speciality image");

    if (!blog) {
      return res.json({ success: false, message: "Blog not found" });
    }

    // fetch related blogs (same category, excluding current)
    const related = await blogModel
      .find({ category: blog.category, isPublished: true, _id: { $ne: blog._id } })
      .populate("hospitalId", "name city image")
      .populate("doctorId", "name speciality image")
      .sort({ publishedAt: -1 })
      .limit(3)
      .select("-content");

    res.json({ success: true, blog, related });
  } catch (error) {
    console.log("Error in getBlogBySlug:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Doctor: Create blog ────────────────────────────────

const doctorAddBlog = async (req, res) => {
  try {
    const { docId, title, content, excerpt, category, tags, isPublished } = req.body;
    const imageFile = req.file;

    if (!title || !content) {
      return res.json({ success: false, message: "Title and content are required" });
    }

    const doctor = await (await import("../models/doctorModel.js")).default.findById(docId).select("name hospitalId");
    if (!doctor) {
      return res.json({ success: false, message: "Doctor not found" });
    }

    let baseSlug = slugify(title);
    let slug = baseSlug;
    let counter = 1;
    while (await blogModel.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    let imageUrl = "";
    if (imageFile) {
      const upload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" });
      imageUrl = upload.secure_url;
    }

    const parsedTags = tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [];
    const published = isPublished === true || isPublished === "true";

    const blog = new blogModel({
      title,
      slug,
      content,
      excerpt: excerpt || content.substring(0, 160),
      image: imageUrl,
      category: category || "Other",
      tags: parsedTags,
      author: doctor.name,
      hospitalId: doctor.hospitalId || null,
      doctorId: docId,
      isPublished: published,
      publishedAt: published ? new Date() : null,
    });

    await blog.save();
    res.json({ success: true, message: "Blog created", blog });
  } catch (error) {
    console.log("Error in doctorAddBlog:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Doctor: Update own blog ────────────────────────────

const doctorUpdateBlog = async (req, res) => {
  try {
    const { docId, blogId, title, content, excerpt, category, tags, isPublished } = req.body;
    const imageFile = req.file;

    if (!blogId) return res.json({ success: false, message: "Blog ID is required" });

    const blog = await blogModel.findById(blogId);
    if (!blog) return res.json({ success: false, message: "Blog not found" });
    if (blog.doctorId?.toString() !== docId) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    if (title !== undefined) {
      blog.title = title;
      let baseSlug = slugify(title);
      let slug = baseSlug;
      let counter = 1;
      while (true) {
        const existing = await blogModel.findOne({ slug });
        if (!existing || existing._id.toString() === blogId) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      blog.slug = slug;
    }

    if (content !== undefined) blog.content = content;
    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (category !== undefined) blog.category = category;
    if (tags !== undefined) blog.tags = Array.isArray(tags) ? tags : JSON.parse(tags);

    if (imageFile) {
      const upload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" });
      blog.image = upload.secure_url;
    }

    if (isPublished !== undefined) {
      const published = isPublished === true || isPublished === "true";
      if (published && !blog.isPublished) blog.publishedAt = new Date();
      blog.isPublished = published;
    }

    await blog.save();
    res.json({ success: true, message: "Blog updated", blog });
  } catch (error) {
    console.log("Error in doctorUpdateBlog:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Doctor: Delete own blog ────────────────────────────

const doctorDeleteBlog = async (req, res) => {
  try {
    const { docId, blogId } = req.body;
    if (!blogId) return res.json({ success: false, message: "Blog ID is required" });

    const blog = await blogModel.findById(blogId);
    if (!blog) return res.json({ success: false, message: "Blog not found" });
    if (blog.doctorId?.toString() !== docId) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    await blogModel.findByIdAndDelete(blogId);
    res.json({ success: true, message: "Blog deleted" });
  } catch (error) {
    console.log("Error in doctorDeleteBlog:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Doctor: List own blogs ─────────────────────────────

const doctorListBlogs = async (req, res) => {
  try {
    const { docId } = req.body;
    const { page, limit, category, search } = req.query;

    const pageNumber = Math.max(parseInt(page || "1", 10), 1);
    const limitNumber = Math.min(Math.max(parseInt(limit || "12", 10), 1), 50);
    const skipCount = (pageNumber - 1) * limitNumber;

    const filter = { doctorId: docId };
    if (category) filter.category = category;
    if (search) filter.title = { $regex: escapeRegExp(search), $options: "i" };

    const blogs = await blogModel
      .find(filter)
      .populate("hospitalId", "name city image")
      .sort({ _id: -1 })
      .skip(skipCount)
      .limit(limitNumber)
      .select("-content");

    const totalCount = await blogModel.countDocuments(filter);

    res.json({ success: true, blogs, pagination: { page: pageNumber, limit: limitNumber, total: totalCount } });
  } catch (error) {
    console.log("Error in doctorListBlogs:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Doctor: Get single blog for editing ────────────────

const doctorGetBlog = async (req, res) => {
  try {
    const { docId } = req.body;
    const { blogId } = req.params;
    const blog = await blogModel.findById(blogId);
    if (!blog) return res.json({ success: false, message: "Blog not found" });
    if (blog.doctorId?.toString() !== docId) {
      return res.json({ success: false, message: "Unauthorized" });
    }
    res.json({ success: true, blog });
  } catch (error) {
    console.log("Error in doctorGetBlog:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Hospital: Create blog ──────────────────────────────

const hospitalAddBlog = async (req, res) => {
  try {
    const { hospitalId, title, content, excerpt, category, tags, isPublished } = req.body;
    const imageFile = req.file;

    if (!title || !content) {
      return res.json({ success: false, message: "Title and content are required" });
    }

    const hospital = await (await import("../models/hospitalModel.js")).default.findById(hospitalId).select("name");
    if (!hospital) {
      return res.json({ success: false, message: "Hospital not found" });
    }

    let baseSlug = slugify(title);
    let slug = baseSlug;
    let counter = 1;
    while (await blogModel.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    let imageUrl = "";
    if (imageFile) {
      const upload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" });
      imageUrl = upload.secure_url;
    }

    const parsedTags = tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [];
    const published = isPublished === true || isPublished === "true";

    const blog = new blogModel({
      title,
      slug,
      content,
      excerpt: excerpt || content.substring(0, 160),
      image: imageUrl,
      category: category || "Other",
      tags: parsedTags,
      author: hospital.name,
      hospitalId,
      doctorId: null,
      isPublished: published,
      publishedAt: published ? new Date() : null,
    });

    await blog.save();
    res.json({ success: true, message: "Blog created", blog });
  } catch (error) {
    console.log("Error in hospitalAddBlog:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Hospital: Update own blog ──────────────────────────

const hospitalUpdateBlog = async (req, res) => {
  try {
    const { hospitalId, blogId, title, content, excerpt, category, tags, isPublished } = req.body;
    const imageFile = req.file;

    if (!blogId) return res.json({ success: false, message: "Blog ID is required" });

    const blog = await blogModel.findById(blogId);
    if (!blog) return res.json({ success: false, message: "Blog not found" });
    if (blog.hospitalId?.toString() !== hospitalId) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    if (title !== undefined) {
      blog.title = title;
      let baseSlug = slugify(title);
      let slug = baseSlug;
      let counter = 1;
      while (true) {
        const existing = await blogModel.findOne({ slug });
        if (!existing || existing._id.toString() === blogId) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      blog.slug = slug;
    }

    if (content !== undefined) blog.content = content;
    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (category !== undefined) blog.category = category;
    if (tags !== undefined) blog.tags = Array.isArray(tags) ? tags : JSON.parse(tags);

    if (imageFile) {
      const upload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" });
      blog.image = upload.secure_url;
    }

    if (isPublished !== undefined) {
      const published = isPublished === true || isPublished === "true";
      if (published && !blog.isPublished) blog.publishedAt = new Date();
      blog.isPublished = published;
    }

    await blog.save();
    res.json({ success: true, message: "Blog updated", blog });
  } catch (error) {
    console.log("Error in hospitalUpdateBlog:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Hospital: Delete own blog ──────────────────────────

const hospitalDeleteBlog = async (req, res) => {
  try {
    const { hospitalId, blogId } = req.body;
    if (!blogId) return res.json({ success: false, message: "Blog ID is required" });

    const blog = await blogModel.findById(blogId);
    if (!blog) return res.json({ success: false, message: "Blog not found" });
    if (blog.hospitalId?.toString() !== hospitalId) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    await blogModel.findByIdAndDelete(blogId);
    res.json({ success: true, message: "Blog deleted" });
  } catch (error) {
    console.log("Error in hospitalDeleteBlog:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Hospital: List own blogs (+ doctor blogs) ─────────

const hospitalListBlogs = async (req, res) => {
  try {
    const { hospitalId } = req.body;
    const { page, limit, category, search, authorType } = req.query;

    const pageNumber = Math.max(parseInt(page || "1", 10), 1);
    const limitNumber = Math.min(Math.max(parseInt(limit || "12", 10), 1), 50);
    const skipCount = (pageNumber - 1) * limitNumber;

    const filter = { hospitalId };
    if (category) filter.category = category;
    if (search) filter.title = { $regex: escapeRegExp(search), $options: "i" };
    if (authorType === "hospital") filter.doctorId = null;
    if (authorType === "doctor") filter.doctorId = { $ne: null };

    const blogs = await blogModel
      .find(filter)
      .populate("doctorId", "name speciality image")
      .sort({ _id: -1 })
      .skip(skipCount)
      .limit(limitNumber)
      .select("-content");

    const totalCount = await blogModel.countDocuments(filter);

    res.json({ success: true, blogs, pagination: { page: pageNumber, limit: limitNumber, total: totalCount } });
  } catch (error) {
    console.log("Error in hospitalListBlogs:", error);
    res.json({ success: false, message: error.message });
  }
};

// ─── Hospital: Get single blog ──────────────────────────

const hospitalGetBlog = async (req, res) => {
  try {
    const { hospitalId } = req.body;
    const { blogId } = req.params;
    const blog = await blogModel.findById(blogId);
    if (!blog) return res.json({ success: false, message: "Blog not found" });
    if (blog.hospitalId?.toString() !== hospitalId) {
      return res.json({ success: false, message: "Unauthorized" });
    }
    res.json({ success: true, blog });
  } catch (error) {
    console.log("Error in hospitalGetBlog:", error);
    res.json({ success: false, message: error.message });
  }
};

export {
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
};
