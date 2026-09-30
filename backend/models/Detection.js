const mongoose = require('mongoose');

// Pixel coordinates in the analysed frame: (x1, y1) top-left, (x2, y2) bottom-right.
const boundingBoxSchema = new mongoose.Schema(
  {
    x1: { type: Number, required: true },
    y1: { type: Number, required: true },
    x2: { type: Number, required: true },
    y2: { type: Number, required: true },
  },
  { _id: false }
);

// One document = one detection event. MongoDB stores metadata only;
// the snapshot image itself lives in S3 and is referenced by `s3Key`.
const detectionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    objectClass: { type: String, required: true, trim: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    boundingBox: { type: boundingBoxSchema, required: true },
    frameWidth: { type: Number, required: true },
    frameHeight: { type: Number, required: true },
    timestamp: { type: Date, required: true, default: Date.now },

    // Permanent S3 object URL + key. The bucket is private, so the API returns
    // a short-lived presigned URL instead of this value (see detectionService).
    imageUrl: { type: String, default: null },
    s3Key: { type: String, default: null },
    // 'failed' = S3 was down/misconfigured; the event is still recorded.
    imageStatus: { type: String, enum: ['uploaded', 'failed'], required: true },

    status: { type: String, enum: ['new', 'reviewed', 'dismissed'], default: 'new' },
    source: { type: String, enum: ['browser', 'local-camera'], default: 'browser' },
  },
  { timestamps: true }
);

// Indexes - chosen to match the queries the API actually runs.
// Every query is scoped to one user, so userId always comes first.
//
// 1. { userId, timestamp }: history list sorted by newest, "detections today",
//    recent events on the dashboard. Also serves any query on userId alone
//    (MongoDB can use the prefix of a compound index).
detectionSchema.index({ userId: 1, timestamp: -1 });
// 2. { userId, objectClass, timestamp }: history filtered by object class,
//    already in sorted order, so no in-memory sort is needed.
detectionSchema.index({ userId: 1, objectClass: 1, timestamp: -1 });

detectionSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    ret.userId = ret.userId.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Detection', detectionSchema);
