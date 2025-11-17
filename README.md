# 🎯 Video Annotation Tool

> **Repository**: `infinitystory-human-study`
> 
> **Live Demo**: `https://elmoghany.github.io/infinitystory-human-study/annotation_tool.html`

A web-based annotation tool for video dataset quality control with automatic Google Sheets integration.

---

## ✨ Features

- **📊 Google Sheets Integration** - Automatic real-time data sync
- **📄 CSV Export** - Download annotations as CSV
- **📊 Excel Export** - Multi-sheet Excel workbooks (Data, Summary, Statistics)
- **💾 Auto-save** - Browser localStorage backup every 30 seconds
- **👥 Multi-user Support** - Track multiple annotators separately
- **🔄 Offline Mode** - Queue changes, sync when connection restored
- **⌨️ Keyboard Navigation** - Arrow keys for episode navigation
- **📱 Responsive Design** - Works on desktop and tablet

---

## 🚀 Quick Start

### For Annotators

1. **Open the tool**: `YOUR_GITHUB_PAGES_URL/annotation_tool.html`
2. **Enter your name** when prompted
3. **Start annotating**:
   - Click "Exclude" to mark objects for exclusion
   - Add exclusion reasons in the text box
   - Navigate with Next/Previous buttons or arrow keys
4. **Your data auto-saves** to both browser and Google Sheets
5. **Export anytime**: Click export buttons for CSV/Excel files

### For Administrators

Continue reading for Google Sheets setup and deployment instructions.

---

## 📊 Google Sheets Setup

### Step 1: Create Google Sheet

1. Create a new Google Sheet or use existing one
2. Note the spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
   ```

### Step 2: Set Up Google Apps Script

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. Delete any existing code
3. Copy the content from `google-apps-script.js` in this repository
4. Update the `SPREADSHEET_ID` constant with your sheet ID (line 8)
5. Click **Save** (💾) and name it "Video Annotation Data Collector"

### Step 3: Test the Script (Optional)

1. Select function `testEndpoint` from dropdown
2. Click **Run** (▶️)
3. Authorize if prompted
4. Check your Google Sheet for test data in new sheets

### Step 4: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click gear icon ⚙️ → Select **Web app**
3. Configure:
   - **Description**: `Video Annotation Data Collection API`
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: `Anyone`
4. Click **Deploy**
5. **Copy the Web App URL** (looks like: `https://script.google.com/macros/s/.../exec`)

### Step 5: Configure HTML File

Edit `annotation_tool.html` around line 508:

```javascript
const GOOGLE_SHEETS_URL = 'YOUR_ACTUAL_WEB_APP_URL_HERE';
const ENABLE_GOOGLE_SHEETS = true;
```

Replace with your actual Web App URL from Step 4.

### What Gets Created

Your Google Sheet will automatically get 3 new sheets:

1. **Annotation_Data** - All detailed annotation records
   - Columns: Timestamp, Annotator, Session ID, Episode ID, Object Type, etc.

2. **Update_Log** - Sync history
   - Tracks each sync with timestamp and row counts

3. **Summary** - Per-annotator statistics
   - Total objects, excluded count, last update time

---

## 🧪 Local Testing

### Start Test Server

```bash
# Navigate to directory
cd /path/to/human-eval

# Start simple HTTP server
python3 -m http.server 8000

# Or use the provided test server
python3 test_server.py
```

### Open in Browser

```
http://localhost:8000/annotation_tool.html
```

### Test Checklist

- [ ] Page loads successfully
- [ ] Name prompt appears
- [ ] Can mark exclusions
- [ ] Sync status shows ✅ when Google Sheets is configured
- [ ] Can export CSV
- [ ] Can export Excel
- [ ] Data persists after refresh
- [ ] Check Google Sheet for data

---

## 🌐 GitHub Deployment

### Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com/new) and create a new repository
2. **Repository name**: `infinitystory-human-study` (exact name)
3. **Visibility**: Public (required for free GitHub Pages)
4. **Do NOT** initialize with README (we already have one)
5. Click **Create repository**

### Step 2: Set Up GitHub Secrets 🔐

**IMPORTANT**: Never commit sensitive URLs to your code!

1. Go to your repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the Google Sheets URL secret:
   - **Name**: `GOOGLE_SHEETS_URL` (exact name, case-sensitive)
   - **Value**: Your Google Apps Script Web App URL
     ```
     https://script.google.com/macros/s/AKfycby.../exec
     ```
   - Click **Add secret**

**Secret Name to Use**: `GOOGLE_SHEETS_URL`

**Why?** The code uses `{{GOOGLE_SHEETS_URL}}` as a placeholder. GitHub Actions will automatically replace this with your secret during deployment.

### Step 3: Push to GitHub

```bash
# Navigate to the project directory
cd /home/colligo/sensei-fs-link/projects/research/transitions-dataset/human-eval

# Initialize git
git init

# Add all files (respects .gitignore)
git add .

# Commit
git commit -m "Initial commit: Video annotation tool with Google Sheets integration"

# Set branch to main
git branch -M main

# Add remote - use the exact repository name
git remote add origin https://github.com/infinitystory-human-study/infinitystory-human-study.github.io.git

# Push to GitHub
git push -u origin main
```

### Step 4: Automatic Deployment

Once you push, GitHub Actions will automatically:
1. Replace `{{GOOGLE_SHEETS_URL}}` with your secret
2. Deploy to GitHub Pages
3. Make your tool live

**Check deployment:**
- Go to **Actions** tab in your repository
- Watch the deployment workflow run
- Wait for green ✅ checkmark (1-2 minutes)

### Step 5: Access Your Tool

After deployment completes, your tool will be live at:

```
https://infinitystory-human-study.github.io/annotation_tool.html
```

**Note**: Since this is a `.github.io` repository, it deploys to the root domain (no subdirectory).

### Updating the Google Sheets URL

If you need to change the URL later:

1. Go to **Settings** → **Secrets** → **Actions**
2. Click `GOOGLE_SHEETS_URL` → **Update secret**
3. Enter new value → **Update secret**
4. Trigger redeploy:
   ```bash
   git commit --allow-empty -m "Redeploy"
   git push
   ```

---

## 🎨 User Interface

### Export Section (Top of Page)

```
📊 Data Export & Quality Control

Quality Control Status: 0 objects excluded out of 0 total | Inclusion Rate: 100.0%

[📄 Export CSV] [📊 Export Excel] [📦 Export Both]
[☁️ Sync Now] [👤 Change Name] [🔄 Reset All]

Auto-save: Last saved at 2:45:30 PM
Annotator: Your Name | Session: abc12345
✅ Google Sheets: Synced at 2:45:30 PM
```

### Sync Status Indicators

- **⚙️** = Google Sheets disabled
- **⚠️** = Not configured
- **🔄** = Syncing in progress...
- **✅** = Successfully synced
- **❌** = Sync failed (saved locally)
- **📴** = Offline mode

### Keyboard Shortcuts

- **Arrow Left** (←) - Previous episode
- **Arrow Right** (→) - Next episode

---

## 📊 Data Export Formats

### CSV Export

Single CSV file with columns:
- Episode_ID, Object_Type, Object_Index, Object_Identity
- Excluded, Exclusion_Reason, Timestamp, User_Notes
- Episode timing and metadata

### Excel Export

Excel workbook with 3 sheets:
1. **Exclusion_Data** - Detailed records (same as CSV)
2. **Summary** - Per-episode statistics
3. **Statistics** - Overall metrics and exclusion reason breakdown

### Export Both

Downloads both CSV and Excel files simultaneously with matching timestamps.

---

## 🔧 Configuration

### Enable/Disable Google Sheets

Edit `annotation_tool.html` (line ~509):

```javascript
const ENABLE_GOOGLE_SHEETS = true;  // Set to false to disable
```

When disabled:
- Tool still works with localStorage
- Manual CSV/Excel exports available
- No cloud sync
- Good for offline-only scenarios

### Storage Options

Three layers of data backup:

1. **Browser localStorage**
   - Auto-saves every 30 seconds
   - Survives page refresh
   - Lost if browser cache cleared

2. **Google Sheets** (if enabled)
   - Auto-syncs after each change
   - Permanent cloud storage
   - Accessible anywhere
   - Multi-user collaboration

3. **Downloaded Files**
   - Manual CSV/Excel export
   - Permanent local backup
   - For offline analysis

---

## 🐛 Troubleshooting

### Issue: "Google Sheets: Not configured"

**Cause**: URL not set or Google Sheets disabled

**Solution**:
```javascript
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/.../exec';
const ENABLE_GOOGLE_SHEETS = true;
```

### Issue: "Sync failed - saved locally"

**Possible causes**:
1. Wrong Web App URL
2. Script not deployed properly
3. Network connection issues

**Solutions**:
- Verify the URL is correct
- Check Apps Script deployment settings
- Set "Who has access" to "Anyone"
- Test the URL directly in browser (should show status message)

### Issue: No data appearing in Google Sheet

**Solutions**:
1. Run `testEndpoint()` function in Apps Script
2. Check browser console (F12 → Console) for errors
3. Verify spreadsheet ID in Apps Script matches your sheet
4. Check Apps Script execution logs (View → Logs)

### Issue: Page won't load

**Solutions**:
- Check that file name is correct: `annotation_tool.html`
- Clear browser cache (Ctrl+Shift+Delete)
- Try a different browser
- Check browser console for errors

### Issue: Data lost after closing browser

**Cause**: Browser localStorage cleared or "Incognito/Private" mode

**Solutions**:
- Use normal browser mode (not incognito)
- Don't clear browser data while working
- Enable Google Sheets sync for permanent storage
- Export data regularly as backup

---

## 🛠️ Technical Details

### Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Google Apps Script
- **Storage**: Google Sheets + localStorage
- **Export**: SheetJS (xlsx.js) for Excel generation

### Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### File Structure

```
.
├── annotation_tool.html          # Main application
├── google-apps-script.js         # Backend script for Google Sheets
├── README.md                      # This file
├── .gitignore                     # Git ignore rules
├── html/
│   └── clips/                     # Video clips directory
│       ├── .gitkeep               # Preserves directory structure
│       └── [subdirectories]       # Organized by category
└── test_server.py                 # Local test server (not deployed)
```

### Data Flow

```
User annotates in browser
    ↓
Saved to localStorage (instant backup)
    ↓
Auto-sent to Google Sheets (if enabled)
    ↓
Appears in shared Google Sheet
    ↓
All annotators' data in one place
```

### Security & Privacy

**Data Storage**:
- Google Sheet is private by default (only you can see it)
- Share the sheet manually if you want others to view data
- No data sent to third parties

**User Tracking**:
- Only tracks annotator name (user-provided)
- Session ID (random, for data grouping)
- Timestamps of annotations
- No IP addresses, browser fingerprints, or location data

**Best Practices**:
- Use Google Workspace account for better control
- Don't share Google Apps Script URL publicly (though it's safe)
- Regularly export data as backup
- Review Google Sheet permissions periodically

---

## 📝 Workflow for Teams

### Setup (Once)

1. Admin sets up Google Sheet and Apps Script
2. Admin configures and deploys to GitHub Pages
3. Admin shares GitHub Pages URL with team

### Annotation (Ongoing)

1. Each annotator opens the GitHub Pages URL
2. Enters their name (stored locally)
3. Makes annotations
4. Data automatically syncs to shared Google Sheet

### Monitoring (Admin)

1. Check Google Sheet periodically
2. Review "Summary" tab for progress
3. Check "Update_Log" for recent activity
4. Export data when needed

### Data Analysis

1. Download from Google Sheets (File → Download)
2. Or use "Export Excel" button in tool
3. Analyze in Excel, Python, R, etc.

---

## 🎓 Best Practices

### For Annotators

- ✅ Enter a unique name (e.g., "Alice" not "User")
- ✅ Add clear exclusion reasons
- ✅ Check sync status shows ✅ green
- ✅ Export data at end of session as backup
- ❌ Don't clear browser cache during work
- ❌ Don't use incognito/private mode

### For Administrators

- ✅ Test thoroughly before sharing
- ✅ Provide clear instructions to annotators
- ✅ Monitor Google Sheet regularly
- ✅ Keep periodic exports as backup
- ✅ Document any project-specific guidelines
- ❌ Don't modify Google Sheet structure while in use
- ❌ Don't delete "Annotation_Data" sheet

---

## 📄 License

This tool is for research purposes. Contact the repository owner for usage permissions.

---

## 🙏 Credits

- Excel export powered by [SheetJS](https://sheetjs.com/)
- Data sync via [Google Apps Script](https://developers.google.com/apps-script)
- Built for video dataset annotation and quality control

---

## 📞 Support

For issues or questions:

1. Check this README's troubleshooting section
2. Check browser console (F12) for errors
3. Test with the local server first
4. Review Google Apps Script logs

---

**Repository**: `https://github.com/YOUR_USERNAME/YOUR_REPO`

**Tool Version**: 1.0.0 • Last Updated: November 2025
