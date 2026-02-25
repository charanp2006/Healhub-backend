import hospitalModel from "../models/hospitalModel.js";
import doctorModel from "../models/doctorModel.js";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {v2 as cloudinary} from 'cloudinary';
import appointmentModel from "../models/appointmentModel.js";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const addHospital = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      city,
      address,
      lat,
      lng,
      specialties,
      image,
      about,
      isRegistered,
      isAvailable,
      totalBeds,
      availableBeds,
      ratingAverage,
      ratingCount,
    } = req.body;

    if (!name || !email || !password || !city || lat === undefined || lng === undefined) {
      return res.json({ success: false, message: "Required data missing" });
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Invalid email address" });
    }

    if (!validator.isStrongPassword(password)) {
      return res.json({ success: false, message: "Password is not strong enough. It should be at least 8 characters long and include uppercase letters, lowercase letters, numbers, and symbols." });
    }

    // Check for duplicate email
    const existingHospital = await hospitalModel.findOne({ email });
    if (existingHospital) {
      return res.json({ success: false, message: "A hospital with this email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const latitude = parseNumber(lat);
    const longitude = parseNumber(lng);

    if (latitude === null || longitude === null) {
      return res.json({ success: false, message: "Invalid coordinates" });
    }

    const parsedAddress = address ? JSON.parse(address) : { line1: "", line2: "" };
    const parsedSpecialties = specialties
      ? Array.isArray(specialties)
        ? specialties
        : JSON.parse(specialties)
      : [];

    const totalBedsValue = parseNumber(totalBeds) ?? 0;
    const availableBedsValue = parseNumber(availableBeds) ?? 0;

    if (availableBedsValue < 0 || totalBedsValue < 0) {
      return res.json({ success: false, message: "Bed counts cannot be negative" });
    }

    if (availableBedsValue > totalBedsValue) {
      return res.json({
        success: false,
        message: "Available beds cannot exceed total beds",
      });
    }

    const hospitalData = {
      name,
      email,
      password: hashedPassword,
      city,
      address: parsedAddress,
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      image: image || "",
      about: about || "",
      specialties: parsedSpecialties,
      ratingAverage: parseNumber(ratingAverage) ?? 0,
      ratingCount: parseNumber(ratingCount) ?? 0,
      isRegistered: isRegistered === true || isRegistered === "true",
      isAvailable: isAvailable !== "false",
      totalBeds: totalBedsValue,
      availableBeds: availableBedsValue,
    };

    const newHospital = new hospitalModel(hospitalData);
    await newHospital.save();

    res.json({ success: true, message: "Hospital added successfully" });
  } catch (error) {
    console.log("Error in addHospital:", error);
    res.json({ success: false, message: error.message });
  }
};

const listHospitals = async (req, res) => {
  try {
    const {
      name,
      city,
      speciality,
      lat,
      lng,
      radius,
      sort,
      page,
      limit,
    } = req.query;

    const pageNumber = Math.max(parseInt(page || "1", 10), 1);
    const limitNumber = Math.min(Math.max(parseInt(limit || "10", 10), 1), 50);
    const skipCount = (pageNumber - 1) * limitNumber;

    const matchStage = {};

    if (name) {
      matchStage.name = { $regex: escapeRegExp(name), $options: "i" };
    }

    if (city) {
      matchStage.city = { $regex: escapeRegExp(city), $options: "i" };
    }

    if (speciality) {
      matchStage.specialties = { $regex: escapeRegExp(speciality), $options: "i" };
    }

    const sortMap = {
      rating: { ratingAverage: -1, ratingCount: -1 },
      availability: { isAvailable: -1, availableBeds: -1 },
      distance: { distance: 1 },
      latest: { _id: -1 },
    };

    const sortStage = sortMap[sort] || { _id: -1 };

    const fields = {
      name: 1,
      city: 1,
      address: 1,
      image: 1,
      about: 1,
      specialties: 1,
      ratingAverage: 1,
      ratingCount: 1,
      isRegistered: 1,
      isAvailable: 1,
      totalBeds: 1,
      availableBeds: 1,
    };

    if (lat !== undefined && lng !== undefined) {
      const latitude = parseNumber(lat);
      const longitude = parseNumber(lng);

      if (latitude === null || longitude === null) {
        return res.json({ success: false, message: "Invalid coordinates" });
      }

      const radiusKm = parseNumber(radius) ?? null;
      const maxDistance = radiusKm ? radiusKm * 1000 : undefined;

      const pipeline = [
        {
          $geoNear: {
            near: { type: "Point", coordinates: [longitude, latitude] },
            distanceField: "distance",
            spherical: true,
            ...(maxDistance ? { maxDistance } : {}),
          },
        },
        { $match: matchStage },
        {
          $addFields: {
            distanceKm: {
              $round: [{ $divide: ["$distance", 1000] }, 2],
            },
          },
        },
        { $sort: sortStage },
        {
          $facet: {
            data: [
              { $skip: skipCount },
              { $limit: limitNumber },
              { $project: { ...fields, distanceKm: 1 } },
            ],
            total: [{ $count: "count" }],
          },
        },
      ];

      const [result] = await hospitalModel.aggregate(pipeline);
      const totalCount = result?.total?.[0]?.count || 0;

      return res.json({
        success: true,
        hospitals: result?.data || [],
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total: totalCount,
        },
      });
    }

    const hospitals = await hospitalModel
      .find(matchStage)
      .select(fields)
      .sort(sortStage)
      .skip(skipCount)
      .limit(limitNumber);

    const totalCount = await hospitalModel.countDocuments(matchStage);

    res.json({
      success: true,
      hospitals,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: totalCount,
      },
    });
  } catch (error) {
    console.log("Error in listHospitals:", error);
    res.json({ success: false, message: error.message });
  }
};

const getHospitalProfile = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const hospital = await hospitalModel.findById(hospitalId).select("-password -__v");

    if (!hospital) {
      return res.json({ success: false, message: "Hospital not found" });
    }

    const doctors = await doctorModel
      .find({ hospitalId })
      .select(["-password", "-email"]);

    res.json({ success: true, hospital, doctors });
  } catch (error) {
    console.log("Error in getHospitalProfile:", error);
    res.json({ success: false, message: error.message });
  }
};

const validateHospitalBooking = async (req, res) => {
  try {
    const { hospitalId } = req.body;

    const hospital = await hospitalModel.findById(hospitalId).select("isRegistered");

    if (!hospital) {
      return res.json({ success: false, message: "Hospital not found" });
    }

    if (!hospital.isRegistered) {
      return res.json({
        success: false,
        message: "Hospital is not registered for bookings",
      });
    }

    res.json({ success: true, message: "Booking eligible" });
  } catch (error) {
    console.log("Error in validateHospitalBooking:", error);
    res.json({ success: false, message: error.message });
  }
};

// Lightweight endpoint: returns only registered hospitals (id + name) for dropdowns
const getRegisteredHospitals = async (req, res) => {
  try {
    const hospitals = await hospitalModel
      .find({ isRegistered: true })
      .select('name city')
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, hospitals });
  } catch (error) {
    console.log('Error in getRegisteredHospitals:', error);
    res.json({ success: false, message: error.message });
  }
};

// Hospital Login
const hospitalLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const hospital = await hospitalModel.findOne({ email });

    if (!hospital) {
      return res.json({ success: false, message: 'Invalid email or password' });
    }

    if (!hospital.isRegistered) {
      return res.json({ success: false, message: 'Hospital is not registered. Contact admin.' });
    }

    const isMatch = await bcrypt.compare(password, hospital.password);
    if (!isMatch) {
      return res.json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: hospital._id }, process.env.JWT_SECRET);
    res.json({ success: true, token });
  } catch (error) {
    console.log('Error in hospitalLogin:', error);
    res.json({ success: false, message: error.message });
  }
};

// Hospital Dashboard
const hospitalDashboard = async (req, res) => {
  try {
    const { hospitalId } = req.body;

    const doctors = await doctorModel.find({ hospitalId }).select('-password');
    const appointments = await appointmentModel.find({ docId: { $in: doctors.map(d => d._id) } });

    const dashboardData = {
      doctors: doctors.length,
      appointments: appointments.length,
      latestAppointments: appointments.slice(-5),
    };

    res.json({ success: true, dashboardData });
  } catch (error) {
    console.log('Error in hospitalDashboard:', error);
    res.json({ success: false, message: error.message });
  }
};

// Hospital adds a doctor (scoped to their own hospital)
const hospitalAddDoctor = async (req, res) => {
  try {
    const { hospitalId, name, email, password, speciality, experience, degree, about, fees, address } = req.body;
    const imageFile = req.file;

    if (!name || !email || !password || !speciality || !experience || !degree || !about || !fees || !address) {
      return res.json({ success: false, message: 'All fields are required' });
    }

    // Verify this hospital is registered
    const hospital = await hospitalModel.findById(hospitalId);
    if (!hospital) {
      return res.json({ success: false, message: 'Hospital not found' });
    }
    if (!hospital.isRegistered) {
      return res.json({ success: false, message: 'Hospital is not registered' });
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: 'Invalid email address' });
    }

    if (!validator.isStrongPassword(password)) {
      return res.json({ success: false, message: 'Password is not strong enough. It should be at least 8 characters long and include uppercase letters, lowercase letters, numbers, and symbols.' });
    }

    // Check duplicate doctor email
    const existingDoctor = await doctorModel.findOne({ email });
    if (existingDoctor) {
      return res.json({ success: false, message: 'A doctor with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Upload image to cloudinary
    const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: 'image' });
    const imageUrl = imageUpload.secure_url;

    const doctorData = {
      name,
      email,
      password: hashedPassword,
      image: imageUrl,
      speciality,
      experience,
      degree,
      about,
      fees,
      address: JSON.parse(address),
      hospitalId,
      date: Date.now(),
      slots_booked: {},
    };

    const newDoctor = new doctorModel(doctorData);
    await newDoctor.save();

    res.json({ success: true, message: 'Doctor added successfully' });
  } catch (error) {
    console.log('Error in hospitalAddDoctor:', error);
    res.json({ success: false, message: error.message });
  }
};

// Hospital gets its own doctors
const hospitalGetDoctors = async (req, res) => {
  try {
    const { hospitalId } = req.body;
    const doctors = await doctorModel.find({ hospitalId }).select('-password');
    res.json({ success: true, doctors });
  } catch (error) {
    console.log('Error in hospitalGetDoctors:', error);
    res.json({ success: false, message: error.message });
  }
};

// Hospital Profile (own data)
const hospitalProfile = async (req, res) => {
  try {
    const { hospitalId } = req.body;
    const hospital = await hospitalModel.findById(hospitalId).select('-password');
    if (!hospital) {
      return res.json({ success: false, message: 'Hospital not found' });
    }
    res.json({ success: true, profileData: hospital });
  } catch (error) {
    console.log('Error in hospitalProfile:', error);
    res.json({ success: false, message: error.message });
  }
};

// Update Hospital Profile
const updateHospitalProfile = async (req, res) => {
  try {
    const { hospitalId, about, address, specialties, isAvailable, totalBeds, availableBeds } = req.body;
    const imageFile = req.file;

    const updateData = {};

    if (about !== undefined) updateData.about = about;
    if (address !== undefined) {
      updateData.address = typeof address === "string" ? JSON.parse(address) : address;
    }
    if (specialties !== undefined) {
      updateData.specialties = typeof specialties === "string" ? JSON.parse(specialties) : specialties;
    }
    if (isAvailable !== undefined) {
      updateData.isAvailable = isAvailable === true || isAvailable === "true";
    }
    if (totalBeds !== undefined) {
      const beds = Number(totalBeds);
      if (!isNaN(beds) && beds >= 0) updateData.totalBeds = beds;
    }
    if (availableBeds !== undefined) {
      const beds = Number(availableBeds);
      if (!isNaN(beds) && beds >= 0) updateData.availableBeds = beds;
    }

    // Handle image upload
    if (imageFile) {
      const upload = await cloudinary.uploader.upload(imageFile.path, {
        resource_type: "image",
      });
      updateData.image = upload.secure_url;
    }

    await hospitalModel.findByIdAndUpdate(hospitalId, updateData);
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.log('Error in updateHospitalProfile:', error);
    res.json({ success: false, message: error.message });
  }
};

// Hospital Panel Analytics - own hospital analytics
const hospitalPanelAnalytics = async (req, res) => {
  try {
    const { hospitalId } = req.body;

    const hospital = await hospitalModel.findById(hospitalId).select("name city").lean();
    if (!hospital) {
      return res.json({ success: false, message: "Hospital not found" });
    }

    // Get all doctors for this hospital
    const doctors = await doctorModel.find({ hospitalId }).lean();
    const doctorIds = doctors.map(d => d._id.toString());

    // Get all appointments for this hospital's doctors
    const appointments = await appointmentModel.find({ docId: { $in: doctorIds } }).lean();

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const lastMonthEnd = thisMonthStart;

    // Basic stats
    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter(a => a.isCompleted).length;
    const cancelledAppointments = appointments.filter(a => a.cancelled).length;
    const activeAppointments = appointments.filter(a => !a.cancelled && !a.isCompleted).length;

    const thisMonthAppointments = appointments.filter(a => a.date >= thisMonthStart).length;
    const lastMonthAppointments = appointments.filter(a => a.date >= lastMonthStart && a.date < lastMonthEnd).length;
    const appointmentGrowth = lastMonthAppointments > 0
      ? Math.round(((thisMonthAppointments - lastMonthAppointments) / lastMonthAppointments) * 100)
      : thisMonthAppointments > 0 ? 100 : 0;

    // Revenue
    const totalRevenue = appointments
      .filter(a => a.isCompleted || a.payment)
      .reduce((sum, a) => sum + (a.amount || 0), 0);

    const thisMonthRevenue = appointments
      .filter(a => a.date >= thisMonthStart && (a.isCompleted || a.payment))
      .reduce((sum, a) => sum + (a.amount || 0), 0);

    const lastMonthRevenue = appointments
      .filter(a => a.date >= lastMonthStart && a.date < lastMonthEnd && (a.isCompleted || a.payment))
      .reduce((sum, a) => sum + (a.amount || 0), 0);

    const revenueGrowth = lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : thisMonthRevenue > 0 ? 100 : 0;

    // Completion rate
    const completionRate = totalAppointments > 0
      ? Math.round((completedAppointments / totalAppointments) * 100) : 0;

    // Top doctors by appointments
    const doctorAppointmentCounts = {};
    appointments.forEach(a => {
      const dId = a.docId?.toString();
      if (dId) doctorAppointmentCounts[dId] = (doctorAppointmentCounts[dId] || 0) + 1;
    });

    const topDoctors = Object.entries(doctorAppointmentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([dId, count]) => {
        const doc = doctors.find(d => d._id.toString() === dId);
        return {
          _id: dId,
          name: doc?.name || "Unknown",
          image: doc?.image || "",
          speciality: doc?.speciality || "",
          appointments: count,
          revenue: appointments
            .filter(a => a.docId?.toString() === dId && (a.isCompleted || a.payment))
            .reduce((sum, a) => sum + (a.amount || 0), 0),
        };
      });

    // Speciality breakdown
    const specialityMap = {};
    doctors.forEach(d => {
      if (!specialityMap[d.speciality]) {
        specialityMap[d.speciality] = { doctors: 0, appointments: 0 };
      }
      specialityMap[d.speciality].doctors++;
    });
    appointments.forEach(a => {
      const doc = doctors.find(d => d._id.toString() === a.docId?.toString());
      if (doc && specialityMap[doc.speciality]) {
        specialityMap[doc.speciality].appointments++;
      }
    });
    const specialityBreakdown = Object.entries(specialityMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.appointments - a.appointments);

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short' });
      
      const monthAppts = appointments.filter(
        a => a.date >= monthStart.getTime() && a.date < monthEnd.getTime()
      );
      const monthRevenue = monthAppts
        .filter(a => a.isCompleted || a.payment)
        .reduce((sum, a) => sum + (a.amount || 0), 0);

      monthlyTrend.push({
        month: monthLabel,
        appointments: monthAppts.length,
        completed: monthAppts.filter(a => a.isCompleted).length,
        cancelled: monthAppts.filter(a => a.cancelled).length,
        revenue: monthRevenue
      });
    }

    res.json({
      success: true,
      analytics: {
        stats: {
          totalDoctors: doctors.length,
          activeDoctors: doctors.filter(d => d.available).length,
          totalAppointments,
          completedAppointments,
          cancelledAppointments,
          activeAppointments,
          completionRate,
          appointmentGrowth,
          thisMonthAppointments,
          totalRevenue,
          thisMonthRevenue,
          revenueGrowth,
        },
        topDoctors,
        specialityBreakdown,
        monthlyTrend,
      }
    });
  } catch (error) {
    console.log('Error in hospitalPanelAnalytics:', error);
    res.json({ success: false, message: error.message });
  }
};

export { addHospital, listHospitals, getHospitalProfile, validateHospitalBooking, getRegisteredHospitals, hospitalLogin, hospitalDashboard, hospitalAddDoctor, hospitalGetDoctors, hospitalProfile, updateHospitalProfile, hospitalPanelAnalytics };
