const express = require("express");

const fs = require("fs");
const path = require("path");
const { createCorsMiddleware } = require("./corsConfig");
const {
  getCrosswordIdValidationError,
  normalizeCrosswordId
} = require("./crosswordIdValidation");

const app = express();
const PORT = process.env.PORT || 5050;
const PUBLIC_BACKEND_BASE_URL =
  process.env.PUBLIC_BACKEND_BASE_URL || "http://localhost:5050";
const TEMPLATE_STORAGE_DIR =
  process.env.TEMPLATE_STORAGE_DIR || path.join(__dirname, "templates");
const UPLOAD_STORAGE_DIR =
  process.env.UPLOAD_STORAGE_DIR || path.join(__dirname, "uploads");

fs.mkdirSync(TEMPLATE_STORAGE_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_STORAGE_DIR, { recursive: true });

app.use(createCorsMiddleware());
app.use(express.json({ limit: "50mb" }));

app.use("/uploads", express.static(UPLOAD_STORAGE_DIR));

app.get("/", (req, res) => {
  res.send("Crossword backend running");
});

app.post("/api/publish", createPublishHandler());

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

    if (template.imageSrc?.startsWith("data:image")) {

  const base64Data = template.imageSrc.replace(
    /^data:image\/png;base64,/,
    ""
  );

  const imagePath = pathModule.join(uploadStorageDir, `${crosswordId}.png`);

  fsModule.writeFileSync(imagePath, base64Data, "base64");

  template.imageSrc = `${publicBackendBaseUrl}/uploads/${crosswordId}.png`;

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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = {
  app,
  createPublishHandler,
  createLoadHandler
};
