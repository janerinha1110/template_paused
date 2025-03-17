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
   - Add all variables from `.env.example`

7. Configure your service:
   - In the Railway dashboard, ensure your service is online
   - Set up a custom domain if needed

## Usage

Access `https://your-railway-app.up.railway.app/credits` to trigger credit scraping and get the current value.

The application will automatically check for credits every hour and post updates to your configured Slack webhook. 