# Healhub Backend - API Server

A robust Node.js/Express server powering the Healhub healthcare platform with complete API endpoints for patient management, doctor scheduling, hospital operations, and billing.

## 🎯 Features

- **User Management**: Patient registration and profile management
- **Doctor Management**: Doctor profiles, availability, and scheduling
- **Hospital Management**: Hospital registration and operations
- **Appointment System**: Booking, cancellation, and completion
- **Room Management**: Bed allocation and patient admission/discharge
- **Billing System**: Revenue tracking and payment processing
- **Blog Management**: Article creation and publishing
- **Analytics**: Comprehensive platform insights
- **Ratings API**: Endpoints for submitting and aggregating doctor/hospital ratings; appointment schema updated accordingly
- **Statistics Endpoint**: `/api/user/stats` returns counts of users, doctors, hospitals for frontend display
- **Authentication**: JWT-based secure authentication
- **Payment Integration**: Razorpay payment processing
- **Image Storage**: Cloudinary integration

## 🔄 Application Flow Diagrams

### API Request Flow

```mermaid
flowchart TD
    A[Client Request] --> B{Requires Auth?}
    B -->|No| C[Public Route]
    B -->|Yes| D[Extract Token]
    D --> E{Token Valid?}
    E -->|No| F[Return 401 Unauthorized]
    E -->|Yes| G[Decode Token]
    G --> H{Check Role}
    H -->|Admin| I[Admin Middleware]
    H -->|Doctor| J[Doctor Middleware]
    H -->|Hospital| K[Hospital Middleware]
    H -->|User| L[User Middleware]
    
    C --> M[Route Controller]
    I --> M
    J --> M
    K --> M
    L --> M
    
    M --> N[Process Request]
    N --> O{Database Operation?}
    O -->|Yes| P[MongoDB Query]
    O -->|No| Q[Business Logic]
    P --> R{Success?}
    Q --> R
    R -->|Yes| S[Send Success Response]
    R -->|No| T[Send Error Response]
    
    F --> U[End]
    S --> U
    T --> U
    
    style S fill:#4CAF50
    style F fill:#F44336
    style T fill:#F44336
```

### Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant M as Middleware
    participant JWT as JWT Service
    participant DB as Database
    participant H as Handler
    
    C->>M: Request with Token
    M->>M: Check Authorization Header
    alt No Token
        M-->>C: 401 Unauthorized
    else Token Present
        M->>JWT: Verify Token
        JWT->>JWT: Decode & Validate
        alt Token Invalid/Expired
            JWT-->>M: Invalid
            M-->>C: 401 Invalid Token
        else Token Valid
            JWT-->>M: Decoded Payload
            M->>DB: Fetch User/Doctor/Hospital
            DB-->>M: User Data
            M->>M: Attach to req.body
            M->>H: Forward Request
            H->>H: Process Request
            H-->>C: 200 Success Response
        end
    end
```

### Payment Processing Flow

```mermaid
flowchart TD
    A[User Books Appointment] --> B[Frontend: Initiate Payment]
    B --> C[API: Create Razorpay Order]
    C --> D[Generate Order ID]
    D --> E[Return Order Details to Frontend]
    E --> F[Open Razorpay Checkout]
    F --> G{User Completes Payment}
    G -->|Success| H[Razorpay Callback]
    G -->|Failed| I[Show Error Message]
    H --> J[API: Verify Payment Signature]
    J --> K{Signature Valid?}
    K -->|Yes| L[Create Appointment Record]
    K -->|No| M[Reject Payment]
    L --> N[Update Doctor Schedule]
    N --> O[Create Billing Record]
    O --> P[Send Confirmation Email]
    P --> Q[Return Success to Frontend]
    Q --> R[Show Booking Confirmation]
    M --> S[Return Error]
    S --> I
    I --> T[End]
    R --> T
    
    style L fill:#4CAF50
    style R fill:#4CAF50
    style M fill:#F44336
    style I fill:#F44336
```

### Appointment Booking Flow

```mermaid
sequenceDiagram
    participant U as User
    participant API as API Server
    participant DB as MongoDB
    participant P as Razorpay
    participant E as Email Service
    
    U->>API: POST /user/book-appointment
    API->>API: Validate Request Data
    API->>DB: Check Doctor Availability
    DB-->>API: Slot Available
    API->>P: Create Payment Order
    P-->>API: Order ID & Details
    API-->>U: Order Details
    U->>P: Complete Payment
    P->>API: Payment Callback
    API->>API: Verify Payment Signature
    API->>DB: Create Appointment
    DB-->>API: Appointment Created
    API->>DB: Update Doctor's Slots
    DB-->>API: Slots Updated
    API->>DB: Create Billing Record
    DB-->>API: Billing Created
    API->>E: Send Confirmation Email
    E-->>API: Email Sent
    API-->>U: Booking Success
```

### Database Schema Relationships

```mermaid
erDiagram
    USER ||--o{ APPOINTMENT : books
    DOCTOR ||--o{ APPOINTMENT : has
    HOSPITAL ||--o{ DOCTOR : employs
    HOSPITAL ||--o{ ROOM_CATEGORY : has
    ROOM_CATEGORY ||--o{ BED_ALLOCATION : contains
    USER ||--o{ BED_ALLOCATION : occupies
    APPOINTMENT ||--o| PRESCRIPTION : generates
    APPOINTMENT ||--o| BILLING : creates
    DOCTOR ||--o{ BLOG : writes
    HOSPITAL ||--o{ BLOG : publishes
    
    USER {
        string name
        string email
        string password
        string phone
        string address
        date dob
    }
    
    DOCTOR {
        string name
        string email
        string speciality
        number fees
        string hospitalId
        array slots_booked
        number rating
    }
    
    HOSPITAL {
        string name
        string email
        string address
        string phone
        array specialities
    }
    
    APPOINTMENT {
        string userId
        string docId
        string slotDate
        string slotTime
        string type
        number amount
        boolean cancelled
        boolean completed
    }
    
    ROOM_CATEGORY {
        string hospitalId
        string categoryName
        number pricePerDay
        number totalBeds
        number availableBeds
    }
    
    BILLING {
        string appointmentId
        number amount
        string paymentId
        date paymentDate
    }
```

## ✅📋 Prerequisites

- Node.js 14+
- npm or yarn
- MongoDB (local or Atlas)
- Cloudinary account
- Razorpay account
- Environment variables configured

## 🚀 Installation

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Update .env with your credentials
# See Environment Variables section

# Start server
npm start

# For development with auto-reload
npm run dev
```

## 🔧 Available Scripts

```bash
npm start       # Start server (production)
npm run dev     # Start with nodemon (development)
npm test        # Run tests (if configured)
```

## 📁 Project Structure

```
backend/
├── config/
│   ├── mongodb.js          # MongoDB connection
│   └── cloudinary.js       # Cloudinary setup
├── controllers/
│   ├── userController.js   # Patient operations
│   ├── doctorController.js # Doctor operations
│   ├── adminController.js  # Admin operations
│   ├── hospitalController.js
│   ├── bedController.js    # Room management
│   ├── blogController.js   # Blog operations
│   ├── analyticsController.js
│   ├── billingController.js
│   └── ...
├── models/
│   ├── userModel.js        # User schema
│   ├── doctorModel.js      # Doctor schema
│   ├── appointmentModel.js # Appointment schema
│   ├── hospitalModel.js    # Hospital schema
│   ├── roomModel.js        # Room schema
│   ├── bedAllocationModel.js
│   ├── blogModel.js        # Blog schema
│   ├── billingModel.js     # Billing schema
│   └── ...
├── routes/
│   ├── userRoute.js        # User endpoints
│   ├── doctorRoute.js      # Doctor endpoints
│   ├── adminRoute.js       # Admin endpoints
│   ├── hospitalRoute.js    # Hospital endpoints
│   ├── bedRoute.js         # Bed endpoints
│   ├── blogRoute.js        # Blog endpoints
│   ├── analyticsRoute.js   # Analytics endpoints
│   ├── billingRoute.js     # Billing endpoints
│   └── ...
├── middlewares/
│   ├── authAdmin.js        # Admin authentication
│   ├── authDoctor.js       # Doctor authentication
│   ├── authHospital.js     # Hospital authentication
│   ├── authUser.js         # User authentication
│   ├── multer.js           # File upload
│   └── errorHandler.js     # Error handling
├── utils/
│   ├── validators.js       # Data validation
│   ├── logger.js           # Logging utility
│   └── ...
├── Server.js               # Main application file
├── .env.example            # Environment template
├── package.json            # Dependencies
└── README.md
```

## 🔌 API Endpoints

### Authentication

#### User (Patient)
```
POST   /api/user/register            Register new user
POST   /api/user/login               User login
GET    /api/user/profile             Get user profile
POST   /api/user/update-profile      Update profile
POST   /api/user/verify-email        Verify email
```

#### Doctor
```
POST   /api/doctor/register          Doctor registration
POST   /api/doctor/login             Doctor login
GET    /api/doctor/profile           Get doctor profile
POST   /api/doctor/update-profile    Update profile
```

#### Admin
```
POST   /api/admin/login              Admin login
```

#### Hospital
```
POST   /api/hospital/login           Hospital login
GET    /api/hospital/profile         Get hospital profile
POST   /api/hospital/update-profile  Update profile
```

### Doctors

```
GET    /api/doctor/list              Get all doctors
GET    /api/doctor/:docId            Get doctor details
POST   /api/doctor/change-availability
GET    /api/doctor/appointments      Get doctor appointments
POST   /api/doctor/complete-appointment
POST   /api/doctor/cancel-appointment
POST   /api/doctor/add-prescription
POST   /api/doctor/update-schedule
GET    /api/doctor/analytics         Doctor analytics
```

### Users (Patients)

```
POST   /api/user/book-appointment    Book appointment
GET    /api/user/appointments        Get user appointments
POST   /api/user/cancel-appointment  Cancel appointment
GET    /api/user/prescription/:appointmentId
POST   /api/user/rate-appointment    Rate appointment
```

### Appointments

```
GET    /api/appointments             Get all appointments (admin)
GET    /api/appointments/:id         Get appointment details
POST   /api/appointments/cancel      Cancel appointment (admin)
GET    /api/appointment-stats        Appointment statistics
```

### Hospitals

```
GET    /api/hospital/list            Get all hospitals
GET    /api/hospital/:id             Get hospital details
GET    /api/hospital/:id/doctors     Get hospital doctors
POST   /api/hospital/validate-booking
GET    /api/hospital/analytics       Hospital analytics
POST   /api/hospital/add-doctor      Add doctor to hospital
```

### Rooms & Beds

```
POST   /api/bed/add-category         Create room category (admin)
GET    /api/bed/categories/:hospitalId
POST   /api/bed/update-category      Update room category
POST   /api/bed/admit                Admit patient
POST   /api/bed/discharge            Discharge patient
GET    /api/bed/history/:hospitalId  Allocation history
GET    /api/bed/availability/:hospitalId (public)

// Hospital-specific
POST   /api/bed/hospital/add-category
GET    /api/bed/hospital/categories
POST   /api/bed/hospital/admit
POST   /api/bed/hospital/discharge
```

### Blogs

```
POST   /api/blog/admin/create        Create blog (admin)
GET    /api/blog/list                Get all blogs (public)
GET    /api/blog/:slug               Get blog post (public)
GET    /api/blog/category/:category  Filter by category (public)
POST   /api/blog/admin/update        Update blog (admin)
POST   /api/blog/delete              Delete blog (admin)

// Doctor-specific
POST   /api/blog/doctor/create       Create blog (doctor)
GET    /api/blog/doctor/list         Doctor's blogs
POST   /api/blog/doctor/update       Update blog (doctor)
POST   /api/blog/doctor/delete       Delete blog (doctor)

// Hospital-specific
POST   /api/blog/hospital/create     Create blog (hospital)
GET    /api/blog/hospital/list       Hospital's blogs
POST   /api/blog/hospital/update     Update blog (hospital)
POST   /api/blog/hospital/delete     Delete blog (hospital)
```

### Analytics

```
GET    /api/analytics/overview       Platform overview
GET    /api/analytics/trends         Trend data
GET    /api/analytics/recent-activity
GET    /api/analytics/doctor/:docId  Doctor analytics
GET    /api/analytics/hospital/:hospitalId
```

### Billing

```
GET    /api/billing/list             Get all billings (admin)
POST   /api/billing/generate         Generate billing
GET    /api/billing/:hospitalId      Hospital billings
POST   /api/billing/create-invoice   Create invoice
```

## 📊 Database Models

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  phone: String,
  address: Object,
  gender: String,
  dob: Date,
  image: String (Cloudinary URL),
  createdAt: Date
}
```

### Doctor Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  image: String,
  speciality: String,
  degree: String,
  experience: Number,
  about: String,
  fees: Number,
  address: Object,
  hospitalId: ObjectId (ref: Hospital),
  available: Boolean,
  slots_booked: Object,
  ratings: [Object],
  avgRating: Number,
  createdAt: Date
}
```

### Appointment Model
```javascript
{
  userId: ObjectId (ref: User),
  docId: ObjectId (ref: Doctor),
  slotDate: Date,
  slotTime: String,
  userData: Object,
  docData: Object,
  amount: Number,
  date: Date,
  cancelled: Boolean,
  completed: Boolean,
  prescription: String,
  followUpDate: Date,
  appointmentType: String (in-person/video),
  symptoms: String,
  notes: String,
  status: String
}
```

### Hospital Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  image: String (Cloudinary URL),
  city: String,
  address: Object,
  phone: String,
  specialties: [String],
  about: String,
  isRegistered: Boolean,
  isAvailable: Boolean,
  totalBeds: Number,
  availableBeds: Number,
  doctorIds: [ObjectId],
  ratings: [Object],
  ratingAverage: Number,
  ratingCount: Number,
  createdAt: Date
}
```

### Room Category Model
```javascript
{
  hospitalId: ObjectId (ref: Hospital),
  name: String,
  description: String,
  totalBeds: Number,
  availableBeds: Number,
  dailyRate: Number,
  amenities: [String],
  createdAt: Date
}
```

### Bed Allocation Model
```javascript
{
  hospitalId: ObjectId,
  roomCategoryId: ObjectId,
  patientId: String,
  admissionDate: Date,
  dischargeDate: Date,
  status: String (admitted/discharged),
  notes: String
}
```

### Blog Model
```javascript
{
  title: String,
  content: String,
  excerpt: String,
  category: String,
  tags: [String],
  image: String (Cloudinary URL),
  author: String,
  authorId: ObjectId,
  authorType: String (admin/doctor/hospital),
  isPublished: Boolean,
  views: Number,
  comments: [Object],
  createdAt: Date,
  publishedAt: Date,
  updatedAt: Date
}
```

### Billing Model
```javascript
{
  hospitalId: ObjectId (ref: Hospital),
  totalAppointments: Number,
  totalRevenue: Number,
  commissionPercentage: Number,
  commissionAmount: Number,
  netPayable: Number,
  bedRevenue: Number,
  grandTotal: Number,
  billingPeriodStart: Date,
  billingPeriodEnd: Date,
  status: String (Pending/Paid),
  createdAt: Date
}
```

## 🔐 Authentication

### JWT Strategy
- Tokens issued on login
- Token stored in localStorage (client-side)
- Token sent in request headers
- Token verified on each protected route

### Token Headers
```javascript
// Admin
Authorization: aToken

// Doctor  
Authorization: dToken

// Hospital
Authorization: hToken

// User
Authorization: token
```

### Middleware
- `authAdmin`: Verify admin token
- `authDoctor`: Verify doctor token
- `authHospital`: Verify hospital token
- `authUser`: Verify user token

## 📝 Validation Rules

### User Registration
- Email: Valid email format
- Password: Min 6 characters
- Name: Required, max 50 chars
- Phone: Valid format

### Doctor Registration
- Email: Valid, unique
- Password: Min 6 characters
- Speciality: Valid selection
- Experience: 0-60 years

### Hospital Registration
- Email: Valid, unique
- Name: Required, unique
- City: Required
- Address: Required

### Appointment Booking
- Doctor must be available
- Slot must not be booked
- User must be logged in
- Appointment date >= today

## 💳 Payment Processing

### Razorpay Integration
1. Create order on backend
2. Get order ID and instance
3. Open Razorpay payment window (client)
4. User completes payment
5. Callback to backend
6. Verify signature
7. Create appointment
8. Send confirmation

### API Flow
```
POST /api/appointment/create-order
↓
POST /api/appointment/verify-payment
↓
Create Appointment
↓
Send Confirmation Email
```

## 📧 Email Integration

Emails sent for:
- Account registration
- Appointment confirmation
- Appointment reminder (24h before)
- Appointment completion
- Prescription shared
- Password reset

## 📊 Analytics Features

### Admin Dashboard
- Total users, doctors, hospitals
- Revenue metrics
- Appointment completion rates
- Doctor performance rankings
- Hospital analytics
- Recent activity log

### Doctor Analytics
- Total appointments
- Completed/pending
- Revenue earned
- Appointment types
- Patient ratings
- Popular time slots

### Hospital Analytics
- Total appointments
- Bed occupancy
- Revenue
- Top doctors
- Patient feedback
- Admission trends

## 🔄 File Upload

### Cloudinary Setup
- Images for users, doctors, hospitals
- Blog featured images
- Maximum file size: 5MB
- Supported formats: JPG, PNG, GIF

### Upload Process
```
Select File
↓
Validate (size, format)
↓
Send to Cloudinary
↓
Get URL
↓
Save URL in database
```

## 🌐 Environment Variables

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/healhub
# or MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/healhub

# Server
PORT=4000
NODE_ENV=development

# JWT
JWT_SECRET=your_jwt_secret_key_here

# Cloudinary
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Admin Credentials
ADMIN_EMAIL=admin@healhub.com
ADMIN_PW=admin_password

# Razorpay
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret

# Email
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Frontend URL
FRONTEND_URL=http://localhost:5173
ADMIN_URL=http://localhost:5174
```

## 🧪 Testing

```bash
# Postman Collection
# Import from postman_collection.json

# Test Admin Endpoint
POST http://localhost:4000/api/admin/login
Body: {
  "email": "admin@healhub.com",
  "password": "admin_password"
}

# Test Doctor Endpoint
POST http://localhost:4000/api/doctor/login
Body: {
  "email": "doctor@example.com",
  "password": "password123"
}
```

## 🚀 Performance Optimization

- Database indexing on frequently queried fields
- Pagination for large datasets
- Caching of doctor/hospital lists
- Image optimization with Cloudinary
- Query optimization with projections
- Connection pooling

## 🛡️ Security Measures

- Password hashing with bcrypt
- JWT token expiration
- CORS configuration
- Input validation/sanitization
- SQL injection prevention (using Mongoose)
- Rate limiting (recommended)
- HTTPS in production
- Secure cookie settings

## 📝 Logging

- Request/response logging
- Error logging
- Database operation logs
- API call tracking

## 🐛 Error Handling

### Standard Error Response
```javascript
{
  success: false,
  message: "Error description"
}
```

### HTTP Status Codes
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

## 🔄 Deployment

### Render
```bash
# Connect GitHub repo
# Set environment variables
# Deploy automatically
```

### Railway
```bash
# Connect GitHub repo
# Configure environment
# Deploy
```

### AWS EC2
```bash
# SSH into instance
# Clone repository
# Install dependencies
# Setup environment
# Run with PM2
pm2 start Server.js --name healhub
```

### Environment for Production
```bash
NODE_ENV=production
PORT=443
MONGODB_URI=mongodb+srv://...
JWT_SECRET=strong_secret_key
# ... other production vars
```

## 📦 Dependencies

Core Dependencies:
- `express` - Web framework
- `mongoose` - MongoDB ODM
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT handling
- `cloudinary` - Image storage
- `multer` - File upload
- `cors` - Cross-origin requests
- `dotenv` - Environment variables
- `axios` - HTTP client

Dev Dependencies:
- `nodemon` - Auto-reload
- `postman` - API testing

## 📚 API Documentation

### Request Format
```javascript
POST /api/user/book-appointment
Headers: {
  "Content-Type": "application/json",
  "token": "user_jwt_token"
}
Body: {
  "docId": "doctor_id",
  "slotDate": "2024-12-20",
  "slotTime": "10:00",
  "appointmentType": "in-person",
  "symptoms": "Fever",
  "notes": "Recent travel"
}
```

### Response Format
```javascript
{
  "success": true,
  "message": "Appointment booked successfully",
  "appointmentId": "appointment_id"
}
```

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Commit with clear messages
5. Push and create PR

## 📄 License

MIT License - See root LICENSE file

## 🆘 Troubleshooting

### MongoDB Connection Failed
```bash
# Check connection string
# Verify whitelist IP in MongoDB Atlas
# Check network connectivity
```

### Cloudinary Upload Failed
- Verify API credentials
- Check file size (< 5MB)
- Test with Postman

### JWT Errors
- Verify token in headers
- Check token expiration
- Verify JWT_SECRET matches

### Port Already in Use
```bash
# Kill process on port 4000
lsof -ti:4000 | xargs kill -9
```

---

**Build Better Healthcare! 💪**
