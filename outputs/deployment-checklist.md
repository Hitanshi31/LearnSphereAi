# LearnSphere AI — deployment checklist

1. Set `LEARN_SPHERE_GEMINI_API_KEY` in the backend host’s secret manager. Never set it as a `NEXT_PUBLIC_*` value.
2. Set `LEARN_SPHERE_ALLOWED_ORIGINS` to the exact deployed frontend URL.
3. Mount durable storage for `LEARN_SPHERE_UPLOAD_DIR` and `LEARN_SPHERE_CHROMA_DIR`.
4. Deploy the FastAPI service from `backend/Dockerfile` and expose `/health` for health checks.
5. Deploy the Next.js service from the root `Dockerfile`; set `NEXT_PUBLIC_API_URL` at build time to the backend URL.
6. Use a managed PostgreSQL database before a public launch; the MVP’s in-memory profile store intentionally does not survive a restart.
7. Restrict the Google Gemini key to the Gemini API, set budget alerts, and rotate immediately if exposed.
8. Run the two-minute demo from the supplied script on the deployed environment before submission.
