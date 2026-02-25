import doctorModel from "../models/doctorModel.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import appointmentModel from "../models/appointmentModel.js";

const changeAvailability = async (req, res) => {

    try {
        
        const { doctorId, date, slot, available } = req.body;

        const doctorData = await doctorModel.findById(doctorId);
        await doctorModel.findByIdAndUpdate(doctorId, {available: !doctorData.available});
        res.json({ success: true, message: 'Doctor availability updated successfully' });

    } catch (error) {
        console.log('Error in changeAvailability:', error);
        res.json({ success: false, message: error.message});
    }

}

const doctorList = async (req, res) => {
    try {
        
        const doctors = await doctorModel.find({}).select(["-password", "-email"]).populate("hospitalId", "name city image");
        res.json({ success: true, doctors });

    } catch (error) {
        console.log('Error in doctorList:', error);
        res.json({ success: false, message: error.message});
    }
}

// API for doctor Login
const doctorLogin = async (req, res) => {

    try {
        const { email, password } = req.body;
        const doctor = await doctorModel.findOne({ email });

        if (!doctor) {
            return res.json({ success: false, message: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, doctor.password);
        if (isMatch) {

            const token = jwt.sign({ id: doctor._id }, process.env.JWT_SECRET);
            res.json({ success: true, message: 'Doctor login successful',token });
            
        } else {
            res.json({ success: false, message: 'Invalid email or password' });
        }

    } catch (error) {
        console.log('Error in doctorLogin:', error);
        res.json({ success: false, message: error.message });
    }

}

// API to get doctor appointments for doctor panel
const getDoctorAppointments = async (req, res) => {
    try {

        const { docId } = req.body;
        const appointments = await appointmentModel.find({docId});
        res.json({ success: true, appointments });

    } catch (error) {
        console.log('Error in getDoctorAppointments:', error);
        res.json({ success: false, message: error.message });
    }
}

// API for appointment cancellation by doctor
const cancelDoctorAppointment = async (req, res) => {

    try {
        
        const { docId, appointmentId } = req.body;
        const appointmentData = await appointmentModel.findById(appointmentId);

        if(appointmentData && appointmentData.docId === docId){
            await appointmentModel.findByIdAndUpdate(appointmentId, {cancelled: true});
            return res.json({ success: true, message: 'Appointment Cancelled Successfully' });
        }else{
            return res.json({ success: false, message: 'Appointment not found or unauthorized' });
        }

    } catch (error) {
        console.log('Error in cancelling doctor appointment:', error);
        res.json({ success: false, message: error.message});
    }

}

// API for appointment completion by doctor
const completeDoctorAppointment = async (req, res) => {

    try {

        const { docId, appointmentId, prescription, followUpDate } = req.body;
        const appointmentData = await appointmentModel.findById(appointmentId);

        if(appointmentData && appointmentData.docId === docId){
            const updateData = { isCompleted: true };
            if (prescription) updateData.prescription = prescription;
            if (followUpDate) updateData.followUpDate = followUpDate;
            await appointmentModel.findByIdAndUpdate(appointmentId, updateData);
            return res.json({ success: true, message: 'Appointment marked as completed' });
        }else{
            return res.json({ success: false, message: 'Appointment not found or unauthorized' });
        }
        
    } catch (error) {
        console.log('Error in completing doctor appointment:', error);
        res.json({ success: false, message: error.message});
    }
}

// API to add/update prescription for an appointment
const addPrescription = async (req, res) => {
    try {
        const { docId, appointmentId, prescription, followUpDate } = req.body;

        if (!appointmentId || !prescription) {
            return res.json({ success: false, message: 'Appointment ID and prescription are required' });
        }

        const appointmentData = await appointmentModel.findById(appointmentId);
        if (!appointmentData) {
            return res.json({ success: false, message: 'Appointment not found' });
        }

        if (appointmentData.docId !== docId) {
            return res.json({ success: false, message: 'Unauthorized action' });
        }

        if (appointmentData.cancelled) {
            return res.json({ success: false, message: 'Cannot add prescription to cancelled appointment' });
        }

        const updateData = { prescription };
        if (followUpDate) updateData.followUpDate = followUpDate;

        await appointmentModel.findByIdAndUpdate(appointmentId, updateData);

        res.json({ success: true, message: 'Prescription added successfully' });

    } catch (error) {
        console.log('Error in addPrescription:', error);
        res.json({ success: false, message: error.message });
    }
}

// API for doctor dashboard data
const doctorDashboard = async (req, res) => {

    try {

        const { docId } = req.body;
        const appointments = await appointmentModel.find({ docId });

        let earnings = 0;
        appointments.map((appointment) => {
            if(appointment.isCompleted || !appointment.payment){
                earnings += appointment.amount;
            }
        });

        let patients = [];
        appointments.map((appointment) => {
            if(!patients.includes(appointment.userId)){
                patients.push(appointment.userId);
            }
        });

        const dashboardData = {
            earnings,
            appointments: appointments.length,
            patients: patients.length,
            latestAppointments: appointments.reverse().slice(0,5),
        };

        res.json({ success: true, dashboardData });

    } catch (error) {
        console.log('Error in doctorDashboard:', error);
        res.json({ success: false, message: error.message });
    }

}

// API to get doctor profile data
const doctorProfile = async (req, res) => {

    try {

        const {docId} = req.body;
        const profileData = await doctorModel.findById(docId).select('-password');

        res.json({ success: true, profileData });
        
    } catch (error) {
        console.log('Error in getting user data:', error);
        res.json({ success: false, message: error.message});
    }

}

// API to update doctor profile data
const updateDoctorProfile = async (req, res) => {
    // Update profile logic here
    try {

        const {docId, fees, address, available } = req.body;

        await doctorModel.findByIdAndUpdate(docId, {fees, address, available});

        res.json({ success: true, message: 'Profile updated successfully' });
        
    } catch (error) {
        console.log('Error in updating user profile:', error);
        res.json({ success: false, message: error.message});
    }
}

// API to update doctor schedule/availability settings
const updateDoctorSchedule = async (req, res) => {
    try {
        const { docId } = req.body;
        const { schedule, slotDuration } = req.body;

        const updateData = {};
        if (schedule) updateData.schedule = schedule;
        if (slotDuration) updateData.slotDuration = slotDuration;

        await doctorModel.findByIdAndUpdate(docId, updateData);

        res.json({ success: true, message: 'Schedule updated successfully' });
    } catch (error) {
        console.log('Error updating schedule:', error);
        res.json({ success: false, message: error.message });
    }
}

// API to get doctor's blocked dates
const getDoctorBlockedDates = async (req, res) => {
    try {
        const { docId } = req.body;
        const doctor = await doctorModel.findById(docId).select('blockedDates schedule slotDuration');

        res.json({ 
            success: true, 
            blockedDates: doctor.blockedDates || [],
            schedule: doctor.schedule,
            slotDuration: doctor.slotDuration
        });
    } catch (error) {
        console.log('Error getting blocked dates:', error);
        res.json({ success: false, message: error.message });
    }
}

// API to add blocked dates (vacation/leave)
const addBlockedDates = async (req, res) => {
    try {
        const { docId } = req.body;
        const { dates, reason } = req.body; // dates is array of ISO date strings

        if (!dates || !Array.isArray(dates)) {
            return res.json({ success: false, message: 'Please provide dates array' });
        }

        const doctor = await doctorModel.findById(docId);
        const existingDates = doctor.blockedDates || [];
        const newDates = [...new Set([...existingDates, ...dates])]; // Remove duplicates

        await doctorModel.findByIdAndUpdate(docId, { blockedDates: newDates });

        res.json({ success: true, message: 'Dates blocked successfully', blockedDates: newDates });
    } catch (error) {
        console.log('Error adding blocked dates:', error);
        res.json({ success: false, message: error.message });
    }
}

// API to remove blocked dates
const removeBlockedDates = async (req, res) => {
    try {
        const { docId } = req.body;
        const { dates } = req.body; // dates is array of ISO date strings to remove

        if (!dates || !Array.isArray(dates)) {
            return res.json({ success: false, message: 'Please provide dates array' });
        }

        const doctor = await doctorModel.findById(docId);
        const existingDates = doctor.blockedDates || [];
        const newDates = existingDates.filter(d => !dates.includes(d));

        await doctorModel.findByIdAndUpdate(docId, { blockedDates: newDates });

        res.json({ success: true, message: 'Dates unblocked successfully', blockedDates: newDates });
    } catch (error) {
        console.log('Error removing blocked dates:', error);
        res.json({ success: false, message: error.message });
    }
}

// API for doctor analytics data
const doctorAnalytics = async (req, res) => {
    try {
        const { docId } = req.body;
        const appointments = await appointmentModel.find({ docId }).lean();

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        const lastMonthEnd = thisMonthStart;

        // Basic stats
        const totalAppointments = appointments.length;
        const completedAppointments = appointments.filter(a => a.isCompleted).length;
        const cancelledAppointments = appointments.filter(a => a.cancelled).length;
        const activeAppointments = appointments.filter(a => !a.cancelled && !a.isCompleted).length;

        // Completion rate
        const completionRate = totalAppointments > 0
            ? Math.round((completedAppointments / totalAppointments) * 100)
            : 0;

        // This month vs last month
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

        // Unique patients
        const uniquePatients = [...new Set(appointments.map(a => a.userId?.toString()).filter(Boolean))];

        // Appointment type breakdown
        const videoCount = appointments.filter(a => a.appointmentType === 'video').length;
        const inPersonCount = totalAppointments - videoCount;

        // Monthly trend (last 6 months)
        const monthlyTrend = [];
        for (let i = 5; i >= 0; i--) {
            const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short' });

            const monthAppointments = appointments.filter(
                a => a.date >= monthStart.getTime() && a.date < monthEnd.getTime()
            ).length;
            const monthCompleted = appointments.filter(
                a => a.date >= monthStart.getTime() && a.date < monthEnd.getTime() && a.isCompleted
            ).length;
            const monthRevenue = appointments
                .filter(a => a.date >= monthStart.getTime() && a.date < monthEnd.getTime() && (a.isCompleted || a.payment))
                .reduce((sum, a) => sum + (a.amount || 0), 0);

            monthlyTrend.push({ month: monthLabel, appointments: monthAppointments, completed: monthCompleted, revenue: monthRevenue });
        }

        // Weekly trend (last 4 weeks)
        const weeklyTrend = [];
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
            const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
            const weekLabel = `Week ${4 - i}`;

            const weekAppointments = appointments.filter(
                a => a.date >= weekStart.getTime() && a.date < weekEnd.getTime()
            ).length;

            weeklyTrend.push({ week: weekLabel, appointments: weekAppointments });
        }

        // Average rating (if available)
        const ratingsData = appointments.filter(a => a.rating);
        const avgRating = ratingsData.length > 0
            ? (ratingsData.reduce((sum, a) => sum + a.rating, 0) / ratingsData.length).toFixed(1)
            : null;

        res.json({
            success: true,
            analytics: {
                stats: {
                    totalAppointments,
                    completedAppointments,
                    cancelledAppointments,
                    activeAppointments,
                    completionRate,
                    appointmentGrowth,
                    thisMonthAppointments,
                    totalPatients: uniquePatients.length,
                },
                revenue: {
                    totalRevenue,
                    thisMonthRevenue,
                    revenueGrowth,
                },
                breakdown: {
                    videoCount,
                    inPersonCount,
                },
                monthlyTrend,
                weeklyTrend,
                avgRating,
            }
        });

    } catch (error) {
        console.log('Error in doctorAnalytics:', error);
        res.json({ success: false, message: error.message });
    }
}

export { 
    changeAvailability, 
    doctorList, 
    doctorLogin, 
    getDoctorAppointments, 
    cancelDoctorAppointment, 
    completeDoctorAppointment, 
    addPrescription, 
    doctorDashboard, 
    doctorProfile, 
    updateDoctorProfile, 
    doctorAnalytics,
    updateDoctorSchedule,
    getDoctorBlockedDates,
    addBlockedDates,
    removeBlockedDates
};