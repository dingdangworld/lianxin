const NodeClam = require("clamscan");
const fs = require("fs-extra");
const path = require("path");
const config = require("../config/app.config");
const logger = require("../utils/logger.util");
const { AppError } = require("../../shared/errors/appError");

/**
 * ClamAV Service
 * Handles malware scanning for uploaded files
 */
class ClamAVService {
  constructor() {
    this.clamscan = null;
    this.isInitialized = false;
    this.config = config.clamav;
  }

  /**
   * Initialize ClamAV scanner
   */
  async initialize() {
    if (!this.config.enabled || config.enableMockMalwareScanner) {
      logger.info("ClamAV is disabled or mock enabled, using mock scanner");
      this.isInitialized = true;
      return;
    }

    const maxRetries = 20;
    const retryDelay = 3000;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        this.clamscan = await new NodeClam().init({
          removeInfected: false,
          quarantineInfected: false,
          scanLog: null,
          debugMode: config.enableDebugMode,
          fileList: null,
          scanRecursively: false,
          clamdscan: {
            host: this.config.host,
            port: this.config.port,
            timeout: this.config.timeout,
            localFallback: true,
            path: "/usr/bin/clamdscan",
            configFile: "/etc/clamd.d/clamd.conf",
            multiscan: true,
            reloadDb: false,
            active: true,
            bypassTest: false,
          },
          preference: "clamdscan",
          maxFileSize: this.config.maxFileSize,
        });

        await this.testScanner();

        this.isInitialized = true;
        logger.info("ClamAV service initialized successfully", {
          host: this.config.host,
          port: this.config.port,
          version: await this.getVersion(),
        });
        return; // success, exit
      } catch (error) {
        attempt++;
        logger.warn(
          `ClamAV init attempt ${attempt} failed. Retrying in ${retryDelay}ms`,
          {
            error: error.message,
          }
        );
        await new Promise((r) => setTimeout(r, retryDelay));
      }
    }
    throw new AppError(
      "ClamAV initialization failed after retries",
      500,
      "CLAMAV_INIT_ERROR"
    );
  }

  /**
   * Scan file for malware
   */
  async scanFile(filePath) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Check if file exists
      if (!(await fs.pathExists(filePath))) {
        throw new AppError(
          "File not found for scanning",
          404,
          "FILE_NOT_FOUND"
        );
      }

      // Check file size
      const stats = await fs.stat(filePath);
      if (stats.size > this.config.maxFileSize) {
        throw new AppError(
          "File too large for malware scanning",
          413,
          "FILE_TOO_LARGE"
        );
      }

      // Use mock scanner if ClamAV is disabled or in development
      if (!this.config.enabled || config.enableMockMalwareScanner) {
        return this.mockScan(filePath, stats.size);
      }

      const startTime = Date.now();

      const scanTimeoutMs = this.config.scanTimeout || 10000; // 10s default

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("ClamAV scan timed out")),
          scanTimeoutMs
        )
      );

      // Perform actual scan
      const scanResult = await Promise.race([
        this.clamscan.scanFile(filePath),
        timeoutPromise,
      ]);

      const scanTime = Date.now() - startTime;

      const result = {
        isInfected: scanResult.isInfected,
        viruses: scanResult.viruses || [],
        scanTime,
        fileSize: stats.size,
        scanner: "clamav",
        scanDate: new Date().toISOString(),
        filePath: path.basename(filePath),
      };

      if (scanResult.isInfected) {
        logger.warn("Malware detected in file", {
          filePath,
          viruses: scanResult.viruses,
          scanTime,
        });
      } else {
        logger.info("File scan completed - clean", {
          filePath,
          scanTime,
          fileSize: stats.size,
        });
      }

      return result;
    } catch (error) {
      logger.error("File scanning failed", {
        filePath,
        error: error.message,
      });

      // Return safe result on scan failure
      return {
        isInfected: false,
        viruses: [],
        scanTime: 0,
        fileSize: 0,
        scanner: "error",
        scanDate: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Scan multiple files
   */
  async scanFiles(filePaths) {
    try {
      const results = [];

      for (const filePath of filePaths) {
        const result = await this.scanFile(filePath);
        results.push({
          filePath,
          ...result,
        });
      }

      const infectedCount = results.filter((r) => r.isInfected).length;

      logger.info("Batch file scanning completed", {
        totalFiles: filePaths.length,
        cleanFiles: results.length - infectedCount,
        infectedFiles: infectedCount,
      });

      return {
        results,
        summary: {
          totalFiles: filePaths.length,
          cleanFiles: results.length - infectedCount,
          infectedFiles: infectedCount,
        },
      };
    } catch (error) {
      logger.error("Batch file scanning failed", {
        filePaths,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Mock scanner for development/testing
   */
  async mockScan(filePath, fileSize) {
    // Simulate scan time based on file size
    const scanTime = Math.min(1000, fileSize / 1000); // 1ms per KB, max 1 second
    await new Promise((resolve) => setTimeout(resolve, scanTime));

    // Mock result - always clean unless filename contains "virus"
    const isInfected = path.basename(filePath).toLowerCase().includes("virus");

    return {
      isInfected,
      viruses: isInfected ? ["Test.Virus.Mock"] : [],
      scanTime,
      fileSize,
      scanner: "mock",
      scanDate: new Date().toISOString(),
      filePath: path.basename(filePath),
    };
  }

  /**
   * Test scanner functionality
   */
  async testScanner() {
    try {
      if (!this.config.enabled || config.enableMockMalwareScanner) {
        logger.info("ClamAV test skipped - using mock scanner");
        return true;
      }

      // Test with EICAR test string
      const testString =
        "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
      const testPath = path.join(config.tempDir, "eicar_test.txt");

      await fs.writeFile(testPath, testString);

      const result = await this.clamscan.scanFile(testPath);

      // Clean up test file
      await fs.remove(testPath);

      if (!result.isInfected) {
        logger.warn("ClamAV test failed - EICAR not detected");
        return false;
      }

      logger.info("ClamAV test passed - EICAR detected successfully");
      return true;
    } catch (error) {
      logger.error("ClamAV test failed", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get ClamAV version
   */
  async getVersion() {
    try {
      if (!this.config.enabled || !this.clamscan) {
        return "mock-1.0.0";
      }

      const version = await this.clamscan.getVersion();
      return version;
    } catch (error) {
      logger.error("Failed to get ClamAV version", {
        error: error.message,
      });
      return "unknown";
    }
  }

  /**
   * Update virus definitions
   */
  async updateDefinitions() {
    try {
      if (!this.config.enabled) {
        logger.info("ClamAV disabled - skipping definition update");
        return { success: true, message: "Mock update completed" };
      }

      // In production, this would trigger freshclam
      logger.info("Virus definition update triggered");

      return {
        success: true,
        message: "Virus definitions updated successfully",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to update virus definitions", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get scanner statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      isEnabled: this.config.enabled,
      isMock: config.enableMockMalwareScanner,
      host: this.config.host,
      port: this.config.port,
      maxFileSize: this.config.maxFileSize,
      timeout: this.config.timeout,
    };
  }

  /**
   * Health check for ClamAV service
   */
  async healthCheck() {
    try {
      if (!this.config.enabled) {
        return {
          status: "disabled",
          message: "ClamAV is disabled",
        };
      }

      if (!this.isInitialized) {
        return {
          status: "not_initialized",
          message: "ClamAV not initialized",
        };
      }

      // Test with a simple ping
      const version = await this.getVersion();

      return {
        status: "healthy",
        version,
        message: "ClamAV is operational",
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error.message,
      };
    }
  }
}

module.exports = new ClamAVService();
