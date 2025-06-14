import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Wallet } from "../models/wallet.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import {
  generateReferralCode,
  generateSecretKey,
  generateWalletKey,
} from "../utils/generateKeys.js";
import { sendVerificationEmail } from "../utils/email.js";
import fs from "fs";

const registerUser = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    mobileNumber,
    userName,
    password,
    referralCode,
  } = req.body;

  // Validate required fields
  if (
    [email, userName, password].some(
      (field) => typeof field !== "string" || field.trim() === ""
    )
  ) {
    throw new ApiError(400, "Email, username, and password are required.");
  }

  // Check for existing user
  const [existingEmailUser] = await Promise.all([
    User.findOne({ email: email.toLowerCase() }),
  ]);

  if (existingEmailUser) {
    throw new ApiError(409, "Email already exists");
  }

  // Upload profile image to Cloudinary
  const profileLocalPath = req.files?.profile?.[0]?.path;
  let profileImage = "";

  if (profileLocalPath) {
    const uploadedImage = await uploadOnCloudinary(profileLocalPath);
    profileImage = uploadedImage?.url || "";
  }

  // Create new user
  const user = new User({
    firstName,
    lastName,
    email: email.toLowerCase(),
    userName: userName.toLowerCase(),
    password,
    profile: profileImage,
    mobileNumber,
    secretKey: generateSecretKey(),
    referralCode: generateReferralCode(userName),
  });

  // If referred by someone
  if (referralCode) {
    const refUser = await User.findOne({ referralCode });
    if (refUser) {
      user.referredBy = refUser._id;
    }
  }

  // Save user
  const createdUser = await user.save();

  // Create wallet
  await Wallet.create({
    userId: createdUser._id,
    walletKey: generateWalletKey(),
  });

  // Generate email verification token
  const emailToken = jwt.sign(
    { _id: createdUser._id },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  // Send verification email
  await sendVerificationEmail(email, emailToken);

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        "User registered successfully. Please verify your email.",
        createdUser
      )
    );
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;

  console.log("Received token in query:", token);

  if (!token || typeof token !== "string") {
    throw new ApiError(400, "Token is required in query parameters");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new ApiError(401, "Invalid or expired token", error);
  }

  const user = await User.findById(decoded._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isEmailVerified) {
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Email is already verified"));
  }

  user.isEmailVerified = true;
  await user.save();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Email successfully verified"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  console.log(email);

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "Invalid credential");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  if (!user.isEmailVerified) {
    throw new ApiError(403, "PLease verify your email first.");
  }

  if (!user.isActived) {
    throw new ApiError(
      403,
      "Account not activated.complete payment or contact admin"
    );
  }

  const token = await jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  return res.status(200).json(
    new ApiResponse(200, "User logged In Successfully", {
      user,
      token,
    })
  );
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserProfile = asyncHandler(async (req, res) => {
  const profileLocalPath = req.file?.path;

  if (!profileLocalPath) {
    throw new ApiError(400, "Profile image file is missing");
  }

  // Upload new profile image to Cloudinary
  const uploadedProfile = await uploadOnCloudinary(profileLocalPath);

  // Delete local temp file
  fs.unlink(profileLocalPath, (err) => {
    if (err) console.error("Error deleting local file:", err);
  });

  if (!uploadedProfile?.url) {
    throw new ApiError(500, "Failed to upload profile image to Cloudinary");
  }

  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "Unauthorized: User ID missing");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Delete old profile image from Cloudinary if exists
  if (user.profileId) {
    try {
      await deleteFromCloudinary(user.profileId);
    } catch (err) {
      console.error("Failed to delete old profile image:", err.message);
    }
  }

  // Update profile with new image URL and Cloudinary ID
  user.profile = uploadedProfile.url;
  user.profileId = uploadedProfile.public_id;
  await user.save();

  const sanitizedUser = user.toObject();
  delete sanitizedUser.password;

  return res
    .status(200)
    .json(
      new ApiResponse(200, sanitizedUser, "Profile image updated successfully")
    );
});

export {
  registerUser,
  verifyEmail,
  loginUser,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserProfile,
};
