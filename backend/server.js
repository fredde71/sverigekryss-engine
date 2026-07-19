const express = require("express");

const fs = require("fs");
const path = require("path");
const { createCorsMiddleware } = require("./corsConfig");
const {
  getCrosswordIdValidationError,
  normalizeCrosswordId
} = require("./crosswordIdValidation");
const { parseImageDataUrl } = require("./imageDataUrl");

const app = express();
const PORT = process.env.PORT || 5050;
const PUBLIC_BACKEND_BASE_URL =
  process.env.PUBLIC_BACKEND_BASE_URL || "http://localhost:5050";
const TEMPLATE_STORAGE_DIR =
  process.env.TEMPLATE_STORAGE_DIR || path.join(__dirname, "templates");
const UPLOAD_STORAGE_DIR =
  process.env.UPLOAD_STORAGE_DIR || path.join(__dirname, "uploads");
const SUBMISSION_STORAGE_DIR =
  process.env.SUBMISSION_STORAGE_DIR || path.join(__dirname, "submissions");

fs.mkdirSync(TEMPLATE_STORAGE_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_STORAGE_DIR, { recursive: true });
fs.mkdirSync(SUBMISSION_STORAGE_DIR, { recursive: true });

app.use(createCorsMiddleware());
app.use(express.json({ limit: "50mb" }));

app.use("/uploads", express.static(UPLOAD_STORAGE_DIR));

app.get("/", (req, res) => {
  res.send("Crossword backend running");
});

app.post("/api/publish", createPublishHandler());

app.post("/api/submissions", createSubmissionHandler());

app.get("/api/crossword/:id", createLoadHandler());

function createPublishHandler({
  fsModule = fs,
  pathModule = path,
  templateStorageDir = TEMPLATE_STORAGE_DIR,
  uploadStorageDir = UPLOAD_STORAGE_DIR,
  publicBackendBaseUrl = PUBLIC_BACKEND_BASE_URL
} = {}) {
  return (req, res) => {
  try {

    const template = req.body;

    const validationError = getCrosswordIdValidationError(template.crosswordId);

    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }

    const crosswordId = normalizeCrosswordId(template.crosswordId);

    template.crosswordId = crosswordId;

    let parsedImage = null;

    try {
      parsedImage = parseImageDataUrl(template.imageSrc);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: "Invalid image data"
      });
    }

    if (parsedImage) {
      const imagePath = pathModule.join(
        uploadStorageDir,
        `${crosswordId}.${parsedImage.extension}`
      );

      fsModule.writeFileSync(imagePath, parsedImage.buffer);

      template.imageSrc =
        `${publicBackendBaseUrl}/uploads/${crosswordId}.${parsedImage.extension}`;
    }

    const filePath = pathModule.join(templateStorageDir, `${crosswordId}.json`);

    fsModule.writeFileSync(
      filePath,
      JSON.stringify(template, null, 2)
    );

    res.json({
      success: true,
      savedAs: `${crosswordId}.json`
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: "Failed to save template"
    });

  }

  };
}

function createLoadHandler({
  fsModule = fs,
  pathModule = path,
  templateStorageDir = TEMPLATE_STORAGE_DIR
} = {}) {
  return (req, res) => {
  try {

    const validationError = getCrosswordIdValidationError(req.params.id);

    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }

    const crosswordId = normalizeCrosswordId(req.params.id);

    const filePath = pathModule.join(templateStorageDir, `${crosswordId}.json`);

    if (!fsModule.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "Template not found"
      });
    }

    const fileData = fsModule.readFileSync(filePath, "utf8");

    const template = JSON.parse(fileData);

    res.json(template);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: "Failed to load template"
    });

  }

  };
}

function createSubmissionHandler({
  fsModule = fs,
  pathModule = path,
  submissionStorageDir = SUBMISSION_STORAGE_DIR,
  now = () => new Date()
} = {}) {
  return (req, res) => {
    try {
      const validation = validateSubmission(req.body);

      if (validation.error) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      const submission = {
        ...validation.submission,
        submittedAt: now().toISOString()
      };
      const filePath = pathModule.join(
        submissionStorageDir,
        `${submission.templateId}.json`
      );
      const existingSubmissions = readSubmissions(fsModule, filePath);
      const submissions = [
        ...existingSubmissions,
        submission
      ];

      fsModule.writeFileSync(
        filePath,
        JSON.stringify(submissions, null, 2)
      );

      res.json({
        success: true
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        success: false,
        error: "Failed to save submission"
      });
    }
  };
}

function validateSubmission(input = {}) {
  const templateIdError = getCrosswordIdValidationError(input.templateId);

  if (templateIdError) {
    return {
      error: templateIdError === "Missing crosswordId"
        ? "Missing templateId"
        : "Invalid templateId"
    };
  }

  const templateId = normalizeCrosswordId(input.templateId);
  const name = normalizeRequiredString(input.name);
  const email = normalizeRequiredString(input.email);
  const phone = normalizeRequiredString(input.phone);
  const solution = normalizeRequiredString(input.solution);

  if (!name) {
    return { error: "Missing name" };
  }

  if (!email) {
    return { error: "Missing email" };
  }

  if (!phone) {
    return { error: "Missing phone" };
  }

  if (!solution) {
    return { error: "Missing solution" };
  }

  if (solution.length !== 6) {
    return { error: "Invalid solution" };
  }

  return {
    submission: {
      templateId,
      name,
      email,
      phone,
      solution
    }
  };
}

function normalizeRequiredString(value) {
  if (typeof value !== "string") return "";

  return value.trim();
}

function readSubmissions(fsModule, filePath) {
  if (!fsModule.existsSync?.(filePath)) {
    return [];
  }

  const fileData = fsModule.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(fileData);

  return Array.isArray(parsed) ? parsed : [];
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = {
  app,
  createPublishHandler,
  createLoadHandler,
  createSubmissionHandler
};
