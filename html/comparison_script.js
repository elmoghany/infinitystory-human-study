// ==========================================
// GOOGLE APPS SCRIPT CONFIGURATION
// ==========================================
// Web App URL (not the spreadsheet URL!)
// Spreadsheet: https://docs.google.com/spreadsheets/d/18TcgEqTi1HaS4AApDsrcGwCWjcSNX-18wv5a_77r5II
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwAs7R1PPGqK1AhQ1qTd2gpMM83V0mkRPBbwBX_1jLk8KZ3nbtNgD_ttdB8BZPs42q7Gw/exec';
const ENABLE_GOOGLE_SHEETS = true; // Will try to sync, but works offline if it fails
// Data is always saved to localStorage as backup

// ==========================================
// Global state
// ==========================================
let config = null;
let currentComparisonIndex = 0;
let comparisons = [];
let results = [];
let currentAnswers = {
    bgConsistency: null,
    transitions: null,
    characters: null,
    motion: null,
    aesthetic: null
};

// Sync status
let isSyncing = false;
let lastSyncTime = null;

// Generate evaluator ID
function generateEvaluatorId() {
    return 'EVAL_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

const evaluatorId = generateEvaluatorId();

// Debug mode - always show logs on mobile
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
console.log('🔍 DEBUG MODE:', {
    isMobile: isMobile,
    userAgent: navigator.userAgent,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    timestamp: new Date().toISOString()
});

// Initialize function
async function initializeApp() {
    console.log('✅ Initializing comparison evaluation...');
    console.log('Loading comparison evaluation...');
    
    try {
        console.log('📡 Fetching configuration...');
        await loadConfiguration();
        console.log('✅ Configuration loaded:', config ? 'SUCCESS' : 'FAILED');
        
        if (!config) {
            throw new Error('Configuration is null - fetch failed');
        }
        if (!config.papers) {
            throw new Error('Configuration missing papers array');
        }
        if (!config.evaluation_clips) {
            throw new Error('Configuration missing evaluation_clips array');
        }
        
        console.log('📊 Config has', config.papers.length, 'papers and', config.evaluation_clips.length, 'clips');
        
        console.log('🎲 Generating comparisons...');
        generateComparisons();
        console.log('✅ Generated', comparisons.length, 'comparisons');
        
        if (comparisons.length === 0) {
            throw new Error('Failed to generate comparisons - check papers configuration');
        }
        
        console.log('🎛️ Setting up event listeners...');
        setupEventListeners();
        
        console.log('🎬 Loading first comparison...');
        loadComparison(0);
        
        console.log('✅ Initialization complete!');
    } catch (error) {
        console.error('❌ Initialization error:', error);
        console.error('Stack:', error.stack);
        showError('Failed to load evaluation tool: ' + error.message);
    }
}

// Initialize - handle both DOMContentLoaded and already-loaded cases
if (document.readyState === 'loading') {
    console.log('⏳ Document still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    console.log('✅ Document already loaded, initializing immediately...');
    initializeApp();
}

// Load configuration
async function loadConfiguration() {
    // Build dynamic path based on current URL
    const currentURL = window.location.href;
    const basePath = currentURL.substring(0, currentURL.lastIndexOf('/') + 1);
    
    const paths = [
        basePath + 'evaluation_config.json',  // Same directory as HTML (BEST for mobile)
        './evaluation_config.json',
        'evaluation_config.json',
        window.location.origin + '/evaluation_config.json',
        '../evaluation_config.json',
        '/html/evaluation_config.json',
        'https://elmoghany.github.io/infinitystory-human-study/html/evaluation_config.json'
    ];
    
    console.log('📡 Current URL:', window.location.href);
    console.log('📡 Base path:', basePath);
    console.log('📡 Will try these paths in order:', paths);
    
    let lastError = null;
    
    for (const path of paths) {
        try {
            console.log(`📡 Trying to fetch: ${path}`);
            const response = await fetch(path);
            console.log(`📡 Response for ${path}:`, response.status, response.statusText);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            console.log(`📡 Response text length for ${path}:`, text.length);
            
            if (text.length < 10) {
                throw new Error('Response too short, probably invalid');
            }
            
            config = JSON.parse(text);
            console.log('✅ Configuration loaded successfully from:', path);
            console.log('✅ Config details:', {
                papers: config.papers?.length || 0,
                clips: config.evaluation_clips?.length || 0,
                sections: config.evaluation_sections?.length || 0
            });
            return; // Success!
            
        } catch (error) {
            console.warn(`❌ Failed to load from ${path}:`, error.message);
            lastError = error;
            continue; // Try next path
        }
    }
    
    // If we get here, all paths failed
    console.error('❌ All config paths failed!');
    console.error('Attempted paths:', paths);
    console.error('Last error:', lastError);
    throw new Error(`Failed to load configuration from any path. Last error: ${lastError?.message}`);
}

// Debug log storage for mobile
const debugLogs = [];
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Override console.log to capture logs
console.log = function(...args) {
    debugLogs.push({type: 'log', time: new Date().toISOString(), message: args.join(' ')});
    originalConsoleLog.apply(console, args);
};

console.error = function(...args) {
    debugLogs.push({type: 'error', time: new Date().toISOString(), message: args.join(' ')});
    originalConsoleError.apply(console, args);
};

// Add debug panel toggle (triple tap top-left corner)
let tapCount = 0;
let tapTimeout;
document.addEventListener('click', function(e) {
    if (e.clientX < 50 && e.clientY < 50) {
        tapCount++;
        clearTimeout(tapTimeout);
        tapTimeout = setTimeout(() => tapCount = 0, 1000);
        
        if (tapCount === 3) {
            showDebugPanel();
            tapCount = 0;
        }
    }
});

function showDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'debugPanel';
    panel.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); color: #0f0; font-family: monospace; font-size: 12px; overflow: auto; z-index: 10000; padding: 20px;';
    panel.innerHTML = `
        <div style="position: sticky; top: 0; background: #000; padding: 10px; border-bottom: 2px solid #0f0;">
            <button onclick="this.parentElement.parentElement.remove()" style="background: #f00; color: #fff; border: none; padding: 10px 20px; cursor: pointer;">Close</button>
            <button onclick="navigator.clipboard.writeText(document.getElementById('debugLogs').innerText)" style="background: #00f; color: #fff; border: none; padding: 10px 20px; cursor: pointer; margin-left: 10px;">Copy Logs</button>
        </div>
        <div id="debugLogs" style="white-space: pre-wrap; word-wrap: break-word; margin-top: 10px;">
${debugLogs.map(log => `[${log.time.split('T')[1]}] ${log.type.toUpperCase()}: ${log.message}`).join('\n')}

=== CURRENT STATE ===
Config loaded: ${config ? 'YES' : 'NO'}
Papers: ${config?.papers?.length || 0}
Clips: ${config?.evaluation_clips?.length || 0}
Comparisons generated: ${comparisons.length}
Current comparison: ${currentComparisonIndex + 1}/${comparisons.length}
Evaluator ID: ${evaluatorId}
Google Apps Script URL: ${GOOGLE_APPS_SCRIPT_URL === '{{GOOGLE_APPS_SCRIPT_URL}}' ? 'NOT CONFIGURED' : 'CONFIGURED'}

=== DEVICE INFO ===
User Agent: ${navigator.userAgent}
Screen: ${window.innerWidth}x${window.innerHeight}
Mobile: ${isMobile ? 'YES' : 'NO'}
        </div>
    `;
    document.body.appendChild(panel);
}

// Show error message to user
function showError(message) {
    const container = document.querySelector('.container');
    if (container) {
        container.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 10px; text-align: center; max-width: 600px; margin: 50px auto;">
                <h2 style="color: #e74c3c; margin-bottom: 20px;">⚠️ Error</h2>
                <p style="color: #333; margin-bottom: 20px;">${message}</p>
                <button onclick="location.reload()" style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 16px;">
                    🔄 Reload Page
                </button>
                <button onclick="showDebugPanel()" style="background: #34495e; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 16px; margin-left: 10px;">
                    🐛 Show Debug Info
                </button>
                <details style="margin-top: 30px; text-align: left; background: #f8f9fa; padding: 15px; border-radius: 5px;">
                    <summary style="cursor: pointer; font-weight: bold;">Quick Debug Info</summary>
                    <pre style="margin-top: 10px; font-size: 12px; overflow-x: auto;">Config loaded: ${config ? 'YES' : 'NO'}
Papers: ${config?.papers?.length || 0}
Comparisons: ${comparisons.length}
User Agent: ${navigator.userAgent}
Last logs: ${debugLogs.slice(-5).map(l => l.message).join('\n')}</pre>
                </details>
                <p style="margin-top: 20px; font-size: 12px; color: #7f8c8d;">
                    💡 Tip: Triple-tap top-left corner anytime to see full debug panel
                </p>
            </div>
        `;
    }
}

// Generate comparison sets
function generateComparisons() {
    if (!config || !config.papers || !config.evaluation_clips) {
        console.error('Config not loaded properly:', config);
        throw new Error('Configuration not loaded');
    }
    
    const papers = config.papers;
    const episodes = config.evaluation_clips.slice(0, 4); // Use first 4 episodes
    
    // Find InfinityStory and other papers
    const infinityStory = papers.find(p => p.id === 'infinitystory');
    const otherPapers = papers.filter(p => p.id !== 'infinitystory');
    
    if (!infinityStory) {
        console.error('InfinityStory not found in papers!');
        throw new Error('InfinityStory configuration missing');
    }
    
    if (otherPapers.length < 2) {
        console.error('Not enough comparison papers!');
        throw new Error('Insufficient comparison methods configured');
    }
    
    // For each episode, create ONE comparison: InfinityStory + 2 random other papers
    episodes.forEach((episode, episodeIndex) => {
        // Randomly select 2 other papers
        const shuffledOthers = shuffleArray([...otherPapers]);
        const selectedPapers = shuffledOthers.slice(0, 2);
        
        // Create array with InfinityStory + 2 selected papers
        const threePapers = [infinityStory, ...selectedPapers];
        
        // Randomize position to avoid bias (A, B, or C)
        const shuffled = shuffleArray([...threePapers]);
        
        comparisons.push({
            episode: episode,
            episodeIndex: episodeIndex + 1,
            papers: shuffled,
            mapping: {
                A: shuffled[0].id,
                B: shuffled[1].id,
                C: shuffled[2].id
            }
        });
    });
    
    console.log(`Generated ${comparisons.length} comparisons (10 episodes with InfinityStory + 2 others each)`);
    updateProgress();
}

// Fisher-Yates shuffle
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Load current comparison
function loadComparison(index) {
    console.log(`🎬 Loading comparison ${index + 1}/${comparisons.length}`);
    
    if (index >= comparisons.length) {
        console.log('✅ All comparisons complete, showing completion screen');
        completeEvaluation();
        return;
    }
    
    currentComparisonIndex = index;
    const comparison = comparisons[index];
    
    console.log('📹 Comparison details:', {
        episode: comparison.episode,
        paperA: comparison.papers[0].directory,
        paperB: comparison.papers[1].directory,
        paperC: comparison.papers[2].directory
    });
    
    // Load videos
    const videoA = `clips/${comparison.papers[0].directory}/${comparison.episode}`;
    const videoB = `clips/${comparison.papers[1].directory}/${comparison.episode}`;
    const videoC = `clips/${comparison.papers[2].directory}/${comparison.episode}`;
    
    console.log('📹 Video URLs:', {A: videoA, B: videoB, C: videoC});
    
    document.getElementById('sourceA').src = videoA;
    document.getElementById('sourceB').src = videoB;
    document.getElementById('sourceC').src = videoC;
    
    // Add error handlers for video loading
    const videos = ['videoA', 'videoB', 'videoC'];
    videos.forEach(id => {
        const video = document.getElementById(id);
        video.addEventListener('error', function(e) {
            console.error(`❌ Video ${id} failed to load:`, {
                error: e,
                src: video.querySelector('source')?.src,
                networkState: video.networkState,
                readyState: video.readyState
            });
        }, {once: true});
        video.addEventListener('loadeddata', function() {
            console.log(`✅ Video ${id} loaded successfully`);
        }, {once: true});
    });
    
    // Check if mobile/iOS and show load button
    if (isMobile) {
        const loadPrompt = document.getElementById('loadVideosPrompt');
        const loadBtn = document.getElementById('loadVideosBtn');
        loadPrompt.style.display = 'block';
        
        loadBtn.onclick = async function() {
            console.log('📱 User tapped Load Videos button');
            loadPrompt.style.display = 'none';
            
            // Load and briefly play videos to unlock them (iOS requirement)
            const videoA = document.getElementById('videoA');
            const videoB = document.getElementById('videoB');
            const videoC = document.getElementById('videoC');
            
            videoA.load();
            videoB.load();
            videoC.load();
            
            // Play briefly then pause (unlocks playback on iOS)
            // Videos are muted initially to allow programmatic play
            try {
                await videoA.play();
                videoA.pause();
                videoA.currentTime = 0;
                videoA.muted = false; // Unmute after unlocking
                console.log('✅ Video A unlocked and unmuted');
            } catch(e) { console.log('⚠️ Video A unlock failed:', e.message); }
            
            try {
                await videoB.play();
                videoB.pause();
                videoB.currentTime = 0;
                videoB.muted = false; // Unmute after unlocking
                console.log('✅ Video B unlocked and unmuted');
            } catch(e) { console.log('⚠️ Video B unlock failed:', e.message); }
            
            try {
                await videoC.play();
                videoC.pause();
                videoC.currentTime = 0;
                videoC.muted = false; // Unmute after unlocking
                console.log('✅ Video C unlocked and unmuted');
            } catch(e) { console.log('⚠️ Video C unlock failed:', e.message); }
        };
    } else {
        // Desktop: load immediately
        document.getElementById('videoA').load();
        document.getElementById('videoB').load();
        document.getElementById('videoC').load();
    }
    
    // Reset answers
    currentAnswers = {
        bgConsistency: null,
        transitions: null,
        characters: null,
        motion: null,
        aesthetic: null
    };
    
    // Clear selections
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Reapply seek prevention to videos
    setupSeekPrevention();
    
    updateProgress();
    checkSubmitButton();
    
    console.log('✅ Comparison loaded, waiting for user input');
}

// Disable seeking on videos to prevent freezing issues
function setupSeekPrevention() {
    const videos = ['videoA', 'videoB', 'videoC'];
    videos.forEach(videoId => {
        const video = document.getElementById(videoId);
        
        // Remove old listeners by cloning and replacing
        const newVideo = video.cloneNode(true);
        video.parentNode.replaceChild(newVideo, video);
        const freshVideo = document.getElementById(videoId);
        
        // Store the current time
        let currentTime = 0;
        
        // Update current time when playing
        freshVideo.addEventListener('timeupdate', function() {
            if (!freshVideo.seeking) {
                currentTime = freshVideo.currentTime;
            }
        });
        
        // Prevent seeking forward (but allow replay from start)
        freshVideo.addEventListener('seeking', function() {
            if (freshVideo.currentTime > currentTime + 0.5) {
                freshVideo.currentTime = currentTime;
            }
        });
        
        // DO NOT prevent clicks - this blocks the play button and all controls on mobile!
        // The seeking event handler above already prevents forward seeking
    });
}

// Setup event listeners
function setupEventListeners() {
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const question = this.dataset.question;
            const answer = this.dataset.answer;
            
            // Clear other selections in this question
            document.querySelectorAll(`[data-question="${question}"]`).forEach(b => {
                b.classList.remove('selected');
            });
            
            // Select this button
            this.classList.add('selected');
            
            // Save answer
            currentAnswers[question] = answer;
            
            checkSubmitButton();
        });
    });
    
    // Apply seek prevention
    setupSeekPrevention();
}

// Check if all questions answered
function checkSubmitButton() {
    const allAnswered = Object.values(currentAnswers).every(a => a !== null);
    document.getElementById('submitBtn').disabled = !allAnswered;
}

// Update progress
function updateProgress() {
    const percentage = (currentComparisonIndex / comparisons.length) * 100;
    document.getElementById('progressFill').style.width = percentage + '%';
    document.getElementById('progressText').textContent = 
        `Comparison ${currentComparisonIndex + 1} of ${comparisons.length}`;
}

// Submit current comparison
function submitComparison() {
    const comparison = comparisons[currentComparisonIndex];
    
    // Map answers back to actual paper IDs
    const result = {
        comparisonIndex: currentComparisonIndex + 1,
        episode: comparison.episode,
        episodeIndex: comparison.episodeIndex,
        timestamp: new Date().toISOString(),
        videoA: comparison.mapping.A,
        videoB: comparison.mapping.B,
        videoC: comparison.mapping.C,
        answers: {
            backgroundConsistency: comparison.mapping[currentAnswers.bgConsistency],
            transitions: comparison.mapping[currentAnswers.transitions],
            characterConsistency: comparison.mapping[currentAnswers.characters],
            motionSmoothness: comparison.mapping[currentAnswers.motion],
            imageQualityAesthetic: comparison.mapping[currentAnswers.aesthetic]
        },
        rawAnswers: {...currentAnswers}
    };
    
    results.push(result);
    
    // Save to localStorage
    const savedData = {
        evaluatorId: evaluatorId,
        timestamp: new Date().toISOString(),
        comparisons: results
    };
    localStorage.setItem('comparison_results', JSON.stringify(savedData));
    
    // Sync to Google Sheets after each submission
    syncToGoogleSheets(savedData);
    
    // Load next comparison
    loadComparison(currentComparisonIndex + 1);
}

// Previous comparison
function previousComparison() {
    if (currentComparisonIndex > 0) {
        loadComparison(currentComparisonIndex - 1);
    }
}

// Complete evaluation
function completeEvaluation() {
    document.getElementById('evaluationPhase').style.display = 'none';
    document.getElementById('completionPhase').style.display = 'block';
}

// Google Sheets Sync
function syncToGoogleSheets(data) {
    console.log('🔍 DEBUG: syncToGoogleSheets called');
    console.log('🔍 DEBUG: ENABLE_GOOGLE_SHEETS =', ENABLE_GOOGLE_SHEETS);
    console.log('🔍 DEBUG: GOOGLE_APPS_SCRIPT_URL =', GOOGLE_APPS_SCRIPT_URL);
    console.log('🔍 DEBUG: URL is placeholder?', GOOGLE_APPS_SCRIPT_URL === '{{GOOGLE_APPS_SCRIPT_URL}}');
    
    if (!ENABLE_GOOGLE_SHEETS) {
        console.log('❌ Google Sheets sync disabled');
        return Promise.resolve();
    }
    
    if (!GOOGLE_APPS_SCRIPT_URL || GOOGLE_APPS_SCRIPT_URL === '{{GOOGLE_APPS_SCRIPT_URL}}') {
        console.log('❌ Google Apps Script URL not configured (still has placeholder)');
        console.log('🔍 DEBUG: Current value:', GOOGLE_APPS_SCRIPT_URL);
        return Promise.resolve();
    }
    
    if (isSyncing) {
        console.log('⏳ Sync already in progress');
        return Promise.resolve();
    }
    
    isSyncing = true;
    console.log('📤 Syncing to Google Sheets via sendBeacon (bypasses CORS)...');
    console.log('🔗 Target URL:', GOOGLE_APPS_SCRIPT_URL);
    
    const dataToSync = {
        evaluatorId: data.evaluatorId,
        timestamp: data.timestamp,
        totalComparisons: data.comparisons.length,
        comparisons: data.comparisons
    };
    
    console.log('📊 Data to sync:', {
        evaluatorId: dataToSync.evaluatorId,
        totalComparisons: dataToSync.totalComparisons,
        comparisonsCount: dataToSync.comparisons.length
    });
    console.log('📦 Full payload size:', JSON.stringify(dataToSync).length, 'bytes');
    
    // Use navigator.sendBeacon to bypass CORS
    // IMPORTANT: Use text/plain to avoid CORS preflight
    try {
        const blob = new Blob([JSON.stringify(dataToSync)], { type: 'text/plain' });
        const success = navigator.sendBeacon(GOOGLE_APPS_SCRIPT_URL, blob);
        
        if (success) {
            lastSyncTime = new Date();
            console.log('✅ Data sent to Google Sheets via sendBeacon at', lastSyncTime.toLocaleTimeString());
            console.log('✅ sendBeacon returned true - data queued for delivery');
            isSyncing = false;
            return Promise.resolve(true);
        } else {
            console.error('⚠️ sendBeacon returned false - queue might be full');
            isSyncing = false;
            return Promise.resolve(false);
        }
        
    } catch (error) {
        console.error('❌ Error syncing to Google Sheets:', error);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        isSyncing = false;
        return Promise.resolve(false);
    }
}

// Download results
function downloadResults() {
    const data = {
        evaluatorId: evaluatorId,
        completedAt: new Date().toISOString(),
        totalComparisons: results.length,
        results: results
    };
    
    // Final sync to Google Sheets
    syncToGoogleSheets({
        evaluatorId: evaluatorId,
        timestamp: new Date().toISOString(),
        comparisons: results
    });
    
    // Generate CSV
    let csv = 'Comparison,Episode,Episode Index,Video A,Video B,Video C,Best Background,Best Transitions,Best Characters,Best Motion,Best Aesthetic\n';
    
    results.forEach(r => {
        csv += `${r.comparisonIndex},${r.episode},${r.episodeIndex},`;
        csv += `${r.videoA},${r.videoB},${r.videoC},`;
        csv += `${r.answers.backgroundConsistency},`;
        csv += `${r.answers.transitions},`;
        csv += `${r.answers.characterConsistency},`;
        csv += `${r.answers.motionSmoothness},`;
        csv += `${r.answers.imageQualityAesthetic}\n`;
    });
    
    // Download JSON
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `comparison_results_${evaluatorId}.json`;
    jsonLink.click();
    
    // Download CSV
    setTimeout(() => {
        const csvBlob = new Blob([csv], { type: 'text/csv' });
        const csvUrl = URL.createObjectURL(csvBlob);
        const csvLink = document.createElement('a');
        csvLink.href = csvUrl;
        csvLink.download = `comparison_results_${evaluatorId}.csv`;
        csvLink.click();
    }, 500);
}

