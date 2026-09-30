const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // `unique` creates a unique index, so duplicate emails are rejected by MongoDB itself.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Only the bcrypt hash is stored. `select: false` keeps it out of queries by default.
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => ({ id: ret._id.toString(), name: ret.name, email: ret.email, createdAt: ret.createdAt }),
});

module.exports = mongoose.model('User', userSchema);
