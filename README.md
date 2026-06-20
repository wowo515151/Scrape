# Scrape Engine

[![Deploy to GitHub Pages](https://github.com/your-username/scrape-engine/actions/workflows/deploy.yml/badge.svg)](https://github.com/your-username/scrape-engine/actions/workflows/deploy.yml)
[![Live Site](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?style=flat-square&logo=github)](https://your-username.github.io/scrape-engine/)

🌐 **Live Demo (GitHub Pages):** [https://your-username.github.io/scrape-engine/](https://your-username.github.io/scrape-engine/)

*Note: Replace `your-username` in the links above with your actual GitHub username to direct users to your live deployment!*

Scrape Engine is a high-performance HTML/text harvester and automated prompt-injection security analysis scanner. It allows you to search the web using multiple fallback tiers of DuckDuckGo, download targets directly while bypassing common blockages, extract clean prose, and review the natural English text for potential prompt-injection threats.

---

## 🎨 Features & Technologies

- **Tiered DuckDuckGo Scraping Proxy**: Bypasses rate limits and scraping protections using cascading fallback strategies (DuckDuckGo Lite forms POST -> DuckDuckGo HTML GET -> DuckDuckGo Lite GET -> Wikipedia OpenSearch -> Static fallbacks) without requiring any paid API keys.
- **Wayback Machine Fallback**: If a live page returns access restriction codes (e.g., HTTP 403 Forbidden or 401 Unauthorized), the engine automatically checks and downloads the closest text snapshot from the Internet Archive's Wayback Machine.
- **Smart English Prose Extractor**: Heuristically extracts core article prose by purging HTML markup, stripping code blocks/syntaxes, filtering script/stylesheet assets, excluding title-cased promotional headers, and filtering out noisy short sections (<=3 words with no periods).
- **Security Guard Analysis**: Evaluates extracted prose for prompt injection attacks using rolling window splits.
- **React 19 & Tailwind CSS**: Elegant, dark-mode-first slate dashboard with real-time logging, status tags, and layout animations.
- **Express Backend**: Secure full-stack Node.js server serving the API endpoints (`/api/search` and `/api/fetch`).

---

## 🚀 Getting Started

### Prerequisites

You will need [Node.js](https://nodejs.org/) (v18 or higher) installed.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/scrape-engine.git
   cd scrape-engine
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Configure environment variables. See `.env.example` to define any custom API keys or values required.

### Running Locally

To start the full-stack development server:
```bash
npm run dev
```

The application will launch on **http://localhost:3000**.

### Running Tests

Run the integrated suite of heuristic extractor and security guard tests:
```bash
npm run test
```

### Building for Production

Compile both the React bundle and compile the TypeScript Express server down into a production-optimized bundle:
```bash
npm run build
npm start
```

---

## 🚀 GitHub Pages & Static Environment Compatibility

To maximize versatility, the Scrape Engine is built with a **Dual-Use Engine Design** that runs wonderfully either as a full-stack system or a purely static site:

1. **Automatic Backend Detection**: On startup, the UI automatically checks `/api/health`. If the Express server is detected and healthy, the app operates in **Full-Stack Mode**, routing search and download steps through secure server-side proxies.
2. **Serverless Static Mode Fallback**: If hosted on a static-only provider like **GitHub Pages** where the backend is unreachable, the system gracefully disables the Express mode and forces **Static Mode**.
3. **CORS Proxy Support**: In Static Mode:
   - Search queries fall back to direct, client-safe endpoints (e.g. Wikipedia OpenSearch API and related integrations that support browser requests).
   - Article fetches utilize customizable CORS-Anywhere proxies (like `https://api.allorigins.win/raw?url=`) configurable right in the sidebar settings.

### 📦 Deploying to GitHub Pages

We have preconfigured a fully automated deployment pipeline inside `.github/workflows/deploy.yml`:

1. Create a new repository on GitHub and commit this codebase.
2. Go to your repository **Settings** -> **Pages** (in the sidebar).
3. Under **Build and deployment** -> **Source**, select **GitHub Actions**.
4. Push your changes to the `main` or `master` branch. The Actions pipeline will compile the production-ready build and publish it instantly!

---

## ☁️ Recommended Full-Stack Deployment Hosts

If you prefer to run the full-stack version to leverage direct, proxy-free server-side scraping:
- **Google Cloud Run**: Preconfigured container host (builds and runs automatically using standard files in the repository).
- **Render**: Connect your repository as a "Web Service":
  - **Build Command**: `npm run build`
  - **Start Command**: `npm run start`
- **Fly.io**: Execute `fly launch` in your directory to autoconfigure and establish the Express backend service.
- **Railway**: Link your repository to launch the container instantly.

---

## 📄 License

This project is open-source and licensed under the [MIT License](LICENSE).
