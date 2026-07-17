# Deployment

This document describes manual Render deployment for Version 1.

Local development remains unchanged:

- frontend backend URL default: `http://localhost:5050`
- backend port default: `5050`
- local template storage default: `backend/templates`
- local upload storage default: `backend/uploads`

---

## Required Render Services

Version 1 uses two Render services:

- Frontend: Static Site
- Backend: Web Service

The backend also needs a persistent disk mounted at:

```text
/var/data
```

---

## Frontend Static Site

Service type:

```text
Static Site
```

Settings:

```text
Root Directory: .
Build Command: npm install && npm run build
Publish Directory: build
```

Environment variables:

```text
REACT_APP_BACKEND_BASE_URL=https://<backend-service>.onrender.com
```

`REACT_APP_BACKEND_BASE_URL` is read at frontend build time. Changing it requires a frontend rebuild/redeploy.

---

## Backend Web Service

Service type:

```text
Web Service
```

Settings:

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

Environment variables:

```text
PUBLIC_BACKEND_BASE_URL=https://<backend-service>.onrender.com
ALLOWED_ORIGINS=https://<frontend-static-site>.onrender.com
TEMPLATE_STORAGE_DIR=/var/data/templates
UPLOAD_STORAGE_DIR=/var/data/uploads
```

`ALLOWED_ORIGINS` is a comma-separated list of exact frontend origins allowed by backend CORS.

Use the deployed frontend origin without a trailing slash:

```text
ALLOWED_ORIGINS=https://<frontend-static-site>.onrender.com
```

Requests without an `Origin` header are still allowed so server-to-server checks and local smoke tests can run.

CORS is not authentication. It does not secure `POST /api/publish`; it only controls which browser origins are allowed to call the backend from a page.

---

## Public Crossword IDs

`crosswordId` is a public slug used in:

- template filenames
- uploaded image filenames
- public play URLs such as `/play/<crosswordId>`

Canonical rules:

- required string
- surrounding whitespace is trimmed before validation
- maximum length: 64 characters
- allowed characters only:
  - `A-Z`
  - `a-z`
  - `0-9`
  - hyphen: `-`
  - underscore: `_`

Canonical regex:

```text
^[A-Za-z0-9_-]+$
```

Invalid IDs are rejected before backend file paths are constructed or any template/image writes occur.

Existing stored templates with incompatible IDs would need migration or renaming before they can be loaded under these production rules.

This validation is not authentication and does not restrict who can publish with a valid ID.

`PORT` can be omitted on Render if Render provides it. Local default remains:

```text
PORT=5050
```

---

## SPA Rewrite

The frontend uses browser routing for public play pages such as:

```text
/play/:id
```

Configure the frontend Static Site rewrite:

```text
Source: /*
Destination: /index.html
Action: Rewrite
```

This ensures direct visits to `/play/<crosswordId>` load the React app.

---

## Persistent Storage

Mount the backend persistent disk at:

```text
/var/data
```

Production storage paths:

```text
TEMPLATE_STORAGE_DIR=/var/data/templates
UPLOAD_STORAGE_DIR=/var/data/uploads
```

The backend creates both directories at startup.

Templates are stored in:

```text
/var/data/templates
```

Uploaded/public puzzle images are stored in:

```text
/var/data/uploads
```

The public image URL format remains:

```text
<PUBLIC_BACKEND_BASE_URL>/uploads/<crosswordId>.png
```

---

## Deployment Order

1. Push the repository to the Git provider connected to Render.
2. Create the backend Web Service.
3. Add the backend persistent disk at `/var/data`.
4. Set backend environment variables.
5. Deploy the backend.
6. Confirm `GET /` returns `Crossword backend running`.
7. Create the frontend Static Site.
8. Set `REACT_APP_BACKEND_BASE_URL` to the backend public URL.
9. Set backend `ALLOWED_ORIGINS` to the frontend Static Site origin after the frontend URL is known.
10. Add the SPA rewrite from `/*` to `/index.html`.
11. Deploy the frontend.

---

## Smoke Test Checklist

After deployment:

- Open the frontend root URL.
- Confirm the deployed frontend can call the backend.
- Confirm unknown browser origins are not allowed by backend CORS.
- Upload an image or PDF.
- Create a grid.
- Mark write, blocked, and double clue cells.
- Enter a `crosswordId`.
- Publish the template.
- Confirm publish shows a public `/play/<crosswordId>` URL.
- Open the public play URL directly in a new browser tab.
- Confirm the puzzle image loads.
- Confirm runtime cells render over the image.
- Type into writable cells.
- Click double clue cells and confirm direction/active line behavior.
- Redeploy or restart the backend.
- Reopen the same `/play/<crosswordId>` URL.
- Confirm the template and uploaded image still load from persistent storage.

---

## Rollback And Redeploy Notes

- Frontend redeploys are safe because the frontend is static.
- Backend redeploys must preserve the persistent disk mounted at `/var/data`.
- Do not change `PUBLIC_BACKEND_BASE_URL` without considering already saved template image URLs.
- If `REACT_APP_BACKEND_BASE_URL` changes, rebuild and redeploy the frontend.
- If storage environment variables change, verify that existing templates and uploads are copied or still available at the new paths.
- A rollback should keep the same backend public URL and persistent disk mount whenever possible.

---

## Unchanged In This Deployment Model

- API routes
- payload shapes
- image URL format
- Runtime behavior
- Template shape
- local development defaults
