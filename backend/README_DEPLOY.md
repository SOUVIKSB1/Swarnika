Backend deployment guide

This file explains quick steps to deploy the backend (Express + MongoDB) to HTTPS-hosted platforms so cross-site cookies work correctly with your hosted frontend.

Prerequisites

- Google Cloud SDK (for Cloud Run) or an account on Render/Heroku/etc.
- A production MongoDB connection string (set in MONGODB_URI)
- A strong JWT secret (set in JWT_SECRET)
- Your frontend origin(s) (e.g. https://swarnika-c2451.web.app)

Environment variables (required)

- MONGODB_URI - MongoDB Atlas connection string
- JWT_SECRET - strong secret for signing session tokens
- ALLOWED_ORIGINS - comma-separated list of allowed CORS origins (e.g. https://swarnika-c2451.web.app)
- NODE_ENV - must be 'production' in production
- PORT - (optional) port number; Cloud Run/Render provide their own

Recommended deployment: Google Cloud Run (managed) — HTTPS, auto-scaling

1. Build and push container
   Replace PROJECT_ID and REGION with your Google Cloud project and region.

   gcloud auth login
   gcloud config set project PROJECT_ID
   gcloud builds submit --tag gcr.io/PROJECT_ID/jewel-backend

2. Deploy to Cloud Run

   gcloud run deploy jewel-backend \
    --image gcr.io/PROJECT_ID/jewel-backend \
    --platform managed \
    --region REGION \
    --allow-unauthenticated \
    --set-env-vars "MONGODB_URI=your_mongo_uri,JWT_SECRET=your_jwt_secret,ALLOWED_ORIGINS=https://swarnika-c2451.web.app,NODE_ENV=production"

3. Note the service URL (https://...run.app). Update your frontend (if needed) to call that backend domain or configure a proxy/rewrites.

Alternative: Render (simple web service)

1. Create a new "Web Service" and connect to your repo.
2. Use the Dockerfile or the Node build command.
3. Set the environment variables in the Render dashboard (MONGODB_URI, JWT_SECRET, ALLOWED_ORIGINS, NODE_ENV=production).
4. Deploy and note the HTTPS service URL.

Local dev notes

- While developing locally you can run the backend on localhost:5001 and use local frontend origins in ALLOWED_ORIGINS. In dev the server sets cookies with secure=false and SameSite=Lax so cookies work for same-origin flows.

Security notes

- In production use NODE_ENV=production so the server sets cookies with secure=true and SameSite=None (required for cross-site cookies).
- Store secrets (MONGODB_URI, JWT_SECRET) securely and rotate regularly.
- Consider setting up HTTPS on a custom domain and using proper CORS and CSRF protections.

If you'd like, I can:

- Create a Cloud Run deploy script with placeholders you can run locally.
- Add GitHub Actions workflow to build and deploy to Cloud Run automatically.
