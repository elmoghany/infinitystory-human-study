// Global state
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

// Generate evaluator ID
function generateEvaluatorId() {
    return 'EVAL_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

const evaluatorId = generateEvaluatorId();

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Loading comparison evaluation...');
    await loadConfiguration();
    generateComparisons();
    setupEventListeners();
    loadComparison(0);
});

// Load configuration
async function loadConfiguration() {
    try {
        const response = await fetch('./evaluation_config.json');
        config = await response.json();
        console.log('Configuration loaded:', config);
    } catch (error) {
        console.error('Error loading configuration:', error);
        alert('Error loading configuration. Please refresh the page.');
    }
}

// Generate comparison sets
function generateComparisons() {
    const papers = config.papers;
    const episodes = config.evaluation_clips.slice(0, 10); // Use first 10 episodes
    
    // Find InfinityStory and other papers
    const infinityStory = papers.find(p => p.id === 'infinitystory');
    const otherPapers = papers.filter(p => p.id !== 'infinitystory');
    
    if (!infinityStory) {
        console.error('InfinityStory not found in papers!');
        return;
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
    if (index >= comparisons.length) {
        completeEvaluation();
        return;
    }
    
    currentComparisonIndex = index;
    const comparison = comparisons[index];
    
    // Load videos
    document.getElementById('sourceA').src = `clips/${comparison.papers[0].directory}/${comparison.episode}`;
    document.getElementById('sourceB').src = `clips/${comparison.papers[1].directory}/${comparison.episode}`;
    document.getElementById('sourceC').src = `clips/${comparison.papers[2].directory}/${comparison.episode}`;
    
    // Reload videos
    document.getElementById('videoA').load();
    document.getElementById('videoB').load();
    document.getElementById('videoC').load();
    
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
        
        // Prevent clicks on progress bar for seeking
        freshVideo.addEventListener('click', function(e) {
            // Allow play/pause but not seek
            if (freshVideo.paused) {
                freshVideo.play();
            } else {
                freshVideo.pause();
            }
            e.preventDefault();
        });
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
    localStorage.setItem('comparison_results', JSON.stringify({
        evaluatorId: evaluatorId,
        timestamp: new Date().toISOString(),
        comparisons: results
    }));
    
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

// Download results
function downloadResults() {
    const data = {
        evaluatorId: evaluatorId,
        completedAt: new Date().toISOString(),
        totalComparisons: results.length,
        results: results
    };
    
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

