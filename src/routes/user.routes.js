import { Router } from "express";
import {
  loginUser,
  registerUser,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  verifyEmail,
  updateUserProfile,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  //   upload.fields([
  //     {
  //       name: "profile",
  //       maxCount: 1,
  //     },
  //   ]),
  registerUser
);

router.route("/verify-email").get(verifyEmail);

router.route("/login").post(loginUser);

//secured routes
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/update-account").patch(verifyJWT, updateAccountDetails);
router
  .route("/update-profile")
  .patch(verifyJWT, upload.single("profile"), updateUserProfile);

export default router;
