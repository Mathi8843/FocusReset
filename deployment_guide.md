# FocusReset Vercel Deployment Guide

This guide details how to deploy the FocusReset React + Vite SPA on Vercel, configure Vercel Serverless Functions to securely handle Groq AI and OAuth exchanges, and set up routing rewrites to prevent 404 errors on page reloads.

---

## 1. SPA Router Configuration (`vercel.json`)

Vite generates a Single Page Application (SPA). To prevent Vercel from returning a `404: Not Found` error when refreshing pages on custom routes (like `/dashboard`, `/profile`, or `/reset`), you need to rewrite all requests to `index.html`.

Create a `vercel.json` file in the root of the project with the following content:

```json
{
  "rewrites": [
    { "source": "/api/github/token", "destination": "/api/github/token.js" },
    { "source": "/api/notion/token", "destination": "/api/notion/token.js" },
    { "source": "/api/groq", "destination": "/api/groq.js" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

---

## 2. Secure Serverless Functions (`api/` folder)

For production security, sensitive API keys and client secrets must **NEVER** be compiled into the frontend build. FocusReset runs these operations inside Vercel Serverless Functions.

Create an `api/` directory in your project root and add the following files:

### A. Groq AI completions Proxy (`api/groq.js`)
*This function forwards prompts to the Groq API securely using your backend API key.*

```javascript
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { model, messages, max_tokens, temperature } = req.body;
  const api_key = process.env.GROQ_API_KEY;

  if (!api_key) {
    return res.status(500).json({ error: 'Server configuration error: GROQ_API_KEY is missing on Vercel.' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${api_key}`
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        messages,
        max_tokens: max_tokens || 1024,
        temperature: temperature ?? 0.7
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Groq upstream error: ${errText}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

### B. GitHub Token Exchange (`api/github/token.js`)
*This function handles the OAuth authorization code exchange without exposing the GitHub client secret.*

```javascript
export default async function handler(req, res) {
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

### C. Notion Token Exchange (`api/notion/token.js`)
*Exchanges the Notion code securely.*

```javascript
export default async function handler(req, res) {
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

Configure the following environment variables in the **Settings** > **Environment Variables** tab of your Vercel project:

| Variable Name | Exposure | Source / Description |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Client | Your Supabase project API URL |
| `VITE_SUPABASE_ANON_KEY` | Client | Your Supabase public Anon key |
| `VITE_GOOGLE_CLIENT_ID` | Client | Google OAuth Client ID for calendar |
| `VITE_MICROSOFT_CLIENT_ID` | Client | Microsoft OAuth Client ID for Outlook |
| `VITE_GITHUB_CLIENT_ID` | Client | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | **Secure (Server-Only)** | GitHub App Client Secret |
| `VITE_NOTION_CLIENT_ID` | Client | Notion Public Integration Client ID |
| `NOTION_CLIENT_SECRET` | **Secure (Server-Only)** | Notion Integration Client Secret |
| `GROQ_API_KEY` | **Secure (Server-Only)** | Groq API Key (`gsk_...`) |
| `VITE_RAZORPAY_KEY_ID` | Client | Razorpay integration Public Key |

---

## 4. Deploying the Application

### Option A: Via GitHub Integration (Recommended)
1. Push your local FocusReset project (including the new `vercel.json` and `api/` folder) to your GitHub repository.
2. Open the [Vercel Dashboard](https://vercel.com).
3. Import your project repository.
4. Vercel automatically detects the framework as `Vite`.
5. Enter all environment variables in the settings step.
6. Click **Deploy**.

### Option B: Via Vercel CLI
1. Open your terminal in the project root folder.
2. Run `vercel` to connect and trigger a staging build.
3. Configure the environment variables in the dashboard.
4. Run `vercel --prod` to deploy to production.
