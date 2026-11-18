# Blog editing

The browser editor lives at `/admin/`. It uses **Decap CMS 3.17.3**, pinned in `public/admin/index.html`, and stores articles as Markdown with YAML frontmatter in `src/content/posts/`. No sample articles have been published.

## Write locally

Use Node.js 20.9 or newer. From the project root, install the locked dependencies and start the portfolio.

```powershell
npm ci
npm run dev
```

In a second terminal in the same directory, start the local content service:

```powershell
npm run cms
```

Open [the local writing desk](http://localhost:4173/admin/). Keep both terminals running. Select the local login button, open **Blog posts**, and choose **New Blog post**. The local service writes the actual Markdown files and uploaded images to disk; it does not push to GitHub or deploy the website.

If the editor shows **Login with GitHub** locally, the local content service was not detected. Start `npm run cms` from this project's root and reload the editor before proceeding. The default content-service port is `8081`. Do not run it against the old resume checkout by mistake.

New posts have **Keep as draft** enabled. Save the article while writing; switch that field off only when ready to show it on the public blog. Decap's save/publish button persists a content file; the `draft` field controls whether the site generator includes the article. The generator must exclude every `draft: true` entry from article pages, listings, and feeds. A saved draft can be present in Git without appearing on the website.

Markdown image uploads are stored in `public/images/uploads/` and referenced as `/images/uploads/...`. Next.js includes `public/` in its static export. Reload the development page after saving content; for a manual production build, run `npm run build`.

## Enable editing on the deployed Netlify site

Local editing is configured. **Hosted login and saving still require account setup.** The editor targets the protected `main` branch of `machariamwangi/portfolio`. Its editorial workflow saves changes on a separate branch and opens a pull request for review.

The selected backend is GitHub with Netlify's OAuth provider service. Editors need GitHub write access to the configured repository. No Netlify Identity widget or Git Gateway is used. Netlify marks Git Gateway as deprecated and discourages new configurations; see its [Git Gateway notice](https://docs.netlify.com/manage/security/secure-access-to-sites/git-gateway/).

For the Netlify project serving the new portfolio:

1. Register a [GitHub OAuth application](https://github.com/settings/developers). Use the deployed portfolio as its homepage and `https://api.netlify.com/auth/done` as its authorization callback URL.
2. In Netlify, open **Project configuration → Security → OAuth → Authentication Providers → Install Provider**, select GitHub, and enter that application's Client ID and Client Secret. Keep the secret in Netlify; never add it to this repository or `config.yml`.
3. Deploy the portfolio source, then open its `/admin/` page and sign in with your GitHub account.
4. Save a draft and check its pull request in GitHub. When the article is ready, turn off **Keep as draft**, save the change, and merge the pull request after the required checks and approvals. The article appears after the deployment from `main` succeeds.

Netlify OAuth setup follows the current [official provider-token instructions](https://docs.netlify.com/manage/security/secure-access-to-sites/oauth-provider-tokens/). The [Decap GitHub backend documentation](https://decapcms.org/docs/github-backend/) describes repository access requirements.

The Netlify OAuth configuration is specific to that Netlify project. A private Sites preview or another host does not automatically gain remote editing; use the local editor meanwhile, or configure an appropriate [external OAuth service](https://decapcms.org/docs/backends-overview/) and update the backend settings for that host.

## Integration notes

The project package should include the exact development dependency and script below. `decap-server` 3.11.6 requires Node.js 20 or newer. It defaults to local filesystem writes and local-machine access. See the [official local-backend guide](https://decapcms.org/docs/decap-proxy/).

```json
{
  "scripts": {
    "cms": "decap-server"
  },
  "devDependencies": {
    "decap-server": "3.11.6"
  },
  "overrides": {
    "@decap/cli": {
      "@hapi/joi": "npm:joi@17.13.9",
      "zod": "4.6.7"
    }
  }
}
```

The scoped overrides replace Decap CLI's retired `@hapi/joi` dependency with the maintained, compatible Joi 17 package and use patched Zod. Joi 17.13.9 fixes the [published Joi advisory](https://github.com/advisories/GHSA-4528-x5fx-h6hg). Keep these overrides until the upstream CLI updates its dependency declarations. The local proxy's draft save/read/list operations and path protection were tested with this combination; the complete dependency audit reported zero known vulnerabilities on 17 November 2026.

Keep `src/content/posts/` and `public/images/uploads/` in the source tree. The schema is `title`, `date` (YYYY-MM-DD), `description`, `tags` (array of strings), `draft` (boolean), and the Markdown body. Article filenames use the title's slug. The editor preview is a writing aid; the generated site provides the final layout.

The pinned editor script loads from jsDelivr, so the browser needs an internet connection even for local editing. Only content saving uses the local service.
