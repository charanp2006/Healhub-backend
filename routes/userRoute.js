import express from "express";
import { registerUser, loginUser, getUserProfile, updateUserProfile, bookAppointment, getUserAppointments, cancelUserAppointment, rescheduleAppointment, paymentRazorpay, verifyRazorpay } from "../controllers/userController.js";
import authUser from "../middlewares/authUser.js";
import upload from "../middlewares/multer.js";

const userRouter = express.Router();

// Route for user registration
userRouter.post('/register', registerUser);
userRouter.post('/login', loginUser);

// Route for getting and updating user profile
userRouter.get('/get-profile', authUser ,getUserProfile);
userRouter.post('/update-profile' , upload.single('image') , authUser , updateUserProfile);

// Routes for appointment management
userRouter.post('/book-appointment', authUser, bookAppointment);
userRouter.get('/appointments', authUser, getUserAppointments);
userRouter.post('/cancel-appointment', authUser, cancelUserAppointment);
userRouter.post('/reschedule-appointment', authUser, rescheduleAppointment);

// Route for making payment
userRouter.post('/payment-razorpay', authUser, paymentRazorpay);
userRouter.post('/verify-razorpaypay', authUser, verifyRazorpay);

export default userRouter;