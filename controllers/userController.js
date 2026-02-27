import validator from 'validator';
import bcrypt from 'bcrypt';
import userModel from '../models/userModel.js';
import jwt from 'jsonwebtoken';
import {v2 as cloudinary} from 'cloudinary';
import doctorModel from '../models/doctorModel.js';
import hospitalModel from '../models/hospitalModel.js';
import appointmentModel from '../models/appointmentModel.js';
import razorpay from 'razorpay';

// API to register a new user
const registerUser = async (req, res) => {
    // Registration logic here
    try {
        const { name, email, password } = req.body;

        // check if all fields are provided
        if (!name || !password || !email) {
            return res.json({ success: false, message: 'All fields are required' });
        }

        // validate email
        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: 'Enter a valid email' });
        }
        
        // validate strong password
        if (!validator.isStrongPassword(password)) {
            return res.json({ success: false, message: 'Password is not strong enough. It should be at least 8 characters long and include uppercase letters, lowercase letters, numbers, and symbols.' });
        }

        // hash password
        const salt = await bcrypt.genSalt(10);
        const hashedpassword = await bcrypt.hash(password, salt);

        // prepare user data
        const userData = {
            name,
            email,
            password: hashedpassword,
        };

        // save user data to database
        const newUser = new userModel(userData);
        const user = await newUser.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET );

        res.json({ success: true,token});

    } catch (error) {
        console.log('Error in add user to db:', error);
        res.json({ success: false, message: error.message});
    }
    res.json({ success: true, message: 'User registered successfully' });
}

// API for user login
const loginUser = async (req, res) => {
    try {

        const { email, password } = req.body;
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        
        const isMatch =  await bcrypt.compare(password, user.password);

        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET );
            res.json({ success: true, token });
        }else{
             res.json({ success: false, message: 'Invalid credentials' });
        }
        
    } catch (error) {
        console.log('Error in user login:', error);
        res.json({ success: false, message: error.message});
    }
}

// API to get user profile data
const getUserProfile = async (req, res) => {

    try {

        const {userId} = req.body;
        const userData = await userModel.findById(userId).select('-password');

        res.json({ success: true, userData });
        
    } catch (error) {
        console.log('Error in getting user data:', error);
        res.json({ success: false, message: error.message});
    }

}

// API to update user profile data
const updateUserProfile = async (req, res) => {
    // Update profile logic here
    try {

        const {userId, name, phone, dob, gender, address, } = req.body;
        const imageFile = req.file;

        if (!name || !phone || !dob || !gender) {
            return res.json({ success: false, message: 'data Missing' });
        }

        await userModel.findByIdAndUpdate(userId, {name, phone, address:JSON.parse(address), dob, gender});

        if (imageFile) {
            // upload image to cloudinary
            const imageUploadResponse = await cloudinary.uploader.upload(imageFile.path, { resource_type: 'image'});
            const imageUrl = imageUploadResponse.secure_url;

            await userModel.findByIdAndUpdate(userId, { image: imageUrl });
        }

        res.json({ success: true, message: 'Profile updated successfully' });
        
    } catch (error) {
        console.log('Error in updating user profile:', error);
        res.json({ success: false, message: error.message});
    }
}

// API to book an appointment
const bookAppointment = async (req, res) => {
    try {
        
        const { userId, docId, slotDate, slotTime, appointmentType, symptoms, notes } = req.body;

        const docData = await doctorModel.findById(docId).select('-password');

        if (!docData.available) {
            return res.json({ success: false, message: 'Doctor not available' });
        }

        let slots_booked = docData.slots_booked || {};

        // check for slots availability
        if (slots_booked[slotDate]){
            if( slots_booked[slotDate].includes(slotTime)) {
            return res.json({ success: false, message: 'Slot not available' });
            }else{
                slots_booked[slotDate].push(slotTime);
            }
        }else{
            slots_booked[slotDate] = [];
            slots_booked[slotDate].push(slotTime);
        }

        const userData = await userModel.findById(userId).select('-password');

        delete docData.slots_booked;

        const appointmentData = {
            userId,
            docId,
            hospitalId: docData.hospitalId || '',
            slotDate,
            slotTime,
            userData,
            docData,
            amount: docData.fees,
            date: Date.now(),
            appointmentType: appointmentType || 'in-person',
            symptoms: symptoms || '',
            notes: notes || '',
        };

        const newAppointment = new appointmentModel(appointmentData);
        await newAppointment.save();

        // save new slots_booked to doctor data
        await doctorModel.findByIdAndUpdate(docId, { slots_booked });

        res.json({ success: true, message: 'Appointment booked successfully' });

    } catch (error) {
        console.log('Error in creating the appointment:', error);
        res.json({ success: false, message: error.message});
    }
}

// API to get user appointments for my appointments page

const getUserAppointments = async (req, res) => {

    try {
        const { userId } = req.body;
        const appointments = await appointmentModel.find({ userId });

        res.json({ success: true, appointments });
    } catch (error) {
        console.log('Error in fetching user appointments:', error);
        res.json({ success: false, message: error.message});
    }
}

// API for rating a completed appointment (doctor + hospital)
const rateAppointment = async (req, res) => {
    try {
        const { userId, appointmentId, rating, review } = req.body;
        if (!userId || !appointmentId || !rating) {
            return res.json({ success: false, message: 'Missing required data' });
        }

        const appointment = await appointmentModel.findById(appointmentId);
        if (!appointment) {
            return res.json({ success: false, message: 'Appointment not found' });
        }
        if (appointment.userId !== userId) {
            return res.json({ success: false, message: 'Unauthorized' });
        }
        if (!appointment.isCompleted) {
            return res.json({ success: false, message: 'Cannot rate before completion' });
        }
        if (appointment.rating) {
            return res.json({ success: false, message: 'Appointment already rated' });
        }

        // update appointment record
        appointment.rating = rating;
        appointment.review = review || '';
        appointment.ratedAt = Date.now();
        await appointment.save();

        // update doctor ratings
        const doc = await doctorModel.findById(appointment.docId);
        if (doc) {
            const prevCount = doc.ratingCount || 0;
            const newCount = prevCount + 1;
            const prevAvg = doc.ratingAverage || 0;
            const newAvg = (prevAvg * prevCount + rating) / newCount;
            doc.ratingCount = newCount;
            doc.ratingAverage = newAvg;
            doc.reviews.push({ userId, rating, comment: review || '' });
            await doc.save();
        }

        // update hospital ratings if appointment had hospital
        if (appointment.hospitalId) {
            const hosp = await hospitalModel.findById(appointment.hospitalId);
            if (hosp) {
                const prevCount = hosp.ratingCount || 0;
                const newCount = prevCount + 1;
                const prevAvg = hosp.ratingAverage || 0;
                const newAvg = (prevAvg * prevCount + rating) / newCount;
                hosp.ratingCount = newCount;
                hosp.ratingAverage = newAvg;
                hosp.reviews.push({ userId, rating, comment: review || '' });
                await hosp.save();
            }
        }

        res.json({ success: true, message: 'Rating submitted successfully' });
    } catch (error) {
        console.log('Error in rateAppointment:', error);
        res.json({ success: false, message: error.message });
    }
}

// API to return basic stats for homepage carousel
const getStats = async (req, res) => {
    try {
        const userCount = await userModel.countDocuments();
        const doctorCount = await doctorModel.countDocuments();
        const hospitalCount = await hospitalModel.countDocuments();
        res.json({ success: true, userCount, doctorCount, hospitalCount });
    } catch (error) {
        console.log('Error in getStats:', error);
        res.json({ success: false, message: error.message });
    }
}
//     }

// }

// API to cancel user appointment
const cancelUserAppointment = async (req, res) => {

    try {
        const { appointmentId, userId} = req.body;

        const appointmentData = await appointmentModel.findById(appointmentId);

        // verify if appointment belongs to user
        if (appointmentData.userId !== userId) {
            return res.json({ success: false, message: 'Unauthorized action' });
        }

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

// API to reschedule an appointment
const rescheduleAppointment = async (req, res) => {
    try {
        const { appointmentId, userId, newSlotDate, newSlotTime } = req.body;

        if (!appointmentId || !newSlotDate || !newSlotTime) {
            return res.json({ success: false, message: 'Missing required data' });
        }

        const appointment = await appointmentModel.findById(appointmentId);
        if (!appointment) {
            return res.json({ success: false, message: 'Appointment not found' });
        }

        if (appointment.userId !== userId) {
            return res.json({ success: false, message: 'Unauthorized action' });
        }

        if (appointment.cancelled || appointment.isCompleted) {
            return res.json({ success: false, message: 'Cannot reschedule this appointment' });
        }

        const docData = await doctorModel.findById(appointment.docId);
        if (!docData) {
            return res.json({ success: false, message: 'Doctor not found' });
        }

        let slots_booked = docData.slots_booked || {};

        // check new slot availability
        if (slots_booked[newSlotDate] && slots_booked[newSlotDate].includes(newSlotTime)) {
            return res.json({ success: false, message: 'New slot not available' });
        }

        // free old slot
        const oldDate = appointment.slotDate;
        const oldTime = appointment.slotTime;
        if (slots_booked[oldDate]) {
            slots_booked[oldDate] = slots_booked[oldDate].filter(t => t !== oldTime);
        }

        // book new slot
        if (!slots_booked[newSlotDate]) {
            slots_booked[newSlotDate] = [];
        }
        slots_booked[newSlotDate].push(newSlotTime);

        await doctorModel.findByIdAndUpdate(appointment.docId, { slots_booked });
        await appointmentModel.findByIdAndUpdate(appointmentId, {
            slotDate: newSlotDate,
            slotTime: newSlotTime,
            rescheduled: true,
        });

        res.json({ success: true, message: 'Appointment rescheduled successfully' });

    } catch (error) {
        console.log('Error in rescheduling appointment:', error);
        res.json({ success: false, message: error.message });
    }
}

const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// API to make payment of appointment using Razorpay

const paymentRazorpay = async (req, res) => {

    // Payment logic here
    try {

        const {appointmentId} = req.body;
        const appointmentData = await appointmentModel.findById(appointmentId);

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment cancelled or not found' });
        }

        // creating options for razorpay order
        const options = {
            amount: appointmentData.amount * 100, // amount in the smallest currency unit
            currency: process.env.CURRENCY || 'INR',
            receipt: appointmentId.toString(),
        };

        // creation of an order
        const order = await razorpayInstance.orders.create(options);

        res.json({ success: true, order });
        
    } catch (error) {
        console.log('Error making payment:', error);
        res.json({ success: false, message: error.message});
    }

}

// API to verify payment of razorpay
const verifyRazorpay = async (req, res) => {

    // Verification logic here
    try {
        
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);

        // console.log('Order info:', orderInfo);
        if (orderInfo.status === 'paid') {
            // update appointment payment status
            await appointmentModel.findByIdAndUpdate(orderInfo.receipt, { payment : true });
            return res.json({ success: true, message: 'Payment successfully' });
        }else{
            res.json({ success: false, message: 'Payment Failed' });
        }

    } catch (error) {
        console.log('Error making payment:', error);
        res.json({ success: false, message: error.message});
    }        

}


export { registerUser, loginUser, getUserProfile, updateUserProfile, bookAppointment, getUserAppointments, cancelUserAppointment, rescheduleAppointment, paymentRazorpay, verifyRazorpay, rateAppointment, getStats };