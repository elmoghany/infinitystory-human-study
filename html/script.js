// Global variables
let episodeData = [];
let currentEpisodeIndex = 0;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadEpisodeData();
});

// Load episode data from JSON manifest
async function loadEpisodeData() {
    try {
        const response = await fetch('./episodes.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        episodeData = await response.json();
        console.log('Loaded episode data:', episodeData);
        
        if (episodeData.length > 0) {
            displayEpisode(0);
        } else {
            throw new Error('No episode data found');
        }
    } catch (error) {
        console.error('Error loading episode data:', error);
        
        // Fallback to CSV loading if JSON manifest doesn't exist
        console.log('Falling back to CSV loading...');
        await loadCSVDataFallback();
    }
}

// Fallback CSV loading function
async function loadCSVDataFallback() {
    try {
        const response = await fetch('../final_data/egtea/metadata/OP01-R01-PastaSalad/OP01-R01-PastaSalad_fixation_merged.csv');
        const csvText = await response.text();
        
        // Parse CSV
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        
        const csvData = [];
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const row = parseCSVLine(lines[i]);
                if (row.length >= headers.length) {
                    const episode = {};
                    headers.forEach((header, index) => {
                        episode[header.trim()] = row[index] ? row[index].trim() : '';
                    });
                    csvData.push(episode);
                }
            }
        }
        
        // Convert CSV data to episode format
        episodeData = csvData.map((row, index) => ({
            id: index + 1,
            start_time: parseFloat(row.episode_start_time),
            end_time: parseFloat(row.episode_end_time),
            duration: parseFloat(row.duration),
            fixation_ids: row.fixation_ids,
            clip_filename: null, // No clips available in fallback mode
            representative_object: parseJSONField(row.representative_object),
            other_objects_in_cropped_area: parseJSONField(row.other_objects_in_cropped_area),
            other_objects_outside_fov: parseJSONField(row.other_objects_outside_fov),
            captions: parseJSONField(row.captions)
        }));
        
        console.log('Loaded CSV data (fallback):', episodeData);
        displayEpisode(0);
    } catch (error) {
        console.error('Error loading CSV data:', error);
        document.querySelector('.container').innerHTML = `
            <div style="text-align: center; padding: 50px;">
                <h2>Error Loading Data</h2>
                <p>Could not load the data files. Please check the file paths.</p>
                <p>Error: ${error.message}</p>
                <div style="margin-top: 20px;">
                    <h3>Troubleshooting:</h3>
                    <ol style="text-align: left; display: inline-block;">
                        <li>Run the extract_clips.py script to generate episodes.json</li>
                        <li>Make sure the CSV file exists at the correct path</li>
                        <li>Check that the web server can access the files</li>
                    </ol>
                </div>
            </div>
        `;
    }
}

// Parse CSV line handling quoted fields
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
        i++;
    }
    
    result.push(current);
    return result;
}

// Display episode data
function displayEpisode(index) {
    if (index < 0 || index >= episodeData.length) return;
    
    currentEpisodeIndex = index;
    const episode = episodeData[index];
    
    // Update navigation
    document.getElementById('episodeInfo').textContent = `Episode ${index + 1} of ${episodeData.length}`;
    document.getElementById('prevBtn').disabled = index === 0;
    document.getElementById('nextBtn').disabled = index === episodeData.length - 1;
    
    // Update video
    updateVideo(episode);
    
    // Update video info
    updateVideoInfo(episode);
    
    // Update objects
    updateObjects(episode);
    
    // Update captions
    updateCaptions(episode);
}

// Update video with time range
function updateVideo(episode) {
    const videoPlayer = document.getElementById('videoPlayer');
    const videoSource = document.getElementById('videoSource');
    
    // Clear any existing event listeners
    const newVideoPlayer = videoPlayer.cloneNode(true);
    videoPlayer.parentNode.replaceChild(newVideoPlayer, videoPlayer);
    const freshVideoPlayer = document.getElementById('videoPlayer');
    const freshVideoSource = document.getElementById('videoSource');
    
    console.log('Loading video for episode:', episode.id, 'clip_filename:', episode.clip_filename);
    
    // Use extracted clip if available
    if (episode.clip_filename) {
        const clipPath = `clips/${episode.clip_filename}`;
        console.log('Loading clip from:', clipPath);
        
        freshVideoSource.src = clipPath;
        freshVideoPlayer.load();
        
        // Add error handler
        freshVideoPlayer.addEventListener('error', function(e) {
            console.error('Video loading error:', e);
            console.error('Failed to load:', clipPath);
            
            // Show error message in video area
            const videoContainer = freshVideoPlayer.parentElement;
            videoContainer.innerHTML = `
                <div style="background: #f8d7da; color: #721c24; padding: 20px; border-radius: 8px; text-align: center;">
                    <h4>Video Loading Error</h4>
                    <p>Could not load video clip: ${episode.clip_filename}</p>
                    <p>Path: ${clipPath}</p>
                    <small>Check browser console for more details</small>
                </div>
            `;
        });
        
        // Success handler
        freshVideoPlayer.addEventListener('loadedmetadata', function() {
            console.log('Video loaded successfully:', clipPath);
            freshVideoPlayer.currentTime = 0;
        }, { once: true });
        
    } else {
        console.log('No clip filename, showing message');
        
        // Show message that clip is not available
        const videoContainer = freshVideoPlayer.parentElement;
        videoContainer.innerHTML = `
            <div style="background: #fff3cd; color: #856404; padding: 20px; border-radius: 8px; text-align: center;">
                <h4>Video Clip Not Available</h4>
                <p>Episode ${episode.id}: ${episode.start_time.toFixed(2)}s - ${episode.end_time.toFixed(2)}s</p>
                <p>Duration: ${episode.duration.toFixed(2)} seconds</p>
                <small>Run extract_clips.py to generate video clips</small>
            </div>
        `;
    }
}

// Update video information
function updateVideoInfo(episode) {
    document.getElementById('duration').textContent = parseFloat(episode.duration).toFixed(2);
    document.getElementById('timeRange').textContent = 
        `${parseFloat(episode.start_time).toFixed(2)}s - ${parseFloat(episode.end_time).toFixed(2)}s`;
    document.getElementById('fixationIds').textContent = episode.fixation_ids;
}

// Update objects display
function updateObjects(episode) {
    // Representative object
    const repObjContainer = document.getElementById('representativeObject');
    const repObj = episode.representative_object;
    repObjContainer.innerHTML = createObjectCard(repObj, 'representative');
    
    // Other objects in cropped area
    const croppedContainer = document.getElementById('otherObjectsCropped');
    const croppedObjects = episode.other_objects_in_cropped_area;
    croppedContainer.innerHTML = '';
    if (Array.isArray(croppedObjects)) {
        croppedObjects.forEach(obj => {
            const div = document.createElement('div');
            div.className = 'object-item';
            div.innerHTML = createObjectCard(obj, 'cropped');
            croppedContainer.appendChild(div);
        });
    }
    
    // Objects outside FOV
    const outsideContainer = document.getElementById('objectsOutsideFov');
    const outsideObjects = episode.other_objects_outside_fov;
    outsideContainer.innerHTML = '';
    if (Array.isArray(outsideObjects)) {
        outsideObjects.forEach(obj => {
            const div = document.createElement('div');
            div.className = 'outside-object-item';
            div.innerHTML = createObjectCard(obj, 'outside');
            outsideContainer.appendChild(div);
        });
    }
}

// Create object card HTML
function createObjectCard(obj, type) {
    if (!obj || typeof obj !== 'object') {
        return '<p>No data available</p>';
    }
    
    const identity = obj.object_identity || 'Unknown';
    const description = obj.detailed_caption || 'No description available';
    
    return `
        <div class="object-name">${identity}</div>
        <div class="object-description">${description}</div>
    `;
}

// Update captions
function updateCaptions(episode) {
    const captionsContainer = document.getElementById('captions');
    const captions = episode.captions;
    
    captionsContainer.innerHTML = '';
    if (Array.isArray(captions)) {
        captions.forEach(caption => {
            const div = document.createElement('div');
            div.className = 'caption-item';
            div.textContent = caption;
            captionsContainer.appendChild(div);
        });
    }
}

// Parse JSON field from CSV
function parseJSONField(field) {
    if (!field) return null;
    
    try {
        // Remove outer quotes if present
        let cleanField = field;
        if (cleanField.startsWith('"') && cleanField.endsWith('"')) {
            cleanField = cleanField.slice(1, -1);
        }
        
        // Replace escaped quotes
        cleanField = cleanField.replace(/""/g, '"');
        
        return JSON.parse(cleanField);
    } catch (error) {
        console.error('Error parsing JSON field:', error, field);
        return null;
    }
}

// Navigation functions
function previousEpisode() {
    if (currentEpisodeIndex > 0) {
        displayEpisode(currentEpisodeIndex - 1);
    }
}

function nextEpisode() {
    if (currentEpisodeIndex < episodeData.length - 1) {
        displayEpisode(currentEpisodeIndex + 1);
    }
}

// Keyboard navigation
document.addEventListener('keydown', function(event) {
    if (event.key === 'ArrowLeft') {
        previousEpisode();
    } else if (event.key === 'ArrowRight') {
        nextEpisode();
    }
});
