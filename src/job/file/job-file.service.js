const fs = require("fs");
const path = require("path");
const { NotFoundException } = require("../../utils/exceptions");
const logger = require("../../utils/logger");

const JOBS_FOLDER = path.join(__dirname, "/../../../jobs");

const WHITELIST_EXTENSION = [".geojson", ".gpkg", ".tif", ".rds", ".log"];

/**
 * Checks if the extension is in the whitelist.
 * The whitelist controls which files are able see or to download.
 */
const isFileInWhitelist = (file = "") =>
  // TODO: Maybe we will check the full filename.
  // We already know which files are generated by the R script.
  WHITELIST_EXTENSION.includes(path.extname(file));

/**
 * Get job file by name.
 * @param {string} id
 * @returns
 */
const getJobFile = async (res, jobId, name, options = {}) => {
  const { download = false } = options;

  const folderPath = path.join(JOBS_FOLDER, jobId);
  const filePath = path.join(folderPath, name);

  if (!isFileInWhitelist(name)) {
    // Not in whitelist, throw "not found" anyway.
    throw new NotFoundException("Unable to find job file");
  }

  try {
    // Check if the requested file exits:
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.promises.stat(filePath);
  } catch (err) {
    logger.error(err);
    throw new NotFoundException("Unable to find job file");
  }

  const sendFileOptions = {
    root: folderPath,
    dotfiles: "deny",
  };

  if (download === "true") {
    // Force the browser to download the file:
    sendFileOptions.headers = {
      "Content-disposition": `attachment;filename="${name}"`,
    };
  }

  logger.info(`Send file: ${filePath}`);

  res.sendFile(name, sendFileOptions);
};

/**
 * Get all job files.
 * @returns
 */
const getJobFiles = async (jobId) => {
  const folderPath = path.join(JOBS_FOLDER, jobId);

  let jobDir = [];
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    jobDir = await fs.promises.readdir(folderPath);
  } catch (err) {
    logger.error(err);
    throw new NotFoundException("Unable to find job files");
  }

  const files = [];

  // Get stat info of each files:
  // Promise.all runs everything at once.
  await Promise.all(
    jobDir.map(async (file) => {
      if (!isFileInWhitelist(file)) {
        // ignore other files
        return;
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const { mtime, size } = await fs.promises.stat(
        path.join(folderPath, file)
      );

      files.push({ name: file, size, modified: new Date(mtime) });
    })
  );

  logger.info(`Send job files list: ${folderPath}`);

  return files;
};

module.exports = {
  getJobFile,
  getJobFiles,
};