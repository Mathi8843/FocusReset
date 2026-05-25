# FocusReset Vercel Deployment Guide

This guide details how to deploy the FocusReset React + Vite SPA on Vercel, configure Vercel Serverless Functions to securely exchange OAuth tokens, and set up routing rewrites to prevent 404 errors on page reloads.

---

## 1. SPA Router Configuration (`vercel.json`)

Vite generates a Single Page Application (SPA). To prevent Vercel from returning a `404: Not Found` error when refreshing pages on custom routes (like `/dashboard`, `/profile`, or `/reset`), you need to rewrite all requests to `index.html`.

Create a `vercel.json` file in the root of the project with the following content:

```json
{
  "rewrites": [
    { "source": "/api/github/token", "destination": "/api/github/token.js" },
    { "source": "/api/notion/token", "destination": "/api/notion/token.js" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

---

## 2. Secure OAuth Serverless Functions

GitHub and Notion OAuth flows require exchanging a temporary `code` for a permanent access token using your client credentials. Because the client secret must **NEVER** be exposed in the browser, you must execute this exchange in a serverless backend environment.

Create an `api/` directory in your project root and add the following two serverless functions:

### A. GitHub Token Exchange (`api/github/token.js`)
Create `api/github/token.js` and paste this code:

```javascript
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Missing OAuth code' });
  }

  const client_id = process.env.VITE_GITHUB_CLIENT_ID;
  const client_secret = process.env.GITHUB_CLIENT_SECRET;

  if (!client_id || !client_secret) {
    return res.status(500).json({ error: 'Server configuration error: GitHub secrets are missing.' });
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        client_id,
        client_secret,
        code
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Token exchange failed' });
  }
}
```

### B. Notion Token Exchange (`api/notion/token.js`)
Create `api/notion/token.js` and paste this code:

```javascript
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, redirect_uri } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Missing OAuth code' });
  }

  const client_id = process.env.VITE_NOTION_CLIENT_ID;
  const client_secret = process.env.NOTION_CLIENT_SECRET;

  if (!client_id || !client_secret) {
    return res.status(500).json({ error: 'Server configuration error: Notion secrets are missing.' });
  }

  try {
    const basicAuth = Buffer.from(`${client_id}:${client_secret}`).toString('base64');

    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Token exchange failed' });
  }
}
```

---

## 3. Environment Variables Configuration

In the Vercel Dashboard, go to **Settings** > **Environment Variables** for your project and add the following variables:

| Variable Name | Client/Server | Source / Description |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Client | Your Supabase project URL (from Settings > API) |
| `VITE_SUPABASE_ANON_KEY` | Client | Your Supabase project Anon Key (from Settings > API) |
| `VITE_GOOGLE_CLIENT_ID` | Client | Client ID for Google Identity Services / Calendar |
| `VITE_MICROSOFT_CLIENT_ID` | Client | Client ID for Microsoft Outlook Calendar |
| `VITE_GITHUB_CLIENT_ID` | Client | Client ID for GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | Server-Only | **(Secure)** Client Secret from GitHub Developer Settings |
| `VITE_NOTION_CLIENT_ID` | Client | Client ID for Notion Integration |
| `NOTION_CLIENT_SECRET` | Server-Only | **(Secure)** Client Secret from Notion Developer settings |
| `VITE_RAZORPAY_KEY_ID` | Client | Razorpay key (Use test keys or production keys) |

---

## 4. Deploying the Application

### Option A: Via Vercel GitHub Integration (Recommended)
1. Push your local FocusReset changes to a GitHub repository.
2. Log in to the [Vercel Dashboard](https://vercel.com).
3. Click **Add New** > **Project**.
4. Import your FocusReset repository.
5. In the configuration panel:
   - **Framework Preset**: Select `Vite` (Vercel should auto-detect this).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Expand **Environment Variables** and add all the keys from Section 3 above.
7. Click **Deploy**.

### Option B: Via Vercel CLI
If you prefer deploying directly from your terminal:
1. Install the Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```
2. Log in to your Vercel account:
   ```bash
   vercel login
   ```
3. Initialize the deployment from the project root:
   ```bash
   vercel
   ```
   Follow the prompts to link the project and configure the build commands.
4. Set production environment variables in the Vercel dashboard and trigger a final release:
   ```bash
   vercel --prod
   ```
