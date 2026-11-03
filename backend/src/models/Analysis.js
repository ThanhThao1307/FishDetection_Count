import mongoose from "mongoose";

const SPECIES = ["Diplodus sargus", "Dentex dentex", "Diplodus vulgaris", "Other_Unidentified"];
const speciesCounts = () => Object.fromEntries(SPECIES.map((s) => [s, { type: Number, default: 0, min: 0 }]));

const AnalysisSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  originalName: { type: String, required: true, trim: true },
  videoDurationSeconds: { type: Number, default: 0, min: 0 },
  totalFrames: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending", index: true },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  stage: { type: String, default: "queued" },
  errorMessage: { type: String, default: null },
  maxN: {
    bySpecies: { type: mongoose.Schema.Types.Mixed, default: speciesCounts },
    totalTarget: { type: Number, default: 0, min: 0 },
    totalConcurrent: { type: Number, default: 0, min: 0 }
  },
  trackCounts: {
    bySpecies: { type: mongoose.Schema.Types.Mixed, default: speciesCounts },
    totalTracks: { type: Number, default: 0, min: 0 }
  },
  recognitionConfidencePercent: { type: Number, default: null, min: 0, max: 100 },
  recognitionAssessment: { type: mongoose.Schema.Types.Mixed, default: null },
  relativeDensity: { type: mongoose.Schema.Types.Mixed, default: null },
  timelineData: [{
    second: { type: Number, required: true, min: 0 },
    "Diplodus sargus": { type: Number, default: 0, min: 0 },
    "Dentex dentex": { type: Number, default: 0, min: 0 },
    "Diplodus vulgaris": { type: Number, default: 0, min: 0 },
    "Other_Unidentified": { type: Number, default: 0, min: 0 },
    totalConcurrent: { type: Number, default: 0, min: 0 },
    totalTarget: { type: Number, default: 0, min: 0 }
  }],
  originalVideoPath: { type: String, required: true },
  processedVideoPath: { type: String, default: null },
  reportCsvPath: { type: String, default: null },
  trackCsvPath: { type: String, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date, default: null }
}, { timestamps: false, minimize: false });

AnalysisSchema.index({ createdAt: -1 });
export default mongoose.model("Analysis", AnalysisSchema);
