import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './config/mongodb.js';
import connectCloudinary from './config/cloudinary.js';
import adminRouter from './routes/adminRoute.js';
import doctorRouter from './routes/doctorRoute.js';
import userRouter from './routes/userRoute.js';
import hospitalRouter from './routes/hospitalRoute.js';
import bedRouter from './routes/bedRoute.js';
import blogRouter from './routes/blogRoute.js';
import analyticsRouter from './routes/analyticsRoute.js';
import billingRouter from './routes/billingRoute.js';


//  app config
const app = express();
const port = process.env.PORT || 4000;

// connect to database
connectDB();
// connect to cloudinary
connectCloudinary();

// middlewares
app.use(express.json());
app.use(cors());

// api endpoints
app.use('/api/admin', adminRouter);     // localhost:400/api/admin/add-doctor
app.use('/api/doctor', doctorRouter);     // localhost:400/api/doctor/list
app.use('/api/user', userRouter);     // localhost:400/api/user/list
app.use('/api/hospital', hospitalRouter);
app.use('/api/bed', bedRouter);
app.use('/api/blog', blogRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/billing', billingRouter);

app.get('/', (req, res) => {
  res.send('API is running' );
});

app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`);
})