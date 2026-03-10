import { body, param, validationResult } from "express-validator";
import { ErrorHandler } from "../utils/utility.js";

const loginValidator = [
  body("username", "Please enter user name").notEmpty(),
  body("password", "Please enter password").notEmpty(),
];

const newGroupValidator = [
  body("name", "Group name is required").notEmpty(),
  body("members")
    .notEmpty()
    .withMessage("Please select members")
    .isArray({ min: 2, max: 100 })
    .withMessage("Members must be between 2 and 100"),
];

const addMemberValidator = [
  body("chatId", "Please Enter Chat ID").notEmpty(),
  body("members")
    .notEmpty()
    .withMessage("Please Enter Members")
    .isArray({ min: 1, max: 97 })
    .withMessage("Members must be 1-97"),
];

const sendAttachmentsValidator = [
  body("chatId", "Please Enter Chat ID").notEmpty(),
];

const removeMemberValidator = [
  body("chatId", "Please Enter Chat ID").notEmpty(),
  body("userId", "Please Enter User ID").notEmpty(),
];

const chatIdValidator = [param("id", "Please Enter Chat ID").notEmpty()];

const renameValidator = [
  param("id", "Please Enter Chat ID").notEmpty(),
  body("name", "Please Enter New Name").notEmpty(),
];

const sendChatRequestValidator = [
  body("userId", "Please Enter User ID").notEmpty(),
];

const acceptChatRequestValidator = [
  body("requestId", "Please Enter Request ID").notEmpty(),
  body("isRequestAccepted")
    .notEmpty()
    .withMessage("Please Add isRequestAccepted field")
    .isBoolean()
    .withMessage("isRequestAccepted must be a boolean"),
];

export {
  addMemberValidator,
  chatIdValidator,
  loginValidator,
  newGroupValidator,
  removeMemberValidator,
  renameValidator,
  sendAttachmentsValidator,
  sendChatRequestValidator,
  acceptChatRequestValidator,
};
