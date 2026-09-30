const mongoose = require('mongoose');

// Per-user monitoring settings. The backend reads this for every frame and
// passes it to the Python service, so changes apply to the next frame.
const monitoringConfigSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    targetClasses: { type: [String], default: ['person'] },
    confidenceThreshold: { type: Number, default: 0.5, min: 0.05, max: 0.95 },
    cooldownSeconds: { type: Number, default: 30, min: 5, max: 3600 },
  },
  { timestamps: true }
);

// Returns the user's config, creating the defaults on first use.
monitoringConfigSchema.statics.getForUser = function getForUser(userId) {
  return this.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
};

monitoringConfigSchema.set('toJSON', {
  transform: (_doc, ret) => ({
    targetClasses: ret.targetClasses,
    confidenceThreshold: ret.confidenceThreshold,
    cooldownSeconds: ret.cooldownSeconds,
    updatedAt: ret.updatedAt,
  }),
});

module.exports = mongoose.model('MonitoringConfig', monitoringConfigSchema);
