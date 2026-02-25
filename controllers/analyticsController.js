import appointmentModel from '../models/appointmentModel.js';
import doctorModel from '../models/doctorModel.js';
import userModel from '../models/userModel.js';
import hospitalModel from '../models/hospitalModel.js';
import billingModel from '../models/billingModel.js';

// API to get overview stats with comparisons
const getOverviewStats = async (req, res) => {
    try {
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        const lastMonthEnd = thisMonthStart;

        const [
            totalDoctors,
            totalPatients,
            totalHospitals,
            allAppointments
        ] = await Promise.all([
            doctorModel.countDocuments({}),
            userModel.countDocuments({}),
            hospitalModel.countDocuments({}),
            appointmentModel.find({}).lean()
        ]);

        const totalAppointments = allAppointments.length;
        const completedAppointments = allAppointments.filter(a => a.isCompleted).length;
        const cancelledAppointments = allAppointments.filter(a => a.cancelled).length;
        const activeAppointments = allAppointments.filter(a => !a.cancelled && !a.isCompleted).length;

        const thisMonthAppointments = allAppointments.filter(a => a.date >= thisMonthStart).length;
        const lastMonthAppointments = allAppointments.filter(a => a.date >= lastMonthStart && a.date < lastMonthEnd).length;
        const appointmentGrowth = lastMonthAppointments > 0
            ? Math.round(((thisMonthAppointments - lastMonthAppointments) / lastMonthAppointments) * 100)
            : thisMonthAppointments > 0 ? 100 : 0;

        // Revenue
        const totalRevenue = allAppointments
            .filter(a => a.isCompleted || a.payment)
            .reduce((sum, a) => sum + (a.amount || 0), 0);

        const thisMonthRevenue = allAppointments
            .filter(a => a.date >= thisMonthStart && (a.isCompleted || a.payment))
            .reduce((sum, a) => sum + (a.amount || 0), 0);

        const lastMonthRevenue = allAppointments
            .filter(a => a.date >= lastMonthStart && a.date < lastMonthEnd && (a.isCompleted || a.payment))
            .reduce((sum, a) => sum + (a.amount || 0), 0);

        const revenueGrowth = lastMonthRevenue > 0
            ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
            : thisMonthRevenue > 0 ? 100 : 0;

        // Appointment type breakdown
        const videoCount = allAppointments.filter(a => a.appointmentType === 'video').length;
        const inPersonCount = totalAppointments - videoCount;

        // Payment breakdown
        const onlinePayments = allAppointments.filter(a => a.payment).length;
        const cashPayments = allAppointments.filter(a => !a.payment && (a.isCompleted || (!a.cancelled))).length;

        res.json({
            success: true,
            stats: {
                totalDoctors,
                totalPatients,
                totalHospitals,
                totalAppointments,
                completedAppointments,
                cancelledAppointments,
                activeAppointments,
                appointmentGrowth,
                totalRevenue,
                thisMonthRevenue,
                revenueGrowth,
                videoCount,
                inPersonCount,
                onlinePayments,
                cashPayments,
            }
        });

    } catch (error) {
        console.log('Error in getOverviewStats:', error);
        res.json({ success: false, message: error.message });
    }
};

// API to get appointment trends (last 12 months)
const getAppointmentTrends = async (req, res) => {
    try {
        const now = new Date();
        const trends = [];

        for (let i = 11; i >= 0; i--) {
            const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

            const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

            const startTs = monthStart.getTime();
            const endTs = monthEnd.getTime();

            const monthAppointments = await appointmentModel.find({
                date: { $gte: startTs, $lt: endTs }
            }).lean();

            const booked = monthAppointments.length;
            const completed = monthAppointments.filter(a => a.isCompleted).length;
            const cancelled = monthAppointments.filter(a => a.cancelled).length;
            const revenue = monthAppointments
                .filter(a => a.isCompleted || a.payment)
                .reduce((sum, a) => sum + (a.amount || 0), 0);

            trends.push({ month: monthLabel, booked, completed, cancelled, revenue });
        }

        res.json({ success: true, trends });

    } catch (error) {
        console.log('Error in getAppointmentTrends:', error);
        res.json({ success: false, message: error.message });
    }
};

// API to get doctor performance leaderboard
const getDoctorPerformance = async (req, res) => {
    try {
        const doctors = await doctorModel.find({}).select('name speciality image fees').lean();
        const appointments = await appointmentModel.find({}).lean();

        const performance = doctors.map(doc => {
            const docAppointments = appointments.filter(a => a.docId === doc._id.toString());
            const total = docAppointments.length;
            const completed = docAppointments.filter(a => a.isCompleted).length;
            const cancelled = docAppointments.filter(a => a.cancelled).length;
            const revenue = docAppointments
                .filter(a => a.isCompleted || a.payment)
                .reduce((sum, a) => sum + (a.amount || 0), 0);
            const patientIds = [...new Set(docAppointments.map(a => a.userId))];
            const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

            return {
                _id: doc._id,
                name: doc.name,
                speciality: doc.speciality,
                image: doc.image,
                total,
                completed,
                cancelled,
                revenue,
                patients: patientIds.length,
                completionRate,
            };
        });

        // Sort by revenue descending
        performance.sort((a, b) => b.revenue - a.revenue);

        res.json({ success: true, performance });

    } catch (error) {
        console.log('Error in getDoctorPerformance:', error);
        res.json({ success: false, message: error.message });
    }
};

// API to get speciality distribution
const getSpecialityStats = async (req, res) => {
    try {
        const appointments = await appointmentModel.find({}).lean();

        const specialityMap = {};
        appointments.forEach(a => {
            const spec = a.docData?.speciality || 'Unknown';
            if (!specialityMap[spec]) {
                specialityMap[spec] = { total: 0, revenue: 0 };
            }
            specialityMap[spec].total += 1;
            if (a.isCompleted || a.payment) {
                specialityMap[spec].revenue += a.amount || 0;
            }
        });

        const specialities = Object.entries(specialityMap)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.total - a.total);

        res.json({ success: true, specialities });

    } catch (error) {
        console.log('Error in getSpecialityStats:', error);
        res.json({ success: false, message: error.message });
    }
};

// API to get recent activity feed
const getRecentActivity = async (req, res) => {
    try {
        const recentAppointments = await appointmentModel
            .find({})
            .sort({ date: -1 })
            .limit(20)
            .lean();

        const activities = recentAppointments.map(a => {
            let action = 'booked';
            if (a.isCompleted) action = 'completed';
            else if (a.cancelled) action = 'cancelled';
            else if (a.rescheduled) action = 'rescheduled';

            return {
                _id: a._id,
                action,
                patientName: a.userData?.name || 'Unknown',
                patientImage: a.userData?.image || '',
                doctorName: a.docData?.name || 'Unknown',
                doctorImage: a.docData?.image || '',
                speciality: a.docData?.speciality || '',
                appointmentType: a.appointmentType || 'in-person',
                slotDate: a.slotDate,
                slotTime: a.slotTime,
                amount: a.amount,
                date: a.date,
            };
        });

        res.json({ success: true, activities });

    } catch (error) {
        console.log('Error in getRecentActivity:', error);
        res.json({ success: false, message: error.message });
    }
};

// API to get hospital-level analytics for admin
const getHospitalAnalytics = async (req, res) => {
    try {
        const { hospitalId } = req.query;

        // Build filter for specific hospital or all
        const hospitalFilter = hospitalId ? { _id: hospitalId } : {};
        const hospitals = await hospitalModel.find(hospitalFilter).select("name city image").lean();

        if (hospitals.length === 0) {
            return res.json({ success: true, hospitals: [] });
        }

        const hospitalIds = hospitals.map(h => h._id);

        // Get all doctors for these hospitals
        const doctors = await doctorModel.find({ hospitalId: { $in: hospitalIds } }).lean();
        
        // Create a map of hospitalId -> doctorIds
        const hospitalDoctorMap = {};
        hospitalIds.forEach(hId => {
            hospitalDoctorMap[hId.toString()] = doctors
                .filter(d => d.hospitalId?.toString() === hId.toString())
                .map(d => d._id.toString());
        });

        // Get all appointments
        const allDoctorIds = doctors.map(d => d._id.toString());
        const appointments = await appointmentModel.find({ docId: { $in: allDoctorIds } }).lean();

        // Get billing data
        const billings = await billingModel.find({ hospitalId: { $in: hospitalIds } }).lean();

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        const lastMonthEnd = thisMonthStart;

        // Build analytics for each hospital
        const hospitalAnalytics = hospitals.map(hospital => {
            const hId = hospital._id.toString();
            const doctorIds = hospitalDoctorMap[hId] || [];
            
            const hospitalAppointments = appointments.filter(a => doctorIds.includes(a.docId?.toString()));
            const hospitalDoctors = doctors.filter(d => d.hospitalId?.toString() === hId);
            const hospitalBillings = billings.filter(b => b.hospitalId?.toString() === hId);

            const totalAppointments = hospitalAppointments.length;
            const completedAppointments = hospitalAppointments.filter(a => a.isCompleted).length;
            const cancelledAppointments = hospitalAppointments.filter(a => a.cancelled).length;
            const activeAppointments = hospitalAppointments.filter(a => !a.cancelled && !a.isCompleted).length;

            const thisMonthAppointments = hospitalAppointments.filter(a => a.date >= thisMonthStart).length;
            const lastMonthAppointments = hospitalAppointments.filter(a => a.date >= lastMonthStart && a.date < lastMonthEnd).length;
            const appointmentGrowth = lastMonthAppointments > 0
                ? Math.round(((thisMonthAppointments - lastMonthAppointments) / lastMonthAppointments) * 100)
                : thisMonthAppointments > 0 ? 100 : 0;

            const totalRevenue = hospitalAppointments
                .filter(a => a.isCompleted || a.payment)
                .reduce((sum, a) => sum + (a.amount || 0), 0);

            const thisMonthRevenue = hospitalAppointments
                .filter(a => a.date >= thisMonthStart && (a.isCompleted || a.payment))
                .reduce((sum, a) => sum + (a.amount || 0), 0);

            // Completion rate
            const completionRate = totalAppointments > 0
                ? Math.round((completedAppointments / totalAppointments) * 100)
                : 0;

            // Billing summary
            const totalBilled = hospitalBillings.reduce((sum, b) => sum + b.totalRevenue, 0);
            const totalCommission = hospitalBillings.reduce((sum, b) => sum + b.commissionAmount, 0);
            const pendingBillings = hospitalBillings.filter(b => b.status === "Pending").length;
            const paidBillings = hospitalBillings.filter(b => b.status === "Paid").length;

            // Top doctors by appointments
            const doctorAppointmentCounts = {};
            hospitalAppointments.forEach(a => {
                const dId = a.docId?.toString();
                if (dId) doctorAppointmentCounts[dId] = (doctorAppointmentCounts[dId] || 0) + 1;
            });

            const topDoctors = Object.entries(doctorAppointmentCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([dId, count]) => {
                    const doc = hospitalDoctors.find(d => d._id.toString() === dId);
                    return {
                        _id: dId,
                        name: doc?.name || "Unknown",
                        image: doc?.image || "",
                        speciality: doc?.speciality || "",
                        appointments: count,
                    };
                });

            // Monthly trend for this hospital (last 6 months)
            const monthlyTrend = [];
            for (let i = 5; i >= 0; i--) {
                const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
                const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short' });
                
                const monthAppointments = hospitalAppointments.filter(
                    a => a.date >= monthStart.getTime() && a.date < monthEnd.getTime()
                ).length;
                const monthRevenue = hospitalAppointments
                    .filter(a => a.date >= monthStart.getTime() && a.date < monthEnd.getTime() && (a.isCompleted || a.payment))
                    .reduce((sum, a) => sum + (a.amount || 0), 0);

                monthlyTrend.push({ month: monthLabel, appointments: monthAppointments, revenue: monthRevenue });
            }

            return {
                _id: hospital._id,
                name: hospital.name,
                city: hospital.city,
                image: hospital.image,
                stats: {
                    totalDoctors: hospitalDoctors.length,
                    activeDoctors: hospitalDoctors.filter(d => d.available).length,
                    totalAppointments,
                    completedAppointments,
                    cancelledAppointments,
                    activeAppointments,
                    appointmentGrowth,
                    thisMonthAppointments,
                    totalRevenue,
                    thisMonthRevenue,
                    completionRate,
                },
                billing: {
                    totalBilled,
                    totalCommission,
                    pendingBillings,
                    paidBillings,
                },
                topDoctors,
                monthlyTrend,
            };
        });

        res.json({ success: true, hospitals: hospitalAnalytics });

    } catch (error) {
        console.log('Error in getHospitalAnalytics:', error);
        res.json({ success: false, message: error.message });
    }
};

export { getOverviewStats, getAppointmentTrends, getDoctorPerformance, getSpecialityStats, getRecentActivity, getHospitalAnalytics };
