// ==========================================
// Google Apps Script for Video Comparison Evaluation Data Collection
// ==========================================
// This script receives data from the comparison evaluation tool
// and saves it to your Google Sheet

// IMPORTANT: Replace this with your actual spreadsheet ID before deploying
// Get it from: https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

function doPost(e) {
  try {
    // Parse incoming data
    const data = JSON.parse(e.postData.contents);
    
    Logger.log('Received comparison data from: ' + data.evaluatorId);
    
    // Get the spreadsheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Get or create Comparison_Results sheet
    let resultsSheet = ss.getSheetByName('Comparison_Results');
    if (!resultsSheet) {
      resultsSheet = ss.insertSheet('Comparison_Results');
      // Add headers
      resultsSheet.appendRow([
        'Timestamp',
        'Evaluator_ID',
        'Comparison_Index',
        'Episode',
        'Episode_Index',
        'Video_A',
        'Video_B',
        'Video_C',
        'Best_Background',
        'Best_Transitions',
        'Best_Characters',
        'Best_Motion',
        'Best_Aesthetic',
        'Raw_Answers'
      ]);
      resultsSheet.getRange(1, 1, 1, 14).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
      resultsSheet.setFrozenRows(1);
    }
    
    // Get or create Summary sheet
    let summarySheet = ss.getSheetByName('Comparison_Summary');
    if (!summarySheet) {
      summarySheet = ss.insertSheet('Comparison_Summary');
      summarySheet.appendRow([
        'Evaluator_ID',
        'Total_Comparisons',
        'First_Submission',
        'Last_Update',
        'Completed'
      ]);
      summarySheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff');
      summarySheet.setFrozenRows(1);
    }
    
    // Get or create Win_Stats sheet
    let statsSheet = ss.getSheetByName('Win_Statistics');
    if (!statsSheet) {
      statsSheet = ss.insertSheet('Win_Statistics');
      statsSheet.appendRow([
        'Method',
        'Background_Wins',
        'Transition_Wins',
        'Character_Wins',
        'Motion_Wins',
        'Aesthetic_Wins',
        'Total_Wins',
        'Total_Comparisons',
        'Win_Rate_%'
      ]);
      statsSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#fbbc04').setFontColor('#ffffff');
      statsSheet.setFrozenRows(1);
    }
    
    // Process the comparison data
    const timestamp = new Date();
    const evaluatorId = data.evaluatorId || 'unknown';
    const comparisons = data.comparisons || [];
    
    // Add comparison rows
    let rowsAdded = 0;
    comparisons.forEach(comparison => {
      resultsSheet.appendRow([
        comparison.timestamp || timestamp,
        evaluatorId,
        comparison.comparisonIndex,
        comparison.episode,
        comparison.episodeIndex,
        comparison.videoA,
        comparison.videoB,
        comparison.videoC,
        comparison.answers.backgroundConsistency,
        comparison.answers.transitions,
        comparison.answers.characterConsistency,
        comparison.answers.motionSmoothness,
        comparison.answers.imageQualityAesthetic,
        JSON.stringify(comparison.rawAnswers)
      ]);
      rowsAdded++;
    });
    
    // Auto-resize columns
    resultsSheet.autoResizeColumns(1, 14);
    
    // Update summary
    updateComparisonSummary(summarySheet, evaluatorId, comparisons.length, timestamp);
    
    // Update win statistics
    updateWinStatistics(statsSheet, resultsSheet);
    
    Logger.log('Successfully added ' + rowsAdded + ' comparison rows for ' + evaluatorId);
    
    // Return success
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: `Saved ${rowsAdded} comparisons`,
        timestamp: timestamp.toISOString(),
        rowsAdded: rowsAdded
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Update summary sheet
function updateComparisonSummary(summarySheet, evaluatorId, totalComparisons, timestamp) {
  const dataRange = summarySheet.getDataRange();
  const values = dataRange.getValues();
  
  let rowIndex = -1;
  let firstSubmission = timestamp;
  
  // Find existing evaluator
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === evaluatorId) {
      rowIndex = i + 1;
      firstSubmission = values[i][2]; // Keep original first submission time
      break;
    }
  }
  
  const isCompleted = totalComparisons >= 4; // 4 comparisons expected
  
  if (rowIndex > 0) {
    // Update existing row
    summarySheet.getRange(rowIndex, 1, 1, 5).setValues([[
      evaluatorId,
      totalComparisons,
      firstSubmission,
      timestamp,
      isCompleted
    ]]);
  } else {
    // Add new row
    summarySheet.appendRow([
      evaluatorId,
      totalComparisons,
      timestamp,
      timestamp,
      isCompleted
    ]);
  }
  
  summarySheet.autoResizeColumns(1, 5);
}

// Update win statistics
function updateWinStatistics(statsSheet, resultsSheet) {
  // Get all results
  const dataRange = resultsSheet.getDataRange();
  const values = dataRange.getValues();
  
  // Count wins for each method
  const stats = {};
  const methods = ['infinitystory', 'movieagent', 'videogenofthought'];
  
  methods.forEach(method => {
    stats[method] = {
      background: 0,
      transitions: 0,
      characters: 0,
      motion: 0,
      aesthetic: 0,
      total: 0
    };
  });
  
  // Skip header row (index 0)
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const background = row[8];   // Best_Background
    const transitions = row[9];  // Best_Transitions
    const characters = row[10];  // Best_Characters
    const motion = row[11];      // Best_Motion
    const aesthetic = row[12];   // Best_Aesthetic
    
    if (stats[background]) stats[background].background++;
    if (stats[transitions]) stats[transitions].transitions++;
    if (stats[characters]) stats[characters].characters++;
    if (stats[motion]) stats[motion].motion++;
    if (stats[aesthetic]) stats[aesthetic].aesthetic++;
  }
  
  const totalComparisons = values.length - 1; // Exclude header
  
  // Calculate totals
  methods.forEach(method => {
    stats[method].total = stats[method].background + 
                          stats[method].transitions + 
                          stats[method].characters + 
                          stats[method].motion + 
                          stats[method].aesthetic;
  });
  
  // Clear existing stats (except header)
  if (statsSheet.getLastRow() > 1) {
    statsSheet.deleteRows(2, statsSheet.getLastRow() - 1);
  }
  
  // Add updated stats
  methods.forEach(method => {
    const s = stats[method];
    const winRate = totalComparisons > 0 ? (s.total / (totalComparisons * 5) * 100).toFixed(1) : 0;
    
    statsSheet.appendRow([
      method,
      s.background,
      s.transitions,
      s.characters,
      s.motion,
      s.aesthetic,
      s.total,
      totalComparisons,
      winRate
    ]);
  });
  
  statsSheet.autoResizeColumns(1, 9);
  
  // Apply conditional formatting to highlight winner
  const maxTotal = Math.max(...methods.map(m => stats[m].total));
  const dataRangeStats = statsSheet.getRange(2, 1, methods.length, 9);
  const statsValues = dataRangeStats.getValues();
  
  for (let i = 0; i < statsValues.length; i++) {
    if (statsValues[i][6] === maxTotal) { // Total_Wins column
      statsSheet.getRange(i + 2, 1, 1, 9).setBackground('#d4edda'); // Light green
    }
  }
}

// Test function
function testComparisonEndpoint() {
  const testData = {
    evaluatorId: 'EVAL_test_' + Date.now(),
    timestamp: new Date().toISOString(),
    totalComparisons: 2,
    comparisons: [
      {
        comparisonIndex: 1,
        episode: 'episode_01.mp4',
        episodeIndex: 1,
        timestamp: new Date().toISOString(),
        videoA: 'infinitystory',
        videoB: 'movieagent',
        videoC: 'videogenofthought',
        answers: {
          backgroundConsistency: 'infinitystory',
          transitions: 'movieagent',
          characterConsistency: 'infinitystory',
          motionSmoothness: 'infinitystory',
          imageQualityAesthetic: 'videogenofthought'
        },
        rawAnswers: { bgConsistency: 'A', transitions: 'B', characters: 'A', motion: 'A', aesthetic: 'C' }
      },
      {
        comparisonIndex: 2,
        episode: 'episode_02.mp4',
        episodeIndex: 2,
        timestamp: new Date().toISOString(),
        videoA: 'movieagent',
        videoB: 'infinitystory',
        videoC: 'videogenofthought',
        answers: {
          backgroundConsistency: 'infinitystory',
          transitions: 'infinitystory',
          characterConsistency: 'movieagent',
          motionSmoothness: 'infinitystory',
          imageQualityAesthetic: 'infinitystory'
        },
        rawAnswers: { bgConsistency: 'B', transitions: 'B', characters: 'A', motion: 'B', aesthetic: 'B' }
      }
    ]
  };
  
  const e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(e);
  Logger.log('Test result: ' + result.getContent());
}

// GET endpoint for status check
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Video Comparison Evaluation API is running',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

