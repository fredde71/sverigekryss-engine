const express = require("express");

const fs = require("fs");
const path = require("path");
const { createCorsMiddleware } = require("./corsConfig");
const {
  getCrosswordIdValidationError,
  normalizeCrosswordId
} = require("./crosswordIdValidation");
const { parseImageDataUrl } = require("./imageDataUrl");
const { getPublicationValidationErrors } = require("./publicationModel");
const {
  getPublicationIdValidationError,
  normalizePublicationId
} = require("./publicationIdValidation");
const {
  readPublication,
  listPublicationsByCrosswordId,
  writePublication
} = require("./publicationStorage");

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
const PUBLICATION_STORAGE_DIR =
  process.env.PUBLICATION_STORAGE_DIR || path.join(__dirname, "publications");

fs.mkdirSync(TEMPLATE_STORAGE_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_STORAGE_DIR, { recursive: true });
fs.mkdirSync(SUBMISSION_STORAGE_DIR, { recursive: true });
fs.mkdirSync(PUBLICATION_STORAGE_DIR, { recursive: true });

app.use(createCorsMiddleware());
app.use(express.json({ limit: "50mb" }));

app.use("/uploads", express.static(UPLOAD_STORAGE_DIR));

app.get("/", (req, res) => {
  res.send("Crossword backend running");
});

app.post("/api/publish", createPublishHandler());

app.post("/api/submissions", createSubmissionHandler());

app.post("/api/publications", createPublicationSaveHandler());

app.get("/api/publications/:publicationId", createPublicationLoadHandler());

app.get(
  "/api/crosswords/:crosswordId/publications",
  createCrosswordPublicationsListHandler()
);

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
        `${submission.submissionGroupId}.json`
      );
      const existingSubmissions = readSubmissions(fsModule, filePath);
      const submissions = [
        ...existingSubmissions,
        omitSubmissionGroupId(submission)
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

function createPublicationSaveHandler({
  fsModule = fs,
  pathModule = path,
  publicationStorageDir = PUBLICATION_STORAGE_DIR,
  generatePublicationId
} = {}) {
  return (req, res) => {
    try {
      const validationErrors = getPublicationValidationErrors(req.body, {
        requirePublicationId: false
      });

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: validationErrors[0]
        });
      }

      const publication = writePublication(req.body, {
        fsModule,
        pathModule,
        publicationStorageDir,
        generatePublicationId
      });

      res.status(201).json(publication);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        success: false,
        error: "Failed to save publication"
      });
    }
  };
}

function createPublicationLoadHandler({
  fsModule = fs,
  pathModule = path,
  publicationStorageDir = PUBLICATION_STORAGE_DIR
} = {}) {
  return (req, res) => {
    try {
      const validationError = getPublicationIdValidationError(
        req.params.publicationId
      );

      if (validationError) {
        return res.status(400).json({
          success: false,
          error: validationError
        });
      }

      const publication = readPublication(req.params.publicationId, {
        fsModule,
        pathModule,
        publicationStorageDir
      });

      if (!publication) {
        return res.status(404).json({
          success: false,
          error: "Publication not found"
        });
      }

      res.json(publication);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        success: false,
        error: "Failed to load publication"
      });
    }
  };
}

function createCrosswordPublicationsListHandler({
  fsModule = fs,
  pathModule = path,
  publicationStorageDir = PUBLICATION_STORAGE_DIR
} = {}) {
  return (req, res) => {
    try {
      const validationError = getCrosswordIdValidationError(
        req.params.crosswordId
      );

      if (validationError) {
        return res.status(400).json({
          success: false,
          error: validationError
        });
      }

      const crosswordId = normalizeCrosswordId(req.params.crosswordId);
      const publications = listPublicationsByCrosswordId(crosswordId, {
        fsModule,
        pathModule,
        publicationStorageDir
      });

      res.json(publications);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        success: false,
        error: "Failed to list publications"
      });
    }
  };
}

function validateSubmission(input = {}) {
  const publicationIdError = input.publicationId === undefined
    ? null
    : getPublicationIdValidationError(input.publicationId);

  if (publicationIdError) {
    return {
      error: publicationIdError === "Missing publicationId"
        ? "Missing publicationId"
        : "Invalid publicationId"
    };
  }

  const hasPublicationId = typeof input.publicationId === "string"
    && input.publicationId.trim();
  const publicationId = hasPublicationId
    ? normalizePublicationId(input.publicationId)
    : "";
  const templateIdError = hasPublicationId
    ? null
    : getCrosswordIdValidationError(input.templateId);

  if (templateIdError) {
    return {
      error: templateIdError === "Missing crosswordId"
        ? "Missing templateId"
        : "Invalid templateId"
    };
  }

  const templateId = hasPublicationId ? "" : normalizeCrosswordId(input.templateId);
  const crosswordId = normalizeOptionalCrosswordId(input.crosswordId);

  if (crosswordId.error) {
    return { error: "Invalid crosswordId" };
  }

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
      submissionGroupId: publicationId || templateId,
      ...(publicationId ? { publicationId } : { templateId }),
      ...(crosswordId.value ? { crosswordId: crosswordId.value } : {}),
      name,
      email,
      phone,
      solution
    }
  };
}

function normalizeOptionalCrosswordId(value) {
  if (value === undefined || value === null || value === "") {
    return { value: "" };
  }

  const validationError = getCrosswordIdValidationError(value);

  if (validationError) {
    return { error: validationError };
  }

  return { value: normalizeCrosswordId(value) };
}

function omitSubmissionGroupId(submission) {
  const { submissionGroupId, ...persistedSubmission } = submission;

  return persistedSubmission;
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
  createSubmissionHandler,
  createPublicationSaveHandler,
  createPublicationLoadHandler,
  createCrosswordPublicationsListHandler
};
