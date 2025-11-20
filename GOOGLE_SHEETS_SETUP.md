# Google Sheets Setup for Comparison Evaluation

## How Data is Filled in Google Sheets

When users complete comparisons, data is automatically sent to your Google Sheet and organized into **3 tabs**:

---

## 📊 Tab 1: **Comparison_Results** (Detailed Data)

This sheet contains every comparison made by every user.

**Columns:**

| Column | Description | Example |
|--------|-------------|---------|
| **Timestamp** | When the comparison was submitted | 2025-11-20 14:30:25 |
| **Evaluator_ID** | Unique ID for each user | EVAL_1732123456_abc123 |
| **Comparison_Index** | Which comparison (1-4) | 1 |
| **Episode** | Video filename | episode_01.mp4 |
| **Episode_Index** | Episode number | 1 |
| **Video_A** | Method shown as Video A | infinitystory |
| **Video_B** | Method shown as Video B | movieagent |
| **Video_C** | Method shown as Video C | videogenofthought |
| **Best_Background** | Winner for background consistency | infinitystory |
| **Best_Transitions** | Winner for smooth transitions | movieagent |
| **Best_Characters** | Winner for character consistency | infinitystory |
| **Best_Motion** | Winner for motion smoothness | infinitystory |
| **Best_Aesthetic** | Winner for image quality & aesthetic | videogenofthought |
| **Raw_Answers** | Original A/B/C answers | {"bgConsistency":"A",...} |

**Example Rows:**

```
Timestamp               | Evaluator_ID         | Comparison | Episode       | Best_Background | Best_Transitions | ...
2025-11-20 14:30:25    | EVAL_1732123456_abc  | 1          | episode_01.mp4| infinitystory   | movieagent       | ...
2025-11-20 14:32:10    | EVAL_1732123456_abc  | 2          | episode_02.mp4| infinitystory   | infinitystory    | ...
2025-11-20 14:35:45    | EVAL_1732123456_abc  | 3          | episode_03.mp4| movieagent      | infinitystory    | ...
2025-11-20 14:38:20    | EVAL_1732123456_abc  | 4          | episode_04.mp4| infinitystory   | videogenofthought| ...
2025-11-20 15:10:15    | EVAL_1732127890_xyz  | 1          | episode_01.mp4| infinitystory   | infinitystory    | ...
```

---

## 📈 Tab 2: **Comparison_Summary** (User Progress)

This sheet shows completion status for each evaluator.

**Columns:**

| Column | Description | Example |
|--------|-------------|---------|
| **Evaluator_ID** | Unique ID for the user | EVAL_1732123456_abc |
| **Total_Comparisons** | How many comparisons completed | 4 |
| **First_Submission** | When they started | 2025-11-20 14:30:25 |
| **Last_Update** | Last submission time | 2025-11-20 14:38:20 |
| **Completed** | Whether all 4 are done | TRUE |

**Example Rows:**

```
Evaluator_ID         | Total_Comparisons | First_Submission     | Last_Update          | Completed
EVAL_1732123456_abc  | 4                 | 2025-11-20 14:30:25 | 2025-11-20 14:38:20 | TRUE
EVAL_1732127890_xyz  | 2                 | 2025-11-20 15:10:15 | 2025-11-20 15:15:30 | FALSE
```

---

## 🏆 Tab 3: **Win_Statistics** (Aggregate Results)

This sheet shows overall wins for each method across all criteria.

**Columns:**

| Column | Description | Example |
|--------|-------------|---------|
| **Method** | Video generation method | infinitystory |
| **Background_Wins** | Times won for background | 6 |
| **Transition_Wins** | Times won for transitions | 5 |
| **Character_Wins** | Times won for characters | 7 |
| **Motion_Wins** | Times won for motion | 6 |
| **Aesthetic_Wins** | Times won for aesthetic | 4 |
| **Total_Wins** | Total wins across all criteria | 28 |
| **Total_Comparisons** | Number of comparisons analyzed | 8 |
| **Win_Rate_%** | Percentage of total possible wins | 70.0% |

**Example (after 2 users complete 4 comparisons each = 8 total):**

```
Method              | Background | Transitions | Characters | Motion | Aesthetic | Total_Wins | Total_Comparisons | Win_Rate_%
infinitystory       | 6          | 5           | 7          | 6      | 4         | 28         | 8                 | 70.0%
movieagent          | 2          | 2           | 1          | 1      | 2         | 8          | 8                 | 20.0%
videogenofthought   | 0          | 1           | 0          | 1      | 2         | 4          | 8                 | 10.0%
```

**The winning method (highest Total_Wins) is highlighted in light green.**

---

## 🔧 Setup Steps

### Step 1: Create Google Apps Script

1. Create a new Google Sheet
2. Go to **Extensions > Apps Script**
3. Delete default code and paste the contents of `google-apps-script-comparison.js`
4. Replace `YOUR_SPREADSHEET_ID_HERE` with your actual spreadsheet ID
   - Get it from the URL: `https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit`
5. Click **Save** (💾)
6. Click **Deploy > New deployment**
7. Select type: **Web app**
8. Settings:
   - Execute as: **Me**
   - Who has access: **Anyone**
9. Click **Deploy**
10. Copy the **Web app URL** (e.g., `https://script.google.com/macros/s/ABC...XYZ/exec`)

### Step 2: Add to GitHub Secrets

1. Go to your GitHub repo: `https://github.com/elmoghany/infinitystory-human-study`
2. Go to **Settings > Secrets and variables > Actions**
3. Click **New repository secret**
4. Name: `GOOGLE_SHEETS_URL`
5. Value: Paste the Web app URL from Step 1
6. Click **Add secret**

### Step 3: Deploy

1. Commit and push your changes
2. GitHub Actions will automatically inject the Google Sheets URL
3. Users visiting the live site will have their data automatically synced!

---

## 📝 Data Flow

```
User completes comparison
    ↓
JavaScript sends data to Google Sheets URL
    ↓
Google Apps Script receives data
    ↓
Data is parsed and written to 3 sheets:
  1. Comparison_Results (raw data)
  2. Comparison_Summary (user progress)
  3. Win_Statistics (aggregate stats)
    ↓
Sheet automatically updates and calculates win rates
```

---

## ✅ Testing

Run the `testComparisonEndpoint()` function in Google Apps Script to verify setup:
1. Open Apps Script editor
2. Select `testComparisonEndpoint` from the function dropdown
3. Click **Run** (▶️)
4. Check your Google Sheet - you should see test data appear!

---

## 🔍 Analyzing Results

### Quick Analysis in Google Sheets:

**Who's winning overall?**
→ Check `Win_Statistics` sheet, look at `Total_Wins` column

**Per criterion:**
→ `Win_Statistics` shows wins for each criterion (Background, Transitions, etc.)

**User progress:**
→ `Comparison_Summary` shows who completed and who's still in progress

**Raw data:**
→ `Comparison_Results` has every individual comparison for detailed analysis

### Export for Python/R:
- File > Download > Comma Separated Values (.csv)
- Import into pandas/R for statistical analysis

