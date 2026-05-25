# FocusReset Integration Guide

This guide details how to integrate and configure the database, payment gateway, third-party authentication redirects, and B2B team management systems inside the FocusReset application.

---

## 1. Supabase Database Schema

To prevent circular dependencies where a policy on one table queries another table before it exists, run the SQL script in this exact order: **1. Create all tables, 2. Enable RLS, 3. Create all policies, 4. Create trigger.**

### Step 1: Create All Tables
```sql
-- 1. Profiles Table (if not already created)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  name text,
  role text,
  daily_tools text[] default '{}'::text[],
  projects text[] default '{}'::text[],
  peak_time text,
  meetings_per_day text,
  onboarding_completed boolean default false,
  onboarding_date timestamp with time zone,
  plan text default 'free'::text check (plan in ('free', 'pro', 'team')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Sessions Table (if not already created)
create table if not exists public.sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  meeting_type text,
  meeting_name text,
  task_chosen text,
  steps_completed integer default 0,
  focus_minutes integer default 0,
  step_timings jsonb default '{}'::jsonb,
  total_duration integer default 0,
  ai_context jsonb,
  hangover_score jsonb,
  drain_level integer,
  completed boolean default false,
  early_exit boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Teams Table
create table if not exists public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  admin_id uuid references public.profiles(id) on delete cascade not null,
  plan text default 'team'::text,
  seat_count integer default 5,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Team Members Table
create table if not exists public.team_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member'::text check (role in ('admin', 'member')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(team_id, user_id)
);

-- 5. Team Invitations Table
create table if not exists public.team_invitations (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  email text not null,
  role text default 'member'::text check (role in ('admin', 'member')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(team_id, email)
);

-- Indexes for performance
create index if not exists sessions_user_id_idx on public.sessions(user_id);
create index if not exists sessions_created_at_idx on public.sessions(created_at);
```

### Step 2: Enable Row Level Security (RLS)
```sql
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invitations enable row level security;
```

### Step 3: Create All Security Policies
```sql
-- Profiles Policies
create policy "Users can view their own profile." 
  on public.profiles for select using (auth.uid() = id);

create policy "Users can insert or update their own profile." 
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile." 
  on public.profiles for update using (auth.uid() = id);

-- Sessions Policies
create policy "Users can read their own sessions." 
  on public.sessions for select using (auth.uid() = user_id);

create policy "Users can create their own sessions." 
  on public.sessions for insert with check (auth.uid() = user_id);

create policy "Users can update their own sessions." 
  on public.sessions for update using (auth.uid() = user_id);

-- Teams Policies
create policy "Team members can view their team details."
  on public.teams for select
  using (
    exists (
      select 1 from public.team_members
      where team_members.team_id = teams.id and team_members.user_id = auth.uid()
    )
  );

create policy "Admins can create teams."
  on public.teams for insert with check (auth.uid() = admin_id);

create policy "Admins can update their own team details."
  on public.teams for update using (auth.uid() = admin_id);

-- Team Members Policies
create policy "Members can view teammate details."
  on public.team_members for select
  using (
    exists (
      select 1 from public.team_members as self
      where self.team_id = team_members.team_id and self.user_id = auth.uid()
    )
  );

create policy "Admins can add/remove members."
  on public.team_members for all
  using (
    exists (
      select 1 from public.team_members as admins
      where admins.team_id = team_members.team_id 
        and admins.user_id = auth.uid() 
        and admins.role = 'admin'
    )
  );

create policy "Users can add themselves if invited."
  on public.team_members for insert with check (auth.uid() = user_id);

-- Team Invitations Policies
create policy "Admins can manage invitations."
  on public.team_invitations for all
  using (
    exists (
      select 1 from public.team_members
      where team_members.team_id = team_invitations.team_id 
        and team_members.user_id = auth.uid() 
        and team_members.role = 'admin'
    )
  );

create policy "Anyone can check invitations by email."
  on public.team_invitations for select using (true);
```

---

## 2. Automated Team Invitation Trigger

To automatically link newly registered users to their respective organization when they finish sign-up, create this PL/pgSQL database trigger. It runs immediately after a row is created in `public.profiles`.

```sql
-- Create Trigger Function
create or replace function public.on_profile_created_link_team()
returns trigger as $$
declare
  invite_row record;
begin
  -- Look for a pending invite matching the new user's email
  select * into invite_row 
  from public.team_invitations
  where email = (select email from auth.users where id = new.id limit 1)
  limit 1;

  if found then
    -- Insert user into team_members table
    insert into public.team_members (team_id, user_id, role)
    values (invite_row.team_id, new.id, invite_row.role);

    -- Delete the invitation
    delete from public.team_invitations where id = invite_row.id;
    
    -- Auto-promote their profile plan status to match
    update public.profiles
    set plan = 'team'
    where id = new.id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Bind Trigger to Profiles
create trigger trigger_on_profile_created_link_team
  after insert on public.profiles
  for each row execute procedure public.on_profile_created_link_team();
```

---

## 3. Razorpay Payment Gateway Integration

FocusReset uses Razorpay client-side checkout to upgrade user tiers to **Pro** or **Team** plans.

### Script Loading
In [paywallService.js](file:///c:/Users/MATHI/OneDrive/Desktop/Self%20Made/FocusReset/src/services/paywallService.js), script injection is handled dynamically:
```javascript
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
```

### Environment Configurations
Create a `.env` file in the root of the project with:
```env
VITE_RAZORPAY_KEY_ID=rzp_test_YOUR_RAZORPAY_KEY
```
*Note: If `VITE_RAZORPAY_KEY_ID` is omitted or unconfigured, checkout automatically defaults to a test environment sandbox mode (`rzp_test_dummy_focusreset`).*

### Upgrading Plans
Upon payment completion, client code triggers `updateUserPlan(userId, plan)`. This upserts the profile plan value back to Supabase and synchronizes `localStorage`.

---

## 4. OAuth Integration & Timeout Fallbacks

To prevent OAuth connection states from hanging on the Dashboard when configurations are unaligned, the following checks are implemented:

1. **Active Exception Handling**: OAuth methods throw standard configurations exceptions immediately instead of returning silently.
2. **Safety Timeout**: Connect clicks trigger a 6-second watchdog timer:
```javascript
const handleConnectGithub = async () => {
  setGithubSyncStatus('connecting');
  try {
    connectGithub();
    // Fallback watchdog timer
    setTimeout(() => {
      setGithubSyncStatus(prev => prev === 'connecting' ? 'error' : prev);
    }, 6000);
  } catch (err) {
    setGithubSyncStatus('error');
  }
};
```
If the redirect fails or is block-interrupted by the browser, the status reverts to `'error'`, leaving buttons interactive.

---

## 5. Dual-Path Storage Strategy

To support full functionality offline, FocusReset implements a dual-path reads/writes pipeline in `storage.js`:

```
                      +-------------------+
                      |   User Action     |
                      +---------+---------+
                                |
                                v
                      +-------------------+
                      |   localStorage    | <--- Written Instantly
                      +---------+---------+
                                |
                                v
                     (Background Sync Task)
                                |
                                v
                      +-------------------+
                      |  Supabase Server  | <--- Pushed Asynchronously
                      +-------------------+
```

- **Reads**: Tries to query Supabase tables. If unauthenticated, rate-limited, or offline, drops back to `localStorage` immediately.
- **Writes**: Saves to `localStorage` immediately (providing instant UI feedback), then schedules a promise upsert to Supabase in the background.

---

## 6. Verification Checklist

To confirm your integrations are fully configured:
1. Compile the build via Vite:
   ```bash
   npm run build
   ```
2. Inspect the console for any `sessions.filter` promise errors (fully resolved in context assemblers).
3. Test invites locally by checking that copy-pasted register links correctly pre-fill onboarding forms and link registration accounts to organizations.

---

## 7. Third-Party Workspace Integrations Setup

To make dashboard integrations functional, configure the developers' credentials and OAuth apps as detailed below.

### A. Google Calendar Setup (Client-Side GIS)
- **Method**: Google Identity Services (GSI) Client Library using the Implicit Grant Flow.
- **Environment Key**: `VITE_GOOGLE_CLIENT_ID`
- **Setup Steps**:
  1. Go to the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
  2. Create or select a project.
  3. Configure the **OAuth Consent Screen**:
     - Scopes required: `.../auth/calendar.readonly` (view calendar events) and `.../auth/userinfo.email` (access user email).
  4. Create an **OAuth 2.0 Client ID**:
     - Application Type: `Web application`.
     - **Authorized JavaScript origins**:
       - Local development: `http://localhost:5173` (or your active Vite port).
       - Production: `https://yourdomain.com`
  5. Copy the Client ID and add it to your `.env` file as `VITE_GOOGLE_CLIENT_ID`.

### B. Outlook Calendar Setup (Microsoft Graph)
- **Method**: OAuth 2.0 Implicit Grant Flow.
- **Environment Key**: `VITE_MICROSOFT_CLIENT_ID`
- **Setup Steps**:
  1. Log in to the [Microsoft Entra Admin Center / Azure Portal](https://portal.azure.com/).
  2. Navigate to **App Registrations** and click **New Registration**.
  3. Select support for *Accounts in any organizational directory (Multitenant) and personal Microsoft accounts*.
  4. Select **Single-page application (SPA)** for the platform redirect type:
     - Redirect URI: `http://localhost:5173/integrations/outlook/callback` (or your production domain).
  5. Go to **Authentication** settings:
     - Under *Implicit grant and hybrid flows*, check **Access tokens (used for implicit flows)**.
  6. Go to **API Permissions**:
     - Add delegated permissions: `Calendars.Read` and `User.Read`.
  7. Copy your Application (client) ID and save it in `.env` as `VITE_MICROSOFT_CLIENT_ID`.

### C. GitHub OAuth Setup
- **Method**: Standard GitHub OAuth Web Flow.
- **Environment Key**: `VITE_GITHUB_CLIENT_ID`
- **Setup Steps**:
  1. Open your [GitHub Developer Settings](https://github.com/settings/developers).
  2. Click **New OAuth App**.
  3. Set configurations:
     - Homepage URL: `http://localhost:5173`
     - Authorization callback URL: `http://localhost:5173/integrations/github/callback`
  4. Copy the Client ID and add it to your `.env` as `VITE_GITHUB_CLIENT_ID`.
  5. **Token Exchange Proxy**: Because GitHub blocks token exchange requests originating directly from the browser (CORS restrictions), you must host a serverless POST proxy endpoint at `/api/github/token` that securely appends your `client_secret` to exchange the `code` for an access token.

### D. Notion Integration Setup
- **Method**: Notion Public OAuth 2.0.
- **Environment Key**: `VITE_NOTION_CLIENT_ID`
- **Setup Steps**:
  1. Navigate to the [Notion Developers Console](https://www.notion.so/my-integrations).
  2. Create a new Public Integration.
  3. Go to the Redirect URIs tab:
     - Add: `http://localhost:5173/integrations/notion/callback`
  4. Under Capabilities, ensure `Read content` is checked.
  5. Save your Integration Client ID in `.env` as `VITE_NOTION_CLIENT_ID`.
  6. **Token Exchange Proxy**: Like GitHub, Notion requires a secure token exchange. Implement a POST backend controller/proxy at `/api/notion/token` to handle code exchanges securely without exposing your Notion `client_secret` to client browsers.

### E. Jira Integration (User-Level Credential)
- **Method**: Basic Authentication via Email & API Token (no global App Registration needed).
- **Setup Steps**:
  1. Tell developers to go to [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens).
  2. Create a new **API Token** and copy it.
  3. On the FocusReset Dashboard, click **Connect Jira** and input:
     - Atlassian Site Domain (e.g. `myteam.atlassian.net`).
     - Account Email (e.g. `developer@company.com`).
     - The copied Atlassian API Token.

### F. Linear Integration (User-Level Credential)
- **Method**: Personal API Key connection (no global App Registration needed).
- **Setup Steps**:
  1. Tell developers to open [Linear Settings > API](https://linear.app/settings/api).
  2. Generate a new **Personal API Key**.
  3. Input the token directly inside the FocusReset Linear Connect popup modal.

---

## 8. Supabase Auth Providers Configuration

If you see the error:
`{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`
when attempting to click **Continue with Google** on the login or registration screens, it means the Google OAuth Provider is disabled in your Supabase Auth settings.

### How to Enable Google Auth in Supabase:
1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your **FocusReset** project.
3. Click on the **Authentication** section in the left-hand sidebar (the key icon).
4. Under the **Configuration** subgroup, click **Providers**.
5. Locate the **Google** provider card in the list and click to expand it.
6. Toggle **Google Enabled** to the **ON** position.
7. Note the **Callback URL (for OAuth)** shown inside the Google provider card. It looks like:
   `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
8. **Configure Google Console**:
   - Go to your [Google Developer Console](https://console.cloud.google.com/).
   - Navigate to **APIs & Services** > **Credentials**.
   - Edit your OAuth 2.0 Web Client ID.
   - Paste the Supabase Callback URL from step 7 into the **Authorized redirect URIs** list.
   - Save changes.
9. Back in the Supabase Dashboard Google Provider Card, paste your Google **Client ID** and **Client Secret**.
10. Click **Save** at the bottom of the Google card.

### Configure Supabase Redirect URL Allow List:
Because the app redirects the browser to `${window.location.origin}/dashboard` (or other routes) after sign-in, you **MUST** whitelist your local and production endpoints in the Supabase Auth Redirect Allow List:
1. In the Supabase Dashboard, go to **Authentication** > **URL Configuration** (located under Settings / Configuration).
2. Set the **Site URL** to your main homepage:
   - Development: `http://localhost:5173`
   - Production: `https://yourdomain.com`
3. Add patterns to the **Redirect URLs** (allow list) using glob wildcards:
   - Development: `http://localhost:5173/**`
   - Production: `https://yourdomain.com/**`
4. Click **Save** or **Add URL**.

If you do not configure the Redirect Allow List, Supabase will block redirections back to your local development environment after successful authentication.



