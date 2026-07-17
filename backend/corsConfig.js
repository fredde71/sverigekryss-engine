const cors = require("cors");

function parseAllowedOrigins(value) {
  return (value || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
}

function createCorsMiddleware(env = process.env) {
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);

  if (allowedOrigins.length === 0) {
    return cors();
  }

  const corsMiddleware = cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.includes(origin));
    }
  });

  return (req, res, next) => {
    const origin = req.headers.origin;

    if (origin && !allowedOrigins.includes(origin)) {
      res.status(403).json({
        success: false,
        error: "Origin not allowed"
      });
      return;
    }

    corsMiddleware(req, res, next);
  };
}

module.exports = {
  createCorsMiddleware,
  parseAllowedOrigins
};
