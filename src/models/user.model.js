import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    lastName: {
      type: String,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowecase: true,
      trim: true,
    },
    userName: {
      type: String,
      required: [true, "UserName is required"],
      unique: true,
      trim: true,
      index: true,
    },
    profile: {
      type: String, // cloudinary url
    },
    profileId: {
      type: String, // Cloudinary public ID for image deletion
      default: "",
    },
    mobileNumber: {
      type: Number,
      unique: true,
      require: [true, "Phone number is required"],
      index: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    referralCode: {
      type: String,
      unique: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

export const User = mongoose.model("User", userSchema);
