# AISensy Credits Scraper

Automatically scrapes credit information from AISensy dashboard and sends it to Slack.

## Features

- API endpoint `/credits` to trigger credit scraping on demand
- Automatic credit checks every 4 hours via cron job
- Slack integration to send credit updates
- Automatic re-login if session expires
- Compatible with Vercel deployment

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Configure environment variables:
   ```
   cp .env.example .env
   ```
   
   Then edit the `.env` file with your credentials.

3. Start the application:
   ```
   npm start
   ```

## Deployment to Vercel

1. Make sure your code is in a GitHub repository (e.g., https://github.com/trojan5x/aisensy-scrape)

2. Go to [Vercel](https://vercel.com/) and sign up/login

3. Click "New Project" and import your GitHub repository

4. Configure the project:
   - Set the Framework Preset to "Other"
   - Set Root Directory to "/"
   - Set Build Command to "npm install"
   - Set Output Directory to "/"

5. Set up environment variables:
   - `EMAIL` - Your AISensy login email
   - `PASSWORD` - Your AISensy login password
   - `LOGIN_URL` - The login URL (https://www.app.aisensy.com/login)
   - `ASSISTANT_ID` - Your AISensy assistant ID
   - `CRON_SECRET` - A secret key for securing the cron endpoint (optional)

6. Deploy the project

7. Set up cron job with Vercel Cron:
   - Go to your project settings
   - Click on "Cron Jobs"
   - Add a new cron job
   - Set the schedule to run hourly (e.g., `0 * * * *`)
   - Set the HTTP endpoint to `/api/cron-check`
   - Set the HTTP method to GET
   - Add the header `x-vercel-cron-secret` with your secret value (if configured)

## Usage

- **API access**: Access `https://your-project.railway.app/credits` to trigger credit scraping on demand
- **Automatic updates**: The app will automatically check for credits every 4 hours and post updates to Slack
- **Manual check**: Railway's dashboard lets you view logs to see the latest credit values
- **Cron job**: The `/api/cron-check` endpoint will be called automatically on your specified schedule
- **Local development**: Run `npm start` to start the server locally

Note: Vercel has a serverless architecture, so the app doesn't run continuously. The cron job will call the endpoint at the scheduled time to trigger the credit scraping.

## Important Notes for Vercel Deployment

1. **Browser automation**: Vercel's serverless environment may have limitations with headless browsers. If you encounter issues, consider alternatives like Render or Railway.

2. **Session persistence**: Since Vercel instances are ephemeral, sessions will not persist between invocations. The app is designed to handle this by re-logging in when needed.

3. **Execution time**: Vercel has a maximum execution time of 60 seconds for the free tier. If your scraping takes longer, consider upgrading to a paid plan or using a different hosting provider. 