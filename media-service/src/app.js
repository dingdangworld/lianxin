const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const path = require("path");
const fs = require("fs-extra");

// Internal imports
const config = require("./config/app.config");
const logger = require("./utils/logger.util");

// Middleware imports
const authMiddleware = require("./middleware/auth.middleware");
const rateLimitMiddleware = require("./middleware/rate-limit.middleware");
const errorHandler = require("./middleware/error-handler.middleware");

// Controller imports
const uploadController = require("./controllers/upload.controller");
const mediaController = require("./controllers/media.controller");
const adminController = require("./controllers/admin.controller");

// Service imports
const queueService = require("./services/queue.service");
const clamavService = require("./services/clamav.service");
const videoProcessorService = require("./services/video-processor.service");

// Database imports
const { sequelize, testConnection, closeConnection } = require("./models");

class MediaServiceApp {
  constructor() {
    this.app = express();
    this.port = config.port;
    this.services = {
      database: false,
      clamav: false,
      queue: false,
      videoProcessor: false,
    };
    this.setupDirectories();
    this.setupBasicMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Create necessary directories
   */
  setupDirectories() {
    const directories = [
      config.uploadDir,
      config.tempDir,
      path.join(config.tempDir, "processing"),
      path.join(config.tempDir, "thumbnails"),
      path.join(config.tempDir, "videos"),
      "./logs",
    ];

    directories.forEach((dir) => {
      fs.ensureDirSync(dir);
    });

    logger.info("Directories created", { directories });
  }

  setupBasicMiddleware() {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin: config.cors.origin,
        credentials: true,
        optionsSuccessStatus: 200,
        methods: config.cors.methods,
        allowedHeaders: config.cors.allowedHeaders,
      })
    );

    // Body parsing middleware
    this.app.use(express.json({ limit: "50mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "50mb" }));

    // Compression middleware
    this.app.use(compression());

    // Request logging middleware
    this.app.use((req, res, next) => {
      req.requestId = require("uuid").v4();
      req.startTime = Date.now();

      logger.info("Incoming request", {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get("User-Agent"),
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });

      next();
    });

    // Rate limiting
    if (config.rateLimit.enabled) {
      this.app.use(rateLimitMiddleware.globalRateLimit);
    }
  }

  setupRoutes() {
    // Enhanced health check endpoint with service status
    this.app.get("/health", async (req, res) => {
      let videoProcessorInfo = null;

      // Get video processor system info if available
      if (this.services.videoProcessor) {
        try {
          videoProcessorInfo = await videoProcessorService.getSystemInfo();
        } catch (error) {
          logger.warn("Could not get video processor info for health check", {
            error: error.message,
          });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          service: "media-service",
          status: "healthy",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: config.serviceVersion,
          services: this.services,
          features: {
            imageProcessing: true,
            videoProcessing: this.services.videoProcessor,
            malwareScanning: this.services.clamav,
            cloudStorage: true,
            queueProcessing: this.services.queue,
          },
          videoProcessor: videoProcessorInfo,
        },
        message: "Media service is healthy",
      });
    });

    // API version prefix
    const apiV1 = express.Router();

    // Upload routes (protected)
    apiV1.use("/upload", authMiddleware.authenticate, uploadController);

    // Media management routes (protected)
    apiV1.use("/media", authMiddleware.authenticate, mediaController);

    // Admin routes (admin only)
    apiV1.use(
      "/admin",
      authMiddleware.authenticate,
      authMiddleware.requireAdmin,
      adminController
    );

    // Mount API routes
    this.app.use("/api/v1", apiV1);

    // 404 handler
    this.app.use("*", (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Route ${req.method} ${req.originalUrl} not found`,
        },
        timestamp: new Date().toISOString(),
        request_id: req.requestId,
      });
    });
  }

  setupErrorHandling() {
    this.app.use(errorHandler);
  }

  async start() {
    try {
      // Test database connection
      const isConnectedDb = await testConnection();
      if (!isConnectedDb) {
        throw new Error("Database connection failed");
      }
      this.services.database = true;
      logger.info("Database connection established successfully");

      // Initialize Video Processor Service
      try {
        await videoProcessorService.initialize();
        this.services.videoProcessor = true;
        logger.info("Video processor service initialized successfully");

        // Log video processing capabilities
        const systemInfo = await videoProcessorService.getSystemInfo();
        logger.info("Video processing environment ready", {
          ffmpeg: systemInfo.ffmpeg.version,
          ffmpeg_codecs: systemInfo.ffmpeg.codecs,
          ffprobe: systemInfo.ffprobe.version,
          ffprobe_codecs: systemInfo.ffprobe.codecs,
          supportedFormats: systemInfo.supportedFormats,
        });
      } catch (error) {
        logger.error("Video processor initialization failed", {
          error: error.message,
          stack: error.stack,
        });

        // Decide if video processing is critical for your service
        if (config.videoProcessing.required) {
          throw new Error(
            `Video processing is required but initialization failed: ${error.message}`
          );
        } else {
          logger.warn("Continuing without video processing capabilities");
        }
      }

      // Initialize ClamAV service
      try {
        await clamavService.initialize();
        this.services.clamav = true;
        logger.info("ClamAV service initialized successfully");
      } catch (error) {
        if (config.clamav.required) {
          throw new Error(
            `ClamAV is required but initialization failed: ${error.message}`
          );
        } else {
          logger.warn(
            "ClamAV initialization failed, continuing without malware scanning",
            {
              error: error.message,
            }
          );
        }
      }

      // Initialize queue service
      try {
        await queueService.initialize();
        this.services.queue = true;
        logger.info("Queue service initialized successfully");
      } catch (error) {
        logger.warn("Queue service initialization failed", {
          error: error.message,
        });
      }

      // Start server
      this.app.listen(this.port, () => {
        logger.info(`Media service started on port ${this.port}`, {
          port: this.port,
          environment: process.env.NODE_ENV || "development",
          nodeVersion: process.version,
          services: this.services,
          database: {
            dialect: sequelize.getDialect(),
            connected: isConnectedDb,
          },
          timestamp: new Date().toISOString(),
        });
      });
    } catch (error) {
      logger.error("Failed to start media service", {
        error: error.message,
        stack: error.stack,
      });

      try {
        await this.shutdown();
      } catch (shutdownError) {
        logger.error("Error during emergency shutdown", {
          error: shutdownError.message,
        });
      }

      process.exit(1);
    }
  }

  async shutdown() {
    logger.info("Shutting down media service...");

    try {
      // Close queue connections
      if (this.services.queue) {
        await queueService.close();
        logger.info("Queue service closed successfully");
      }

      // Close database connections
      if (this.services.database) {
        await closeConnection();
        logger.info("Database connection closed successfully");
      }

      // Video processor doesn't need explicit cleanup (it's stateless)
      // but you could add cleanup for temporary files if needed

      logger.info("Media service shut down successfully");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown", {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    }
  }
}

// Initialize app
const mediaServiceApp = new MediaServiceApp();

// Graceful shutdown handling
process.on("SIGTERM", () => mediaServiceApp.shutdown());
process.on("SIGINT", () => mediaServiceApp.shutdown());

// Start the service
if (require.main === module) {
  mediaServiceApp.start();
}

module.exports = mediaServiceApp;
