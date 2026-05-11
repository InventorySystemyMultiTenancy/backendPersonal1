const { Router } = require("express");

const DEFAULT_TRANSLATION_SERVICE_URL =
  "https://tradudor-i8n-languages.onrender.com";

function createTranslationRoutes() {
  const router = Router();

  router.get("/*", async (req, res, next) => {
    try {
      const serviceUrl =
        process.env.TRANSLATION_SERVICE_URL || DEFAULT_TRANSLATION_SERVICE_URL;
      const upstreamPath = `/traducoes${req.path}`;
      const upstreamUrl = new URL(upstreamPath, serviceUrl);

      upstreamUrl.search = new URLSearchParams(req.query).toString();

      const upstreamResponse = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          Accept: req.headers.accept || "application/json",
        },
      });

      const body = await upstreamResponse.text();
      const contentType = upstreamResponse.headers.get("content-type");

      if (contentType) {
        res.set("Content-Type", contentType);
      }

      return res.status(upstreamResponse.status).send(body);
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

module.exports = { createTranslationRoutes };
