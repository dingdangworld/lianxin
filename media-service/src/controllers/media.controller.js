const express = require("express");
const { query, validationResult } = require("express-validator");
const mediaService = require("../services/media.service");
const logger = require("../utils/logger.util");
const { AppError } = require("../../shared/errors/appError");
const { ValidationError } = require("../errors/validation.error");
const rateLimitMiddleware = require("../middleware/rate-limit.middleware");

const router = express.Router();

/**
 * Get User Media Files
 * GET /api/v1/media/files
 */
router.get(
  "/files",
  rateLimitMiddleware.mediaAccessRateLimit,
  [
    query("media_type")
      .optional()
      .isIn(["profile", "cover", "post", "story", "message"])
      .withMessage("Invalid media type"),
    query("file_type")
      .optional()
      .isIn(["image", "video", "live_photo"])
      .withMessage("Invalid file type"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Map the express-validator errors into fieldErrors format
        const fieldErrors = errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
          constraint: null, // optional, can add if needed
        }));

        // Throw a ValidationError with both first error message and all field errors
        throw ValidationError.multipleFields(
          "Media query validation failed",
          fieldErrors
        );
      }

      const userId = req.user.userId;
      const filters = {
        mediaType: req.query.media_type,
        fileType: req.query.file_type,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
      };

      const result = await mediaService.getUserMediaFiles(userId, filters);

      res.status(200).json({
        success: true,
        data: result,
        message: "Media files retrieved successfully",
        request_id: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get Media File Details
 * GET /api/v1/media/files/:mediaFileId
 */
router.get("/files/:mediaFileId", async (req, res, next) => {
  try {
    const { mediaFileId } = req.params;
    const userId = req.user.userId;

    const mediaFile = await mediaService.getMediaFileDetails(
      mediaFileId,
      userId
    );

    res.status(200).json({
      success: true,
      data: { media_file: mediaFile },
      message: "Media file details retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Media File Variants
 * GET /api/v1/media/files/:mediaFileId/variants
 */
router.get("/files/:mediaFileId/variants", async (req, res, next) => {
  try {
    const { mediaFileId } = req.params;
    const userId = req.user.userId;

    const variants = await mediaService.getMediaFileVariants(
      mediaFileId,
      userId
    );

    res.status(200).json({
      success: true,
      data: { variants },
      message: "Media file variants retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete Media File
 * DELETE /api/v1/media/files/:mediaFileId
 */
router.delete("/files/:mediaFileId", async (req, res, next) => {
  try {
    const { mediaFileId } = req.params;
    const userId = req.user.userId;

    await mediaService.deleteMediaFile(mediaFileId, userId);

    logger.info("Media file deleted", {
      mediaFileId,
      userId,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      message: "Media file deleted successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Media File URL
 * GET /api/v1/media/files/:mediaFileId/url
 */
router.get("/files/:mediaFileId/url", async (req, res, next) => {
  try {
    const { mediaFileId } = req.params;
    const userId = req.user.userId;
    const variant = req.query.variant || "original";

    const urlInfo = await mediaService.getMediaFileUrl(
      mediaFileId,
      userId,
      variant
    );

    res.status(200).json({
      success: true,
      data: urlInfo,
      message: "Media file URL retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get User Media Statistics
 * GET /api/v1/media/stats
 */
router.get("/stats", async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const stats = await mediaService.getUserMediaStats(userId);

    res.status(200).json({
      success: true,
      data: { stats },
      message: "Media statistics retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Regenerate Media Variants
 * POST /api/v1/media/files/:mediaFileId/regenerate
 */
router.post("/files/:mediaFileId/regenerate", async (req, res, next) => {
  try {
    const { mediaFileId } = req.params;
    const userId = req.user.userId;

    const result = await mediaService.regenerateMediaVariants(
      mediaFileId,
      userId
    );

    logger.info("Media variants regeneration initiated", {
      mediaFileId,
      userId,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: "Media variants regeneration initiated",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
