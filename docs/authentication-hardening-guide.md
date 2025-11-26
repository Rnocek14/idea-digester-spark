# Authentication Hardening Guide

This guide walks through securing the Admin Dashboard for production use. The dashboard is designed for a small, trusted team of administrators, not for public access.

## Quick Summary

✅ **Already Implemented (in code):**
- Role-based access control (admin role required)
- Input validation with zod
- Email confirmation support
- Signup disabled in production
- Proper error handling for auth states

⚠️ **Requires Supabase Configuration (manual steps below):**
- Enable leaked password protection
- Configure email settings
- Set redirect URLs
- Adjust session settings

---

## Supabase Configuration Steps

### 1. Enable Leaked Password Protection

**Resolves security warning:** ⚠️ Leaked Password Protection Disabled

**Where:** Supabase Dashboard → Authentication → Policies

**Steps:**
1. Navigate to [Authentication → Policies](https://supabase.com/dashboard/project/mzumvkrpnxhkvhdyzgqa/auth/policies)
2. Find the **"Password Strength"** section
3. Toggle **"Check against known leaked passwords"** to **ON**
4. Click **Save**

**Effect:** When users sign up or change passwords, Supabase will reject passwords that appear in known breach databases.

---

### 2. Configure Email Confirmation

**Where:** Supabase Dashboard → Authentication → Email Auth

**Steps:**
1. Go to [Authentication → Providers → Email](https://supabase.com/dashboard/project/mzumvkrpnxhkvhdyzgqa/auth/providers)
2. Under **"Email Auth"**, toggle **"Confirm email"** to **ON**
3. Set **"Secure email change"** to **ON** (requires confirmation for email changes)
4. Click **Save**

**For Development/Testing:**
- You can temporarily toggle "Confirm email" OFF to speed up testing
- Remember to turn it back ON before production

**Note:** The auth logs show "Email not confirmed" errors, which is expected behavior when this is enabled. Users must click the confirmation link in their email before they can sign in.

---

### 3. Disable Public Signups (Production)

**Where:** Supabase Dashboard → Authentication → Email Auth

**Steps:**
1. Go to [Authentication → Providers → Email](https://supabase.com/dashboard/project/mzumvkrpnxhkvhdyzgqa/auth/providers)
2. Under **"Email Auth"**, toggle **"Enable sign ups"** to **OFF**
3. Click **Save**

**Effect:** 
- Only existing users can sign in
- New accounts must be created manually in Supabase Dashboard
- The app code already hides the signup form in production (`import.meta.env.DEV` check)

**How to add new admins manually:**
1. Go to [Authentication → Users](https://supabase.com/dashboard/project/mzumvkrpnxhkvhdyzgqa/auth/users)
2. Click **"Add user"**
3. Choose **"Create user with email and password"**
4. Enter email and password (min 8 characters)
5. After user is created, add admin role in SQL Editor:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('USER_ID_FROM_AUTH_USERS', 'admin');
   ```

---

### 4. Configure Redirect URLs

**Where:** Supabase Dashboard → Authentication → URL Configuration

**Steps:**
1. Go to [Authentication → URL Configuration](https://supabase.com/dashboard/project/mzumvkrpnxhkvhdyzgqa/auth/url-configuration)
2. Set **Site URL** to your production domain:
   ```
   https://your-domain.com
   ```
   Or for testing: `https://1ae9db2a-9fd6-4ae3-bdf8-5376096382db.lovableproject.com`

3. Add **Redirect URLs** (one per line):
   ```
   http://localhost:*
   https://1ae9db2a-9fd6-4ae3-bdf8-5376096382db.lovableproject.com/*
   https://your-domain.com/*
   ```

4. Click **Save**

**Why this matters:**
- Prevents auth redirect errors ("requested path is invalid")
- Ensures email confirmation links work correctly
- Secures OAuth flows if you add Google/social login later

---

### 5. Session Settings (Optional Tuning)

**Where:** Supabase Dashboard → Authentication → Configuration

**Recommended Settings:**
1. Go to [Authentication → Configuration](https://supabase.com/dashboard/project/mzumvkrpnxhkvhdyzgqa/settings/auth)
2. Under **"JWT Settings"**:
   - **JWT Expiry:** `3600` (1 hour) to `14400` (4 hours)
   - **Refresh Token Expiry:** `2592000` (30 days) to `7776000` (90 days)

**Security vs Convenience tradeoff:**
- Shorter JWT expiry = more secure, but users must refresh more often
- Longer refresh token = less frequent re-authentication
- For internal admin tool, 4-hour JWT + 30-day refresh is reasonable

---

## Architecture & Security Model

### Role-Based Access Control

The app uses a three-layer security model:

1. **Supabase Auth Layer:**
   - Handles authentication (email/password)
   - Manages sessions and tokens
   - Enforces email confirmation

2. **Row-Level Security (RLS) Layer:**
   - Database policies check `has_role(auth.uid(), 'admin')`
   - Prevents unauthorized data access even if someone bypasses UI
   - Configured on all tables: `content_queue`, `sources`, `sponsors`, `activity_log`

3. **UI Layer (React):**
   - `DashboardLayout` checks user role on mount
   - Redirects non-admin users to access denied page
   - Hides signup form in production

### First User Auto-Admin

The `handle_new_user()` database trigger automatically assigns admin role to the **first user** that signs up:

```sql
-- From existing migration
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public 
as $$
DECLARE
  user_count INT;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (...);

  -- If this is the first user, make them admin
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
END;
$$;
```

**Important:** After the first admin is created, disable signups and add new admins manually.

---

## Input Validation

All authentication forms now use **zod** for validation:

```typescript
const emailSchema = z.string().trim().email("Invalid email address");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");
const fullNameSchema = z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name too long");
```

**Security benefits:**
- Prevents injection attacks
- Enforces password complexity
- Validates data before sending to Supabase
- Provides clear error messages to users

---

## n8n / External Automation Security

**Service Role Key Usage:**

✅ **Correct (server-side only):**
- Store `SUPABASE_SERVICE_ROLE_KEY` in n8n environment variables
- Never hardcode in workflow nodes
- Use for automation that needs to bypass RLS (content ingestion)

❌ **Never:**
- Expose service role key in frontend code
- Commit keys to version control
- Share keys in screenshots or documentation

**Best Practices:**
1. In n8n, use HTTP credentials manager to store the service role key
2. Reference it as `{{$env.SUPABASE_SERVICE_ROLE_KEY}}` in nodes
3. For local development, use `.env` files that are gitignored
4. Rotate keys if accidentally exposed (generate new in Supabase Dashboard → Settings → API)

---

## Production Deployment Checklist

Before deploying to production:

- [ ] Enable leaked password protection in Supabase
- [ ] Enable email confirmation in Supabase
- [ ] Disable public signups in Supabase
- [ ] Configure correct Site URL and Redirect URLs
- [ ] Create first admin account (auto-assigned admin role)
- [ ] Disable signups after first admin is created
- [ ] Verify role-based access works (test with non-admin account)
- [ ] Test email confirmation flow
- [ ] Secure n8n service role key in environment variables
- [ ] Set up production domain (if applicable)
- [ ] Test authentication from production domain

---

## Testing Authentication Flows

### Test Email Confirmation Flow:

1. Create a test account (dev mode or temp enable signups)
2. Check email for confirmation link
3. Click confirmation link
4. Verify redirect to dashboard works
5. Confirm user can sign in

### Test Role-Based Access:

1. Create a user without admin role:
   ```sql
   -- In Supabase SQL Editor
   INSERT INTO auth.users (email, encrypted_password, ...)
   VALUES (...); -- Manual user creation
   ```
2. Try to sign in with that user
3. Should see "Access Denied" screen
4. Add admin role:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('user_id_here', 'admin');
   ```
5. Sign in again → should now access dashboard

### Test Signup Disabled:

1. Deploy app with `NODE_ENV=production` (or without `DEV` mode)
2. Visit `/auth` page
3. Verify only "Sign In" tab is visible
4. Signup form should be hidden

---

## Common Issues & Solutions

### Issue: "Email not confirmed" error

**Cause:** User hasn't clicked confirmation link in email

**Solution:**
1. Check user's spam/junk folder
2. Manually confirm in Supabase Dashboard:
   - Go to Authentication → Users
   - Find user, click menu → "Confirm email"

### Issue: "Requested path is invalid" on login

**Cause:** Redirect URLs not configured correctly

**Solution:**
1. Go to Authentication → URL Configuration
2. Add your app's URL to Redirect URLs
3. Ensure Site URL is set to your main domain

### Issue: User signed in but sees "Access Denied"

**Cause:** User doesn't have admin role in `user_roles` table

**Solution:**
```sql
-- Add admin role for user
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER_ID_FROM_AUTH_USERS', 'admin');
```

### Issue: Can't create first admin

**Cause:** Signups are disabled

**Solution:**
1. Temporarily enable signups in Supabase
2. Create first account (auto-assigned admin role by trigger)
3. Disable signups again

---

## Future Enhancements

Potential additions for more complex team structures:

1. **Multiple Role Levels:**
   - `admin` - Full access
   - `moderator` - Content review only
   - `viewer` - Read-only access

2. **Invite System:**
   - Admin-generated invite tokens
   - Controlled onboarding flow

3. **Audit Logging:**
   - Already implemented via `activity_log` table
   - Track all admin actions automatically

4. **Two-Factor Authentication (2FA):**
   - Available in Supabase (optional add-on)
   - Recommended for highly sensitive operations

---

## Related Documentation

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row-Level Security (RLS) Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Activity Feed Implementation](../src/components/ActivityFeed.tsx)

---

## Support & Questions

For authentication issues:
1. Check Supabase Auth logs: [View Logs](https://supabase.com/dashboard/project/mzumvkrpnxhkvhdyzgqa/logs/auth-logs)
2. Review RLS policies: [View Policies](https://supabase.com/dashboard/project/mzumvkrpnxhkvhdyzgqa/auth/policies)
3. Test with SQL Editor to debug role issues
