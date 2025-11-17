// Global state
let config = null;
let evaluationData = {
    evaluatorId: generateEvaluatorId(),
    startTime: new Date().toISOString(),
    segmentEvaluations: [],
    wholisticEvaluations: [],
    endTime: null
};

let currentPhase = 'segment'; // 'segment', 'wholistic', 'complete'
let currentTaskIndex = 0;
let currentSectionIndex = 0;
let currentQuestionInSection = 0;
let currentPaperIndex = 0;
let currentWholisticVideoIndex = 0;
let allTasks = [];
let sections = [];
let lastSaveTime = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing Video Evaluation System...');
    await loadConfiguration();
    checkForSavedProgress();
});

// Generate unique evaluator ID
function generateEvaluatorId() {
    return 'EVAL_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Check for saved progress
function checkForSavedProgress() {
    const saved = localStorage.getItem('evaluation_progress');
    if (saved) {
        try {
            const savedData = JSON.parse(saved);
            const savedDate = new Date(savedData.lastSaveTime);
            const timeSince = Math.round((Date.now() - savedDate.getTime()) / 60000); // minutes
            
            const message = `Found saved progress from ${timeSince} minutes ago.\n\n` +
                          `Progress: ${savedData.currentTaskIndex}/${savedData.totalTasks} questions completed\n` +
                          `Phase: ${savedData.currentPhase}\n\n` +
                          `Do you want to resume?`;
            
            if (confirm(message)) {
                resumeProgress(savedData);
            } else {
                // Start fresh - clear saved data
                if (confirm('Start a new evaluation? (Previous progress will be deleted)')) {
                    localStorage.removeItem('evaluation_progress');
                    initializeSegmentPhase();
                } else {
                    resumeProgress(savedData);
                }
            }
        } catch (error) {
            console.error('Error loading saved progress:', error);
            initializeSegmentPhase();
        }
    } else {
        initializeSegmentPhase();
    }
}

// Resume from saved progress
function resumeProgress(savedData) {
    console.log('Resuming from saved progress:', savedData);
    
    // Restore evaluation data
    evaluationData = savedData.evaluationData;
    currentPhase = savedData.currentPhase;
    currentTaskIndex = savedData.currentTaskIndex;
    currentPaperIndex = savedData.currentPaperIndex || 0;
    currentWholisticVideoIndex = savedData.currentWholisticVideoIndex || 0;
    
    // Resume appropriate phase (pass false to prevent resetting indices)
    if (currentPhase === 'segment') {
        initializeSegmentPhase(false); // Don't reset progress
    } else if (currentPhase === 'wholistic') {
        initializeWholisticPhase(false); // Don't reset progress
    } else {
        completeEvaluation();
    }
    
    // Update last save time display
    updateLastSaveDisplay();
}

// Save current progress
function saveProgress() {
    // Create lightweight task order (only save identifying info, not full objects)
    const taskOrder = allTasks.map(task => ({
        paperId: task.paperId,
        sectionId: task.sectionId,
        clipFilename: task.clipFilename
    }));
    
    const progressData = {
        evaluationData: evaluationData,
        currentPhase: currentPhase,
        currentTaskIndex: currentTaskIndex,
        currentPaperIndex: currentPaperIndex,
        currentWholisticVideoIndex: currentWholisticVideoIndex,
        totalTasks: allTasks.length,
        taskOrder: taskOrder,  // Save the task order
        lastSaveTime: new Date().toISOString()
    };
    
    localStorage.setItem('evaluation_progress', JSON.stringify(progressData));
    lastSaveTime = new Date();
    updateLastSaveDisplay();
    console.log('Progress saved at', lastSaveTime.toLocaleTimeString());
}

// Update last save time display
function updateLastSaveDisplay() {
    const saveInfo = document.getElementById('saveInfo');
    if (saveInfo && lastSaveTime) {
        saveInfo.textContent = `Last saved: ${lastSaveTime.toLocaleTimeString()}`;
        saveInfo.style.display = 'block';
    }
}

// Save and exit
function saveAndExit() {
    saveProgress();
    alert('Progress saved! You can close this window and resume later by opening the evaluation page again.');
}

// Clear saved progress
function clearSavedProgress() {
    if (confirm('Are you sure you want to delete all saved progress?')) {
        localStorage.removeItem('evaluation_progress');
        alert('Saved progress cleared. Reloading page...');
        location.reload();
    }
}

// Load configuration
async function loadConfiguration() {
    try {
        const response = await fetch('./evaluation_config.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        config = await response.json();
        console.log('Configuration loaded:', config);
        
        // Check if we have saved task order to restore
        const saved = localStorage.getItem('evaluation_progress');
        let savedTaskOrder = null;
        if (saved) {
            try {
                const savedData = JSON.parse(saved);
                savedTaskOrder = savedData.taskOrder || null;
            } catch (e) {
                console.error('Error parsing saved progress:', e);
            }
        }
        
        // Generate all tasks organized by section
        generateSectionBasedTasks(savedTaskOrder);
    } catch (error) {
        console.error('Error loading configuration:', error);
        alert('Failed to load evaluation configuration. Please check the console for details.');
    }
}

// Generate tasks organized by section
function generateSectionBasedTasks(savedTaskOrder = null) {
    allTasks = [];
    sections = [];
    
    // Sort sections by order
    const sortedSections = [...config.evaluation_sections].sort((a, b) => a.order - b.order);
    
    sortedSections.forEach(section => {
        const sectionTasks = [];
        
        // For each paper, create tasks for this section
        config.papers.forEach(paper => {
            // Use a subset of clips for each section (configurable via clips_per_section)
            const clipsToUse = config.evaluation_clips.slice(0, config.clips_per_section || 4);
            
            clipsToUse.forEach(clipFilename => {
                sectionTasks.push({
                    paperId: paper.id,
                    paperName: paper.name,
                    paperDescription: paper.description,
                    paperDirectory: paper.directory,
                    sectionId: section.id,
                    sectionName: section.name,
                    sectionDescription: section.description,
                    clipFilename: clipFilename,
                    starLabels: section.star_labels
                });
            });
        });
        
        // Shuffle tasks within this section to randomize paper order
        // BUT: Don't shuffle if we're restoring from saved order
        if (!savedTaskOrder) {
            shuffleArray(sectionTasks);
        }
        
        sections.push({
            section: section,
            tasks: sectionTasks,
            totalQuestions: sectionTasks.length
        });
        
        allTasks.push(...sectionTasks);
    });
    
    // If restoring from saved order, reorder tasks to match
    if (savedTaskOrder && savedTaskOrder.length === allTasks.length) {
        allTasks = savedTaskOrder.map(savedTask => 
            allTasks.find(task => 
                task.paperId === savedTask.paperId && 
                task.sectionId === savedTask.sectionId && 
                task.clipFilename === savedTask.clipFilename
            )
        ).filter(task => task !== undefined);
        console.log('Restored task order from saved progress');
    }
    
    console.log('Generated', allTasks.length, 'evaluation tasks across', sections.length, 'sections');
}

// Fisher-Yates shuffle
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Initialize segment evaluation phase
function initializeSegmentPhase(resetProgress = true) {
    currentPhase = 'segment';
    
    // Only reset indices if starting fresh (not resuming)
    if (resetProgress) {
        currentTaskIndex = 0;
        currentSectionIndex = 0;
        currentQuestionInSection = 0;
    }
    
    document.getElementById('segmentPhase').style.display = 'block';
    document.getElementById('wholisticPhase').style.display = 'none';
    document.getElementById('completionPhase').style.display = 'none';
    document.getElementById('currentPhase').textContent = 'Phase 1: Clip-by-Clip Evaluation';
    
    updateProgress();
    loadCurrentTask();
}

// Update progress bar
function updateProgress() {
    const total = allTasks.length;
    const current = currentTaskIndex;
    const percentage = (current / total) * 100;
    
    document.getElementById('progressFill').style.width = percentage + '%';
    
    // Calculate current section and question
    let tasksCompleted = 0;
    let currentSec = 0;
    let questionNum = 0;
    
    for (let i = 0; i < sections.length; i++) {
        if (current >= tasksCompleted && current < tasksCompleted + sections[i].totalQuestions) {
            currentSec = i;
            questionNum = current - tasksCompleted + 1;
            break;
        }
        tasksCompleted += sections[i].totalQuestions;
    }
    
    if (current < total) {
        const sectionName = sections[currentSec].section.name;
        const totalInSection = sections[currentSec].totalQuestions;
        document.getElementById('progressText').textContent = 
            `Section ${currentSec + 1}/${sections.length}: ${sectionName} - Question ${questionNum} of ${totalInSection}`;
    } else {
        document.getElementById('progressText').textContent = 
            `All ${total} questions completed!`;
    }
}

// Load current task
function loadCurrentTask() {
    if (currentTaskIndex >= allTasks.length) {
        // All segment tasks complete, move to wholistic phase
        initializeWholisticPhase();
        return;
    }
    
    const task = allTasks[currentTaskIndex];
    
    // Update UI
    document.getElementById('paperName').textContent = task.paperName;
    document.getElementById('paperDescription').textContent = task.paperDescription;
    document.getElementById('taskType').textContent = task.sectionName;
    document.getElementById('taskDescription').textContent = task.sectionDescription;
    
    // Create evaluation question
    const questionText = `Rate the ${task.sectionName.toLowerCase()} in this video clip`;
    document.getElementById('evaluationQuestion').textContent = questionText;
    document.getElementById('followUpLabel').textContent = 'Additional Comments (Optional):';
    
    // Load video
    const videoPath = `clips/${task.paperDirectory}/${task.clipFilename}`;
    const videoPlayer = document.getElementById('videoPlayer');
    const videoSource = document.getElementById('videoSource');
    
    videoSource.src = videoPath;
    videoPlayer.load();
    
    // Populate rating options (5-star system)
    populateStarRatingOptions(task.starLabels);
    
    // Clear previous selections
    clearSelections();
}

// Populate 5-star rating options
function populateStarRatingOptions(starLabels) {
    const container = document.getElementById('ratingOptions');
    container.innerHTML = '';
    
    // Create 5-star rating system
    for (let star = 5; star >= 1; star--) {
        const div = document.createElement('div');
        div.className = 'rating-option';
        div.dataset.value = star;
        div.onclick = () => selectRating(div);
        
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'rating';
        input.value = star;
        input.id = 'star_' + star;
        
        const label = document.createElement('label');
        label.htmlFor = 'star_' + star;
        
        // Create star display
        const starDisplay = document.createElement('span');
        starDisplay.className = 'star-display';
        starDisplay.innerHTML = '★'.repeat(star) + '☆'.repeat(5 - star);
        
        const labelText = document.createElement('span');
        labelText.className = 'star-label';
        labelText.textContent = ` ${star} Star${star > 1 ? 's' : ''} - ${starLabels[star]}`;
        
        label.appendChild(starDisplay);
        label.appendChild(labelText);
        
        div.appendChild(input);
        div.appendChild(label);
        container.appendChild(div);
    }
}

// Select rating option
function selectRating(element) {
    // Remove previous selection
    document.querySelectorAll('.rating-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Select current
    element.classList.add('selected');
    element.querySelector('input').checked = true;
    
    // Enable submit button
    document.getElementById('submitBtn').disabled = false;
}

// Clear selections
function clearSelections() {
    document.querySelectorAll('.rating-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.querySelector('input').checked = false;
    });
    document.getElementById('followUpText').value = '';
    document.getElementById('submitBtn').disabled = true;
}

// Submit task
function submitTask() {
    const task = allTasks[currentTaskIndex];
    const selectedOption = document.querySelector('.rating-option.selected');
    
    if (!selectedOption) {
        alert('Please select a rating before submitting.');
        return;
    }
    
    const rating = parseInt(selectedOption.dataset.value);
    const followUp = document.getElementById('followUpText').value;
    
    // Save evaluation
    const evaluation = {
        taskIndex: currentTaskIndex,
        paperId: task.paperId,
        paperName: task.paperName,
        sectionId: task.sectionId,
        sectionName: task.sectionName,
        clipFilename: task.clipFilename,
        rating: rating,
        followUpComments: followUp,
        timestamp: new Date().toISOString()
    };
    
    evaluationData.segmentEvaluations.push(evaluation);
    console.log('Evaluation saved:', evaluation);
    
    // Auto-save progress
    saveProgress();
    
    // Move to next task
    currentTaskIndex++;
    updateProgress();
    loadCurrentTask();
}

// Skip task
function skipTask() {
    const task = allTasks[currentTaskIndex];
    
    // Save as skipped
    const evaluation = {
        taskIndex: currentTaskIndex,
        paperId: task.paperId,
        paperName: task.paperName,
        sectionId: task.sectionId,
        sectionName: task.sectionName,
        clipFilename: task.clipFilename,
        rating: null,
        followUpComments: 'SKIPPED',
        timestamp: new Date().toISOString()
    };
    
    evaluationData.segmentEvaluations.push(evaluation);
    
    // Move to next task
    currentTaskIndex++;
    updateProgress();
    loadCurrentTask();
}

// Initialize wholistic review phase
function initializeWholisticPhase(resetProgress = true) {
    currentPhase = 'wholistic';
    
    // Only reset indices if starting fresh (not resuming)
    if (resetProgress) {
        currentPaperIndex = 0;
        currentWholisticVideoIndex = 0;
    }
    
    document.getElementById('segmentPhase').style.display = 'none';
    document.getElementById('wholisticPhase').style.display = 'block';
    document.getElementById('completionPhase').style.display = 'none';
    document.getElementById('currentPhase').textContent = 'Phase 2: Overall Model Review';
    
    loadCurrentPaperReview();
}

// Load current paper for wholistic review
function loadCurrentPaperReview() {
    if (currentPaperIndex >= config.papers.length) {
        // All papers reviewed, move to completion
        completeEvaluation();
        return;
    }
    
    const paper = config.papers[currentPaperIndex];
    const videoFiles = config.evaluation_clips.slice(0, 5); // Show first 5 videos
    
    // Update UI
    document.getElementById('wholisticPaperName').textContent = paper.name;
    document.getElementById('wholisticPaperDescription').textContent = paper.description;
    document.getElementById('videoList').textContent = videoFiles.join(', ');
    document.getElementById('wholisticProgress').textContent = 
        `Paper ${currentPaperIndex + 1} of ${config.papers.length}`;
    
    // Load first video
    currentWholisticVideoIndex = 0;
    loadWholisticVideo(paper, videoFiles);
    
    // Populate criteria ratings (5-star system)
    populateWholisticCriteriaRatings();
    
    // Clear previous inputs
    document.getElementById('overallComments').value = '';
}

// Load wholistic video
function loadWholisticVideo(paper, videoFiles) {
    const videoPlayer = document.getElementById('wholisticVideoPlayer');
    const videoSource = document.getElementById('wholisticVideoSource');
    const videoPath = `clips/${paper.directory}/${videoFiles[currentWholisticVideoIndex]}`;
    
    videoSource.src = videoPath;
    videoPlayer.load();
    
    // Update counter
    document.getElementById('videoCounter').textContent = 
        `Video ${currentWholisticVideoIndex + 1} of ${videoFiles.length}`;
    
    // Update button states
    document.getElementById('prevVideoBtn').disabled = currentWholisticVideoIndex === 0;
    document.getElementById('nextVideoBtn').disabled = 
        currentWholisticVideoIndex >= videoFiles.length - 1;
}

// Navigate wholistic videos
function previousWholisticVideo() {
    if (currentWholisticVideoIndex > 0) {
        currentWholisticVideoIndex--;
        const paper = config.papers[currentPaperIndex];
        const videoFiles = config.evaluation_clips.slice(0, 5);
        loadWholisticVideo(paper, videoFiles);
    }
}

function nextWholisticVideo() {
    const videoFiles = config.evaluation_clips.slice(0, 5);
    if (currentWholisticVideoIndex < videoFiles.length - 1) {
        currentWholisticVideoIndex++;
        const paper = config.papers[currentPaperIndex];
        loadWholisticVideo(paper, videoFiles);
    }
}

// Populate wholistic criteria ratings (5-star system)
function populateWholisticCriteriaRatings() {
    const container = document.getElementById('criteriaRatings');
    container.innerHTML = '';
    
    config.wholistic_criteria.forEach(criterion => {
        const div = document.createElement('div');
        div.className = 'criterion-item';
        
        const title = document.createElement('h5');
        title.textContent = criterion.name;
        
        const desc = document.createElement('p');
        desc.className = 'criterion-description';
        desc.textContent = criterion.description;
        
        const scaleContainer = document.createElement('div');
        scaleContainer.className = 'criterion-scale';
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'scale-buttons';
        
        // Create 5-star buttons with labels
        for (let i = 1; i <= 5; i++) {
            const button = document.createElement('button');
            button.className = 'scale-button';
            button.dataset.criterionId = criterion.id;
            button.dataset.value = i;
            button.onclick = () => selectCriterionRating(button);
            
            const starSpan = document.createElement('div');
            starSpan.className = 'button-stars';
            starSpan.innerHTML = '★'.repeat(i);
            
            const labelSpan = document.createElement('div');
            labelSpan.className = 'button-label';
            labelSpan.textContent = criterion.star_labels[i];
            labelSpan.style.fontSize = '0.75em';
            labelSpan.style.marginTop = '5px';
            
            button.appendChild(starSpan);
            button.appendChild(labelSpan);
            buttonsContainer.appendChild(button);
        }
        
        scaleContainer.appendChild(buttonsContainer);
        
        div.appendChild(title);
        div.appendChild(desc);
        div.appendChild(scaleContainer);
        container.appendChild(div);
    });
}

// Select criterion rating
function selectCriterionRating(button) {
    const criterionId = button.dataset.criterionId;
    
    // Remove previous selection for this criterion
    document.querySelectorAll(`[data-criterion-id="${criterionId}"]`).forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Select current
    button.classList.add('selected');
}

// Submit paper review
function submitPaperReview() {
    const paper = config.papers[currentPaperIndex];
    const ratings = {};
    let allRated = true;
    
    // Collect all criterion ratings
    config.wholistic_criteria.forEach(criterion => {
        const selectedButton = document.querySelector(
            `.scale-button[data-criterion-id="${criterion.id}"].selected`
        );
        
        if (selectedButton) {
            ratings[criterion.id] = parseInt(selectedButton.dataset.value);
        } else {
            allRated = false;
        }
    });
    
    if (!allRated) {
        const proceed = confirm(
            'Some criteria have not been rated. Do you want to continue anyway?'
        );
        if (!proceed) return;
    }
    
    const comments = document.getElementById('overallComments').value;
    
    // Save wholistic evaluation
    const evaluation = {
        paperId: paper.id,
        paperName: paper.name,
        ratings: ratings,
        overallComments: comments,
        timestamp: new Date().toISOString()
    };
    
    evaluationData.wholisticEvaluations.push(evaluation);
    console.log('Paper review saved:', evaluation);
    
    // Auto-save progress
    saveProgress();
    
    // Move to next paper
    currentPaperIndex++;
    loadCurrentPaperReview();
}

// Skip paper
function skipPaper() {
    const paper = config.papers[currentPaperIndex];
    
    // Save as skipped
    const evaluation = {
        paperId: paper.id,
        paperName: paper.name,
        ratings: {},
        overallComments: 'SKIPPED',
        timestamp: new Date().toISOString()
    };
    
    evaluationData.wholisticEvaluations.push(evaluation);
    
    // Move to next paper
    currentPaperIndex++;
    loadCurrentPaperReview();
}

// Complete evaluation
function completeEvaluation() {
    evaluationData.endTime = new Date().toISOString();
    
    currentPhase = 'complete';
    document.getElementById('segmentPhase').style.display = 'none';
    document.getElementById('wholisticPhase').style.display = 'none';
    document.getElementById('completionPhase').style.display = 'block';
    document.getElementById('currentPhase').textContent = 'Evaluation Complete';
    
    // Display summary stats
    displaySummaryStats();
    
    // Save final data and clear progress
    localStorage.setItem('evaluation_data', JSON.stringify(evaluationData));
    localStorage.removeItem('evaluation_progress');
    console.log('Evaluation data saved to localStorage');
}

// Display summary stats
function displaySummaryStats() {
    const container = document.getElementById('summaryStats');
    container.innerHTML = '';
    
    const stats = [
        {
            label: 'Segment Evaluations',
            value: evaluationData.segmentEvaluations.length
        },
        {
            label: 'Papers Reviewed',
            value: evaluationData.wholisticEvaluations.length
        },
        {
            label: 'Total Questions',
            value: allTasks.length
        },
        {
            label: 'Completion Rate',
            value: Math.round((evaluationData.segmentEvaluations.filter(e => e.rating !== null).length / allTasks.length) * 100) + '%'
        }
    ];
    
    stats.forEach(stat => {
        const div = document.createElement('div');
        div.className = 'stat-item';
        
        const value = document.createElement('div');
        value.className = 'stat-value';
        value.textContent = stat.value;
        
        const label = document.createElement('div');
        label.className = 'stat-label';
        label.textContent = stat.label;
        
        div.appendChild(value);
        div.appendChild(label);
        container.appendChild(div);
    });
}

// Export to Excel
function exportToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Excel export library not loaded. Please check your internet connection.');
        return;
    }
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Segment Evaluations
    const segmentData = evaluationData.segmentEvaluations.map(e => ({
        'Task Index': e.taskIndex,
        'Paper': e.paperName,
        'Section': e.sectionName,
        'Clip': e.clipFilename,
        'Rating (Stars)': e.rating,
        'Comments': e.followUpComments,
        'Timestamp': e.timestamp
    }));
    const ws1 = XLSX.utils.json_to_sheet(segmentData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Segment Evaluations');
    
    // Sheet 2: Wholistic Evaluations
    const wholisticData = evaluationData.wholisticEvaluations.map(e => {
        const row = {
            'Paper': e.paperName,
            'Comments': e.overallComments,
            'Timestamp': e.timestamp
        };
        
        // Add all criterion ratings
        Object.keys(e.ratings).forEach(criterionId => {
            const criterion = config.wholistic_criteria.find(c => c.id === criterionId);
            if (criterion) {
                row[criterion.name + ' (Stars)'] = e.ratings[criterionId];
            }
        });
        
        return row;
    });
    const ws2 = XLSX.utils.json_to_sheet(wholisticData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Wholistic Reviews');
    
    // Sheet 3: Summary
    const summaryData = [
        { 'Field': 'Evaluator ID', 'Value': evaluationData.evaluatorId },
        { 'Field': 'Start Time', 'Value': evaluationData.startTime },
        { 'Field': 'End Time', 'Value': evaluationData.endTime },
        { 'Field': 'Total Questions', 'Value': allTasks.length },
        { 'Field': 'Completed Segments', 'Value': evaluationData.segmentEvaluations.filter(e => e.rating !== null).length },
        { 'Field': 'Skipped Segments', 'Value': evaluationData.segmentEvaluations.filter(e => e.rating === null).length },
        { 'Field': 'Papers Reviewed', 'Value': evaluationData.wholisticEvaluations.length },
        { 'Field': 'Rating System', 'Value': '5-Star Scale' }
    ];
    const ws3 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Summary');
    
    // Generate filename
    const filename = `evaluation_${evaluationData.evaluatorId}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, filename);
    console.log('Excel file exported:', filename);
}

// Export to JSON
function exportToJSON() {
    const dataStr = JSON.stringify(evaluationData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluation_${evaluationData.evaluatorId}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('JSON file exported');
}

// Restart evaluation
function restartEvaluation() {
    if (confirm('Are you sure you want to start a new evaluation? Current data will be saved to localStorage.')) {
        location.reload();
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    if (currentPhase === 'segment') {
        // Number keys 1-5 for quick rating
        if (event.key >= '1' && event.key <= '5') {
            const options = document.querySelectorAll('.rating-option');
            // Options are in reverse order (5 stars first)
            const index = 5 - parseInt(event.key);
            if (options[index]) {
                selectRating(options[index]);
            }
        }
        // Enter to submit
        if (event.key === 'Enter' && !document.getElementById('submitBtn').disabled) {
            submitTask();
        }
        // Space to skip
        if (event.key === ' ' && event.target.tagName !== 'TEXTAREA') {
            event.preventDefault();
            skipTask();
        }
    }
});
