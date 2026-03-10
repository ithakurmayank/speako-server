import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const cookieOptions = {
  maxAge: 15 * 24 * 60 * 60 * 1000,
  sameSite: "none",
  httpOnly: true,
  secure: true,
};

const connectDB = (uri) => {
  mongoose
    .connect(uri, { dbName: "Speako" })
    .then((data) =>
      console.log("Connected to database: ", data.connection.host)
    )
    .catch((err) => {
      throw err;
    });
};

const sendToken = (res, user, statusCode, message) => {
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET_KEY);

  return res
    .status(statusCode)
    .cookie(process.env.TOKEN_KEY, token, cookieOptions)
    .json({
      success: true,
      message,
    });
};

const emitEvent = (req, event, users, data) => {
  console.log("Emitting event: ", event);
};

const deletFilesFromCloudinary = async (public_ids) => {
  // Delete files from cloudinary
};

export {
  connectDB,
  sendToken,
  cookieOptions,
  emitEvent,
  deletFilesFromCloudinary,
};
