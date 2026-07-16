const express = require("express");
const cors = require("cors");

const fs = require("fs");
const path = require("path");

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

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.use("/uploads", express.static(UPLOAD_STORAGE_DIR));

app.get("/", (req, res) => {
  res.send("Crossword backend running");
});

app.post("/api/publish", (req, res) => {

  try {

    const template = req.body;

    const crosswordId = template.crosswordId;

    if (template.imageSrc?.startsWith("data:image")) {

  const base64Data = template.imageSrc.replace(
    /^data:image\/png;base64,/,
    ""
  );

  const imagePath = path.join(UPLOAD_STORAGE_DIR, `${crosswordId}.png`);

  fs.writeFileSync(imagePath, base64Data, "base64");

  template.imageSrc = `${PUBLIC_BACKEND_BASE_URL}/uploads/${crosswordId}.png`;

}

    if (!crosswordId) {
      return res.status(400).json({
        success: false,
        error: "Missing crosswordId"
      });
    }

    const filePath = path.join(TEMPLATE_STORAGE_DIR, `${crosswordId}.json`);

    fs.writeFileSync(
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

});

app.get("/api/crossword/:id", (req, res) => {

  try {

    const crosswordId = req.params.id;

    const filePath = path.join(TEMPLATE_STORAGE_DIR, `${crosswordId}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "Template not found"
      });
    }

    const fileData = fs.readFileSync(filePath, "utf8");

    const template = JSON.parse(fileData);

    res.json(template);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: "Failed to load template"
    });

  }

});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
