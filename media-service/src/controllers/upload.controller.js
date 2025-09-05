//services\media-service\src\controllers\upload.controller.js

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { body, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");

// Service imports
const uploadService = require("../services/upload.service");
const queueService = require("../services/queue.service");

// Utility imports
const logger = require("../utils/logger.util");
const fileUtil = require("../utils/file.util");
const config = require("../config/app.config");

// Error imports
const { AppError } = require("../../shared/errors/appError");
const { ValidationError } = require("../errors/validation.error");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(
      config.tempDir,
      "uploads",
      req.user.userId.toString()
    );
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${Date.now()}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize,
    files: 10, // Max 10 files per request
  },
  fileFilter: (req, file, cb) => {
    const isValidType =
      config.supportedImageTypes.includes(file.mimetype) ||
      config.supportedVideoTypes.includes(file.mimetype);

    if (!isValidType) {
      return cb(new ValidationError(`Unsupported file type: ${file.mimetype}`));
    }

    cb(null, true);
  },
});

/**
 * Upload Profile Picture
 * POST /api/v1/upload/profile
 */
router.post(
  "/profile",
  upload.single("profile_image"),
  [
    body("crop_data")
      .optional()
      .isJSON()
      .withMessage("Crop data must be valid JSON"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields(
          "Profile upload validation failed",
          errors.array().map((err) => ({
            field: err.path,
            message: err.msg,
            value: err.value,
          }))
        );
      }

      if (!req.file) {
        throw ValidationError.requiredField(
          "profile_image",
          "Profile image is required"
        );
      }

      const userId = req.user.userId;
      const cropData = req.body.crop_data
        ? JSON.parse(req.body.crop_data)
        : null;

      // Validate file
      const validation = await fileUtil.validateFile(req.file, "image");
      if (!validation.isValid) {
        throw ValidationError.invalidFile(
          "profile_image",
          validation.errors.join(", ")
        );
      }

      // Process upload
      const result = await uploadService.processProfileUpload(
        req.file,
        userId,
        cropData
      );

      logger.info("Profile image uploaded successfully", {
        userId,
        mediaFileId: result.mediaFile.id,
        originalSize: req.file.size,
        requestId: req.requestId,
      });

      res.status(200).json({
        success: true,
        data: {
          media_file: result.mediaFile,
          processing_status: result.processingStatus,
          estimated_completion: result.estimatedCompletion,
        },
        message: "Profile image uploaded successfully",
        request_id: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Upload Cover Photo
 * POST /api/v1/upload/cover
 */
router.post(
  "/cover",
  upload.single("cover_image"),
  [
    body("crop_data")
      .optional()
      .isJSON()
      .withMessage("Crop data must be valid JSON"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields(
          "Cover upload validation failed",
          errors.array().map((err) => ({
            field: err.path,
            message: err.msg,
            value: err.value,
          }))
        );
      }

      if (!req.file) {
        throw ValidationError.requiredField(
          "cover_image",
          "Cover image is required"
        );
      }

      const userId = req.user.userId;
      const cropData = req.body.crop_data
        ? JSON.parse(req.body.crop_data)
        : null;

      // Validate file
      const validation = await fileUtil.validateFile(req.file, "image");
      if (!validation.isValid) {
        throw ValidationError.invalidFile(
          "cover_image",
          validation.errors.join(", ")
        );
      }

      // Process upload
      const result = await uploadService.processCoverUpload(
        req.file,
        userId,
        cropData
      );

      logger.info("Cover photo uploaded successfully", {
        userId,
        mediaFileId: result.mediaFile.id,
        originalSize: req.file.size,
        requestId: req.requestId,
      });

      res.status(200).json({
        success: true,
        data: {
          media_file: result.mediaFile,
          processing_status: result.processingStatus,
          estimated_completion: result.estimatedCompletion,
        },
        message: "Cover photo uploaded successfully",
        request_id: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Upload Post Media (Images, Videos, Live Photos)
 * POST /api/v1/upload/post
 */
router.post(
  "/post",
  upload.array("media_files", 10),
  [
    body("post_type")
      .optional()
      .isIn(["post", "story"])
      .withMessage("Post type must be post or story"),
    body("live_photo_pairs")
      .optional()
      .isJSON()
      .withMessage("Live photo pairs must be valid JSON"),
    body("processing_options")
      .optional()
      .isJSON()
      .withMessage("Processing options must be valid JSON"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields(
          "Post upload validation failed",
          errors.array().map((err) => ({
            field: err.path,
            message: err.msg,
            value: err.value,
          }))
        );
      }

      if (!req.files || req.files.length === 0) {
        throw ValidationError.requiredField(
          "media_files",
          "At least one media file is required"
        );
      }

      const userId = req.user.userId;
      const postType = req.body.post_type || "post";
      const livePhotoPairs = req.body.live_photo_pairs
        ? JSON.parse(req.body.live_photo_pairs)
        : [];
      const processingOptions = req.body.processing_options
        ? JSON.parse(req.body.processing_options)
        : {};

      // Validate files
      for (const file of req.files) {
        const validation = await fileUtil.validateFile(file, "media");
        if (!validation.isValid) {
          throw ValidationError.invalidFile(
            file.originalname,
            validation.errors.join(", ")
          );
        }
      }

      // Process uploads
      const result = await uploadService.processPostUpload(
        req.files,
        userId,
        postType,
        livePhotoPairs,
        processingOptions
      );

      logger.info("Post media uploaded successfully", {
        userId,
        fileCount: req.files.length,
        mediaFileIds: result.mediaFiles.map((f) => f.id),
        livePhotoCount: livePhotoPairs.length,
        requestId: req.requestId,
      });

      res.status(200).json({
        success: true,
        data: {
          media_files: result.mediaFiles,
          live_photos: result.livePhotos,
          processing_status: result.processingStatus,
          estimated_completion: result.estimatedCompletion,
        },
        message: "Post media uploaded successfully",
        request_id: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Upload Live Photo
 * POST /api/v1/upload/live-photo
 */
router.post(
  "/live-photo",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      if (!req.files.image || !req.files.video) {
        throw ValidationError.requiredField(
          "files",
          "Both image and video files are required for live photo"
        );
      }

      const userId = req.user.userId;
      const imageFile = req.files.image[0];
      const videoFile = req.files.video[0];

      // Validate files
      const imageValidation = await fileUtil.validateFile(imageFile, "image");
      const videoValidation = await fileUtil.validateFile(videoFile, "video");

      if (!imageValidation.isValid) {
        throw ValidationError.invalidFile(
          "image",
          imageValidation.errors.join(", ")
        );
      }

      if (!videoValidation.isValid) {
        throw ValidationError.invalidFile(
          "video",
          videoValidation.errors.join(", ")
        );
      }

      // Process live photo upload
      const result = await uploadService.processLivePhotoUpload(
        imageFile,
        videoFile,
        userId
      );

      logger.info("Live photo uploaded successfully", {
        userId,
        mediaFileId: result.mediaFile.id,
        imageSize: imageFile.size,
        videoSize: videoFile.size,
        requestId: req.requestId,
      });

      res.status(200).json({
        success: true,
        data: {
          media_file: result.mediaFile,
          processing_status: result.processingStatus,
          estimated_completion: result.estimatedCompletion,
        },
        message: "Live photo uploaded successfully",
        request_id: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get Upload Status
 * GET /api/v1/upload/status/:mediaFileId
 */
router.get("/status/:mediaFileId", async (req, res, next) => {
  try {
    const { mediaFileId } = req.params;
    const userId = req.user.userId;

    const status = await uploadService.getUploadStatus(mediaFileId, userId);

    res.status(200).json({
      success: true,
      data: status,
      message: "Upload status retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Cancel Upload
 * DELETE /api/v1/upload/:mediaFileId
 */
router.delete("/:mediaFileId", async (req, res, next) => {
  try {
    const { mediaFileId } = req.params;
    const userId = req.user.userId;

    await uploadService.cancelUpload(mediaFileId, userId);

    logger.info("Upload cancelled", {
      mediaFileId,
      userId,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      message: "Upload cancelled successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
