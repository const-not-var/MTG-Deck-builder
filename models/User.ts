import { Schema, model, models, deleteModel } from "mongoose"

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
    verified: { type: Boolean, default: false },
    verifyToken: { type: String },
  },
  { timestamps: true }
)

// In dev, drop the HMR-cached model so schema changes (new fields) aren't ignored.
if (process.env.NODE_ENV !== "production" && models.User) {
  deleteModel("User")
}

export default models.User ?? model("User", userSchema)
