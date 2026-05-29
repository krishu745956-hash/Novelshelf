# NovelShelf Setup & Deployment

NovelShelf is a portable multi-environment library workspace system built with Vite. It supports localhost development, automated online building, and manual deployment to Vercel/Netlify.

## Environment & Authentication Setup

NovelShelf uses dynamic environment variables for authentication to ensure it never exposes secrets in the frontend code.

To setup the project locally or dynamically deploy it:

1. **Copy the environment file:**
   Duplicate `.env.example` and rename it to `.env`.

2. **Add Your Credentials:**
   Inside `.env`, populate your OAuth or API keys:
   ```env
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   APP_URL=http://localhost:3000
   ```

3. **Google OAuth Application Requirements:**
   If configuring Google OAuth from Google Cloud Console:
   - For localhost, add `http://localhost:3000` to your Authorized JavaScript origins.
   - For localhost callback, add `http://localhost:3000/api/auth/callback/google`.
   - When deploying (e.g. Vercel), add your production URLs (e.g. `https://your-domain.com/api/auth/callback/google`).

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the local server:
   ```bash
   npm run dev
   ```

3. NovelShelf handles persistent sessions seamlessly. Returning to `http://localhost:3000` will restore your last session instantly without required login loops.

## Deploying

The app automatically works on various deployment platforms without manual code edits.

**Vercel / Netlify:**
- Ensure you set up the Environment Variables (like `GOOGLE_CLIENT_ID`) in your Vercel/Netlify Dashboard.
- Set the Build Command to `npm run build`.
- Set the Output Directory to `dist`.
