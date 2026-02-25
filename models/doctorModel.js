import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  image: { type: String, required: true },
  speciality: { type: String, required: true },
  experience: { type: Number, required: true },
  degree: { type: String, required: true },
  about: { type: String, required: true },
  available: { type: Boolean, default: true },
  fees: { type: Number, required: true },
  address: { type: Object, required: true },
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'hospital', required: true },
  date: { type: Number, required: true },
  slots_booked: { type: Object, default: {} },
  // Weekly schedule - defines working hours for each day
  schedule: {
    type: Object,
    default: {
      monday: { enabled: true, startTime: '09:00', endTime: '17:00' },
      tuesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
      wednesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
      thursday: { enabled: true, startTime: '09:00', endTime: '17:00' },
      friday: { enabled: true, startTime: '09:00', endTime: '17:00' },
      saturday: { enabled: false, startTime: '09:00', endTime: '13:00' },
      sunday: { enabled: false, startTime: '09:00', endTime: '13:00' }
    }
  },
  // Blocked dates for vacation/leave
  blockedDates: { type: [String], default: [] }, // ISO date strings (YYYY-MM-DD)
  // Slot duration in minutes
  slotDuration: { type: Number, default: 30 }
},{minimize: false});

doctorSchema.index({ hospitalId: 1 });

const doctorModel = mongoose.models.doctor || mongoose.model('doctor', doctorSchema);

export default doctorModel;