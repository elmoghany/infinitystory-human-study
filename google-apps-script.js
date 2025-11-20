// ==========================================
// Google Apps Script for Video Annotation Data Collection
// ==========================================
// This script receives data from the HTML annotation tool
// and saves it to your Google Sheet

// Spreadsheet ID from your Google Sheet URL
// This will be replaced by GitHub Actions during deployment
// Secret name in GitHub: SPREADSHEET_ID
const SPREADSHEET_ID = '{{SPREADSHEET_ID}}';

function doPost(e) {
  try {
    // Parse incoming data
    const data = JSON.parse(e.postData.contents);
    
    // Detect data type: annotation tool vs comparison evaluation
    if (data.comparisons) {
      // This is comparison evaluation data
      Logger.log('Received comparison data from: ' + data.evaluatorId);
      return handleComparisonData(data);
    } else if (data.annotatorName) {
      // This is annotation tool data
      Logger.log('Received annotation data from: ' + data.annotatorName);
      return handleAnnotationData(data);
    } else {
      throw new Error('Unknown data format');
    }
      
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return createCORSResponse({
      status: 'error',
      message: error.toString()
    });
  }
}

// Handle CORS preflight requests
function doGet(e) {
  return createCORSResponse({
    status: 'ok',
    message: 'Video Evaluation Data Collection API is running (Annotation + Comparison)',
    timestamp: new Date().toISOString()
  });
}

// Helper function to create JSON responses
// Google Apps Script automatically handles CORS when deployed as Web App with "Anyone" access
function createCORSResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Handle annotation tool data
function handleAnnotationData(data) {
  try {
    // Get the spreadsheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Get or create sheets
    let dataSheet = ss.getSheetByName('Annotation_Data');
    if (!dataSheet) {
      dataSheet = ss.insertSheet('Annotation_Data');
      // Add headers
      dataSheet.appendRow([
        'Timestamp',
        'Annotator_Name',
        'Session_ID',
        'Episode_ID',
        'Object_Type',
        'Object_Index',
        'Object_Identity',
        'Excluded',
        'Exclusion_Reason',
        'User_Notes',
        'Update_Time'
      ]);
      dataSheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
      dataSheet.setFrozenRows(1);
    }
    
    let logSheet = ss.getSheetByName('Update_Log');
    if (!logSheet) {
      logSheet = ss.insertSheet('Update_Log');
      logSheet.appendRow(['Timestamp', 'Annotator', 'Session_ID', 'Action', 'Rows_Added']);
      logSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff');
      logSheet.setFrozenRows(1);
    }
    
    let summarySheet = ss.getSheetByName('Summary');
    if (!summarySheet) {
      summarySheet = ss.insertSheet('Summary');
      summarySheet.appendRow(['Annotator', 'Session_ID', 'Total_Objects', 'Excluded', 'Last_Update']);
      summarySheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#fbbc04').setFontColor('#ffffff');
      summarySheet.setFrozenRows(1);
    }
    
    // Create or get Ratings sheet
    let ratingsSheet = ss.getSheetByName('Ratings');
    if (!ratingsSheet) {
      ratingsSheet = ss.insertSheet('Ratings');
      ratingsSheet.appendRow([
        'Timestamp',
        'Annotator_Name',
        'Session_ID',
        'Video_ID',
        'Method',
        'Episode',
        'Rating',
        'Notes',
        'Rated_At'
      ]);
      ratingsSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#ea4335').setFontColor('#ffffff');
      ratingsSheet.setFrozenRows(1);
    }
    
    // Process the data
    const timestamp = new Date();
    const annotatorName = data.annotatorName || 'Anonymous';
    const sessionId = data.sessionId || 'unknown';
    
    // Clear previous data from this session to avoid duplicates
    // (optional - comment out if you want to keep history)
    const dataRange = dataSheet.getDataRange();
    const values = dataRange.getValues();
    let deletedRows = 0;
    for (let i = values.length - 1; i >= 1; i--) {
      if (values[i][2] === sessionId) { // Column C is Session_ID (index 2)
        dataSheet.deleteRow(i + 1);
        deletedRows++;
      }
    }
    
    if (deletedRows > 0) {
      Logger.log('Deleted ' + deletedRows + ' old rows from session: ' + sessionId);
    }
    
    // Add new data rows
    let rowsAdded = 0;
    let totalExcluded = 0;
    
    Object.keys(data.episodes || {}).forEach(episodeId => {
      const episode = data.episodes[episodeId];
      
      // Representative object
      if (episode.representative) {
        const isExcluded = episode.representative.excluded || false;
        if (isExcluded) totalExcluded++;
        
        dataSheet.appendRow([
          timestamp,
          annotatorName,
          sessionId,
          episodeId,
          'representative',
          0,
          episode.representative.objectIdentity || 'Unknown',
          isExcluded,
          episode.representative.reason || '',
          episode.representative.notes || '',
          episode.representative.timestamp || ''
        ]);
        rowsAdded++;
      }
      
      // Cropped objects
      (episode.cropped || []).forEach((obj, index) => {
        const isExcluded = obj.excluded || false;
        if (isExcluded) totalExcluded++;
        
        dataSheet.appendRow([
          timestamp,
          annotatorName,
          sessionId,
          episodeId,
          'cropped',
          index,
          obj.objectIdentity || 'Unknown',
          isExcluded,
          obj.reason || '',
          obj.notes || '',
          obj.timestamp || ''
        ]);
        rowsAdded++;
      });
      
      // Outside objects
      (episode.outside || []).forEach((obj, index) => {
        const isExcluded = obj.excluded || false;
        if (isExcluded) totalExcluded++;
        
        dataSheet.appendRow([
          timestamp,
          annotatorName,
          sessionId,
          episodeId,
          'outside',
          index,
          obj.objectIdentity || 'Unknown',
          isExcluded,
          obj.reason || '',
          obj.notes || '',
          obj.timestamp || ''
        ]);
        rowsAdded++;
      });
    });
    
    // Auto-resize columns for better readability
    dataSheet.autoResizeColumns(1, 11);
    
    // Process ratings data
    let ratingsAdded = 0;
    if (data.ratings) {
      // Clear previous ratings from this session
      const ratingsRange = ratingsSheet.getDataRange();
      const ratingsValues = ratingsRange.getValues();
      for (let i = ratingsValues.length - 1; i >= 1; i--) {
        if (ratingsValues[i][2] === sessionId) { // Column C is Session_ID
          ratingsSheet.deleteRow(i + 1);
        }
      }
      
      // Add new ratings
      Object.keys(data.ratings).forEach(videoId => {
        const rating = data.ratings[videoId];
        ratingsSheet.appendRow([
          timestamp,
          annotatorName,
          sessionId,
          rating.videoId || videoId,
          rating.method || '',
          rating.episode || '',
          rating.rating || '',
          rating.notes || '',
          rating.timestamp || ''
        ]);
        ratingsAdded++;
      });
      
      // Auto-resize ratings columns
      ratingsSheet.autoResizeColumns(1, 9);
    }
    
    // Log the update
    logSheet.appendRow([
      timestamp,
      annotatorName,
      sessionId,
      'Data Update',
      rowsAdded + ' annotations, ' + ratingsAdded + ' ratings'
    ]);
    logSheet.autoResizeColumns(1, 5);
    
    // Update summary
    updateSummary(summarySheet, annotatorName, sessionId, rowsAdded, totalExcluded, timestamp);
    
    Logger.log('Successfully added ' + rowsAdded + ' rows for ' + annotatorName);
    
    // Return success
    return createCORSResponse({
      status: 'success',
      message: `Updated ${rowsAdded} rows (${totalExcluded} excluded)`,
      timestamp: timestamp.toISOString(),
      rowsAdded: rowsAdded,
      totalExcluded: totalExcluded
    });
      
  } catch (error) {
    Logger.log('Error in annotation handler: ' + error.toString());
    throw error;
  }
}

// Handle comparison evaluation data
function handleComparisonData(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Get or create Comparison_Results sheet
    let resultsSheet = ss.getSheetByName('Comparison_Results');
    if (!resultsSheet) {
      resultsSheet = ss.insertSheet('Comparison_Results');
      resultsSheet.appendRow([
        'Timestamp', 'Evaluator_ID', 'Comparison_Index', 'Episode', 'Episode_Index',
        'Video_A', 'Video_B', 'Video_C', 'Best_Background', 'Best_Transitions',
        'Best_Characters', 'Best_Motion', 'Best_Aesthetic', 'Raw_Answers'
      ]);
      resultsSheet.getRange(1, 1, 1, 14).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
      resultsSheet.setFrozenRows(1);
    }
    
    // Get or create Summary sheet
    let summarySheet = ss.getSheetByName('Comparison_Summary');
    if (!summarySheet) {
      summarySheet = ss.insertSheet('Comparison_Summary');
      summarySheet.appendRow(['Evaluator_ID', 'Total_Comparisons', 'First_Submission', 'Last_Update', 'Completed']);
      summarySheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff');
      summarySheet.setFrozenRows(1);
    }
    
    // Get or create Win_Stats sheet
    let statsSheet = ss.getSheetByName('Win_Statistics');
    if (!statsSheet) {
      statsSheet = ss.insertSheet('Win_Statistics');
      statsSheet.appendRow([
        'Method', 'Background_Wins', 'Transition_Wins', 'Character_Wins',
        'Motion_Wins', 'Aesthetic_Wins', 'Total_Wins', 'Total_Comparisons', 'Win_Rate_%'
      ]);
      statsSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#fbbc04').setFontColor('#ffffff');
      statsSheet.setFrozenRows(1);
    }
    
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
    
    resultsSheet.autoResizeColumns(1, 14);
    
    // Update summary
    updateComparisonSummary(summarySheet, evaluatorId, comparisons.length, timestamp);
    
    // Update win statistics
    updateWinStatistics(statsSheet, resultsSheet);
    
    Logger.log('Successfully added ' + rowsAdded + ' comparison rows for ' + evaluatorId);
    
    return createCORSResponse({
      status: 'success',
      message: `Saved ${rowsAdded} comparisons`,
      timestamp: timestamp.toISOString(),
      rowsAdded: rowsAdded
    });
      
  } catch (error) {
    Logger.log('Error in comparison handler: ' + error.toString());
    throw error;
  }
}

// Update comparison summary
function updateComparisonSummary(summarySheet, evaluatorId, totalComparisons, timestamp) {
  const dataRange = summarySheet.getDataRange();
  const values = dataRange.getValues();
  
  let rowIndex = -1;
  let firstSubmission = timestamp;
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === evaluatorId) {
      rowIndex = i + 1;
      firstSubmission = values[i][2];
      break;
    }
  }
  
  const isCompleted = totalComparisons >= 4;
  
  if (rowIndex > 0) {
    summarySheet.getRange(rowIndex, 1, 1, 5).setValues([[
      evaluatorId, totalComparisons, firstSubmission, timestamp, isCompleted
    ]]);
  } else {
    summarySheet.appendRow([evaluatorId, totalComparisons, timestamp, timestamp, isCompleted]);
  }
  
  summarySheet.autoResizeColumns(1, 5);
}

// Update win statistics
function updateWinStatistics(statsSheet, resultsSheet) {
  const dataRange = resultsSheet.getDataRange();
  const values = dataRange.getValues();
  
  const stats = {};
  const methods = ['infinitystory', 'movieagent', 'videogenofthought'];
  
  methods.forEach(method => {
    stats[method] = { background: 0, transitions: 0, characters: 0, motion: 0, aesthetic: 0, total: 0 };
  });
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (stats[row[8]]) stats[row[8]].background++;
    if (stats[row[9]]) stats[row[9]].transitions++;
    if (stats[row[10]]) stats[row[10]].characters++;
    if (stats[row[11]]) stats[row[11]].motion++;
    if (stats[row[12]]) stats[row[12]].aesthetic++;
  }
  
  const totalComparisons = values.length - 1;
  
  methods.forEach(method => {
    const s = stats[method];
    s.total = s.background + s.transitions + s.characters + s.motion + s.aesthetic;
  });
  
  if (statsSheet.getLastRow() > 1) {
    statsSheet.deleteRows(2, statsSheet.getLastRow() - 1);
  }
  
  methods.forEach(method => {
    const s = stats[method];
    const winRate = totalComparisons > 0 ? (s.total / (totalComparisons * 5) * 100).toFixed(1) : 0;
    statsSheet.appendRow([method, s.background, s.transitions, s.characters, s.motion, s.aesthetic, s.total, totalComparisons, winRate]);
  });
  
  statsSheet.autoResizeColumns(1, 9);
  
  const maxTotal = Math.max(...methods.map(m => stats[m].total));
  for (let i = 0; i < methods.length; i++) {
    if (stats[methods[i]].total === maxTotal) {
      statsSheet.getRange(i + 2, 1, 1, 9).setBackground('#d4edda');
    }
  }
}

// Update summary sheet
function updateSummary(summarySheet, annotatorName, sessionId, totalObjects, totalExcluded, timestamp) {
  const dataRange = summarySheet.getDataRange();
  const values = dataRange.getValues();
  
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === annotatorName && values[i][1] === sessionId) {
      rowIndex = i + 1; // +1 because sheets are 1-indexed
      break;
    }
  }
  
  if (rowIndex > 0) {
    // Update existing row
    summarySheet.getRange(rowIndex, 1, 1, 5).setValues([[
      annotatorName,
      sessionId,
      totalObjects,
      totalExcluded,
      timestamp
    ]]);
  } else {
    // Add new row
    summarySheet.appendRow([
      annotatorName,
      sessionId,
      totalObjects,
      totalExcluded,
      timestamp
    ]);
  }
  
  summarySheet.autoResizeColumns(1, 5);
}

// Test annotation endpoint
function testAnnotationEndpoint() {
  const testData = {
    annotatorName: 'Test User',
    sessionId: 'test-' + Date.now(),
    timestamp: new Date().toISOString(),
    episodes: {
      1: {
        representative: {
          objectIdentity: 'Bowl',
          excluded: true,
          reason: 'Not clearly visible',
          notes: 'Test annotation',
          timestamp: new Date().toISOString()
        },
        cropped: [
          {
            objectIdentity: 'Spoon',
            excluded: false,
            reason: '',
            notes: '',
            timestamp: new Date().toISOString()
          }
        ],
        outside: []
      },
      2: {
        representative: {
          objectIdentity: 'Knife',
          excluded: false,
          reason: '',
          notes: '',
          timestamp: new Date().toISOString()
        },
        cropped: [],
        outside: [
          {
            objectIdentity: 'Plate',
            excluded: true,
            reason: 'Out of frame',
            notes: 'Cannot see it',
            timestamp: new Date().toISOString()
          }
        ]
      }
    }
  };
  
  const e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(e);
  Logger.log('Test result: ' + result.getContent());
}

// Test comparison endpoint
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
  Logger.log('Comparison test result: ' + result.getContent());
}

