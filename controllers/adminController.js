import validator from 'validator';
import bcrypt from 'bcrypt';
import {v2 as cloudinary} from 'cloudinary'
import doctorModel from '../models/doctorModel.js';
import jwt from 'jsonwebtoken';
import appointmentModel from '../models/appointmentModel.js';
import userModel from '../models/userModel.js';
import hospitalModel from '../models/hospitalModel.js';

// API for adding doctor

const addDoctor = async (req, res) => {

    try {
        const { name, email, password, speciality, experience, degree, about, fees, address, hospitalId } = req.body;
        const imageFile = req.file;
        
        // checking for all data to add doctor
        if (!name || !email || !password || !speciality || !experience || !degree || !about || !fees || !address || !hospitalId) {
            return res.json({success:false, message:'All fields are required'});
        }

        // Validate hospital exists and is registered
        const hospital = await hospitalModel.findById(hospitalId);
        if (!hospital) {
            return res.json({ success: false, message: 'Hospital not found' });
        }
        if (!hospital.isRegistered) {
            return res.json({ success: false, message: 'Doctor can only be assigned to a registered hospital' });
        }

        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: 'Invalid email address' });
        }

        // validate strong password
        if (!validator.isStrongPassword(password)) {
            return res.json({ success: false, message: 'Password is not strong enough. It should be at least 8 characters long and include uppercase letters, lowercase letters, numbers, and symbols.' });
        }

        // hash password
        const salt = await bcrypt.genSalt(10);
        const hashedpassword = await bcrypt.hash(password, salt);

        // upload image to cloudinary
        const imageUpload = await cloudinary.uploader.upload(imageFile.path, {resource_type: 'image'});
        const imageUrl = imageUpload.secure_url;

        // prepare doctor data
        const doctorData = {
            name,
            email,
            password: hashedpassword,
            image: imageUrl,
            speciality,
            experience,
            degree,
            about,
            // available,
            fees,
            address: JSON.parse(address),
            hospitalId,
            date: Date.now(),
            slots_booked: {}
        };

        // save doctor data to database
        const newDoctor = new doctorModel(doctorData);
        await newDoctor.save();

        res.json({ success: true, message: 'Doctor added successfully' });

    } catch (error) {
        console.log('Error in addDoctor:', error);
        res.json({ success: false, message: error.message});
    }
}

// API for admin login
const loginAdmin = async (req, res) => {
    try {

        const { email, password } = req.body;

        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PW) {
            
            // generate JWT token
            // const token = jwt.sign(
            //     { email: process.env.ADMIN_EMAIL },
            //     process.env.JWT_SECRET,
            //     { expiresIn: '1h' }
            // );
            const token = jwt.sign(email+password, process.env.JWT_SECRET)
            res.json({ success: true, token });

        }else{
            res.json({ success: false, message: 'Invalid admin credentials' });
        }
        
    } catch (error) {
        console.log('Error in login admin:', error);
        res.json({ success: false, message: error.message});
    }
}

// API for getting all doctors for admin dashboard
const allDoctors = async (req, res) => {

    try {

        const doctors = await doctorModel.find({}).select('-password');
        res.json({ success: true, doctors });
        
    } catch (error) {
        console.log('Error in fetching all doctors:', error);
        res.json({ success: false, message: error.message});
    }

}

// API to get all appointments list for admin dashboard
const appointmentsAdmin = async (req, res) => {

    try {

        const { status, docId, appointmentType, search, page = 1, limit = 20 } = req.query;

        const filter = {};

        // Status filter
        if (status === 'cancelled') {
            filter.cancelled = true;
        } else if (status === 'completed') {
            filter.isCompleted = true;
            filter.cancelled = { $ne: true };
        } else if (status === 'active') {
            filter.cancelled = { $ne: true };
            filter.isCompleted = { $ne: true };
        }

        // Doctor filter
        if (docId) {
            filter.docId = docId;
        }

        // Appointment type filter
        if (appointmentType && ['in-person', 'video'].includes(appointmentType)) {
            filter.appointmentType = appointmentType;
        }

        // Search by patient name
        if (search) {
            filter['userData.name'] = { $regex: search, $options: 'i' };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await appointmentModel.countDocuments(filter);
        const appointments = await appointmentModel
            .find(filter)
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({ success: true, appointments, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
        
    } catch (error) {
        console.log('Error in admin appointments:', error);
        res.json({ success: false, message: error.message});
    }

}

// API for cancelling appointment by admin
const appointmentCancel = async (req, res) => {

    try {
        const { appointmentId } = req.body;

        const appointmentData = await appointmentModel.findById(appointmentId);

        await appointmentModel.findByIdAndUpdate(appointmentId, {cancelled: true});

        // Restore slot in doctor's slots_booked
        const { docId, slotDate, slotTime } = appointmentData;
        const docData = await doctorModel.findById(docId);
        let slots_booked = docData.slots_booked;
        slots_booked[slotDate] = slots_booked[slotDate].filter(time => time !== slotTime);
        await doctorModel.findByIdAndUpdate(docId, { slots_booked });

        res.json({ success: true, message: 'Appointment cancled successfully' });

    } catch (error) {
        console.log('Error in cancelling user appointment:', error);
        res.json({ success: false, message: error.message});
    }

}

// API to get dashboard stats for admin
const adminDashboard = async (req, res) => {

    try {

        const doctors = await doctorModel.find({});
        const users = await userModel.find({});
        const appointments = await appointmentModel.find({});

        const dashboardData = {
            doctors: doctors.length,
            patients: users.length,
            appointments: appointments.length,
            latestAppointments: appointments.slice(-5),
        };

        res.json({ success: true, dashboardData });
        
    } catch (error) {
        console.log('Error in admin Dashboard:', error);
        res.json({ success: false, message: error.message});
    }

}

// API for Hospital Management (Reception Managed) - aggregated view
const hospitalManagement = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, status } = req.query;
        const pageNum = Math.max(parseInt(page), 1);
        const limitNum = Math.min(Math.max(parseInt(limit), 1), 50);

        // Build match stage for hospitals
        const matchStage = {};
        if (search) {
            matchStage.$or = [
                { name: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } },
            ];
        }
        if (status === 'registered') matchStage.isRegistered = true;
        if (status === 'unregistered') matchStage.isRegistered = false;

        const pipeline = [
            { $match: matchStage },
            // Lookup doctors count
            {
                $lookup: {
                    from: 'doctors',
                    localField: '_id',
                    foreignField: 'hospitalId',
                    as: 'doctorsList',
                },
            },
            {
                $addFields: {
                    totalDoctors: { $size: '$doctorsList' },
                    doctorIds: '$doctorsList._id',
                },
            },
            // Lookup appointments for those doctors
            {
                $lookup: {
                    from: 'appointments',
                    let: { docIds: '$doctorIds' },
                    pipeline: [
                        { $match: { $expr: { $in: ['$docId', { $map: { input: '$$docIds', as: 'd', in: { $toString: '$$d' } } }] } } },
                    ],
                    as: 'appointmentsList',
                },
            },
            {
                $addFields: {
                    totalAppointments: { $size: '$appointmentsList' },
                    totalRevenue: { $sum: '$appointmentsList.amount' },
                },
            },
            // Clean up
            {
                $project: {
                    name: 1,
                    city: 1,
                    image: 1,
                    isRegistered: 1,
                    isAvailable: 1,
                    totalDoctors: 1,
                    totalAppointments: 1,
                    totalRevenue: 1,
                },
            },
            { $sort: { totalAppointments: -1, _id: -1 } },
            {
                $facet: {
                    data: [{ $skip: (pageNum - 1) * limitNum }, { $limit: limitNum }],
                    total: [{ $count: 'count' }],
                },
            },
        ];

        const [result] = await hospitalModel.aggregate(pipeline);
        const hospitals = result?.data || [];
        const total = result?.total?.[0]?.count || 0;

        res.json({
            success: true,
            hospitals,
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
        });
    } catch (error) {
        console.log('Error in hospitalManagement:', error);
        res.json({ success: false, message: error.message });
    }
};

export { addDoctor, loginAdmin, allDoctors, appointmentsAdmin, appointmentCancel, adminDashboard, hospitalManagement };