# AISensy Credits Scraper

Automatically scrapes credit information from AISensy dashboard and sends it to Slack.

## Features

- API endpoint `/credits` to trigger credit scraping on demand
- Automatic hourly scraping via cron job
- Slack integration to send credit updates
- Automatic re-login if session expires

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

## Deployment to Railway

1. Create a Railway account at [railway.app](https://railway.app/)

2. Install Railway CLI:
   ```
   npm install -g @railway/cli
   ```

3. Login to Railway:
   ```
   railway login
   ```

4. Initialize your project:
   ```
   railway init
   ```

5. Deploy the application:
   ```
   railway up
   ```

6. Set up environment variables in Railway dashboard:
   - Go to your project
   - Click "Variables"
   - Add the following variables:
     - `EMAIL` - Your AISensy login email
     - `PASSWORD` - Your AISensy login password
     - `LOGIN_URL` - The login URL (https://www.app.aisensy.com/login)
     - `ASSISTANT_ID` - Your AISensy assistant ID (optional)
     - `PORT` - The port to run on (Railway sets this automatically)

7. Monitor your deployment:
   - Go to the "Deployments" tab to see your app's status
   - Check "Logs" to view the application output

## Usage

- **API access**: Access `https://your-project.railway.app/credits` to trigger credit scraping on demand
- **Automatic updates**: The app will automatically check for credits every hour and post updates to Slack
- **Manual check**: Railway's dashboard lets you view logs to see the latest credit values

## Why Railway is Great for This App

1. **Persistent environment**: Railway runs your app continuously, perfect for cron jobs and session management
2. **Generous free tier**: Get $5 of free usage credits monthly
3. **GitHub integration**: Easy deployment from your repository
4. **No execution time limits**: Better for headless browser automation
5. **Simple scaling**: Upgrade resources as needed

## Troubleshooting

- **Session issues**: If login fails, check your credentials in environment variables
- **Browser errors**: Ensure Playwright is correctly installed with the postinstall script
- **Credit scraping failures**: Check logs for specific error messages 