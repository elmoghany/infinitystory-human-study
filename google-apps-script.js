// ==========================================
// Google Apps Script for Video Annotation Data Collection
// ==========================================
// This script receives data from the HTML annotation tool
// and saves it to your Google Sheet

// Spreadsheet ID from your Google Sheet URL
// IMPORTANT: Replace this with your actual spreadsheet ID before deploying
// Get it from: https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

function doPost(e) {
  try {
    // Parse incoming data
    const data = JSON.parse(e.postData.contents);
    
    Logger.log('Received data from: ' + data.annotatorName);
    
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
    
    // Log the update
    logSheet.appendRow([
      timestamp,
      annotatorName,
      sessionId,
      'Data Update',
      rowsAdded
    ]);
    logSheet.autoResizeColumns(1, 5);
    
    // Update summary
    updateSummary(summarySheet, annotatorName, sessionId, rowsAdded, totalExcluded, timestamp);
    
    Logger.log('Successfully added ' + rowsAdded + ' rows for ' + annotatorName);
    
    // Return success
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: `Updated ${rowsAdded} rows (${totalExcluded} excluded)`,
        timestamp: timestamp.toISOString(),
        rowsAdded: rowsAdded,
        totalExcluded: totalExcluded
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    // Return error
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
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

// Test function - run this to verify the script works
function testEndpoint() {
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

// Optional: Create a simple GET endpoint to check if the script is working
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Video Annotation Data Collection API is running',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

