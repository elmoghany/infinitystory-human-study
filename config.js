// Configuration for Local Development
// This file contains actual secrets and is gitignored
// NEVER commit this file to GitHub

const CONFIG = {
    // Google Apps Script Web App URL
    // This will be replaced by GitHub Actions during deployment
    GOOGLE_SHEETS_URL: '{{GOOGLE_SHEETS_URL}}',
    
    // Google Spreadsheet ID
    // This will be replaced by GitHub Actions during deployment
    SPREADSHEET_ID: '{{SPREADSHEET_ID}}',
    
    // Enable Google Sheets sync
    ENABLE_GOOGLE_SHEETS: true
};

// For production (GitHub Pages), these values come from GitHub Secrets
// and are injected by GitHub Actions during deployment

