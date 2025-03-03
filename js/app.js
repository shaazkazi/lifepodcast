// Store references to audio components
const wavesurfers = new Map(); // WaveSurfer instances
const visualizers = new Map(); // Custom visualizer elements
const audioAnalyzers = new Map(); // Store audio analyzer nodes

// Global state for the audio player
const state = {
    currentlyPlaying: null,
    currentAudio: null,
    isPlaying: false,
    currentPlaybackRate: 1,
    useWaveSurfer: true, // Toggle between wavesurfer and custom visualization
    audioContexts: new Map(), // Track audio contexts for cleanup
    debug: true // Enable debugging logs
};

// Add a window unload event listener to clean up resources
window.addEventListener('beforeunload', () => {
    console.log("Cleaning up resources before unload");
    
    // Clean up all audio contexts and nodes
    for (const [id, visualizer] of visualizers.entries()) {
        if (visualizer && visualizer.destroy) {
            visualizer.destroy();
        }
    }
   
    // Close all audio contexts
    state.audioContexts.forEach(context => {
        if (context && context.state !== 'closed') {
            context.close();
        }
    });
});

// Setup theme toggle - MUST BE DEFINED BEFORE DOM LOADED EVENT
function setupThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
   
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
   
    // Set initial theme based on preference or system setting
    if (savedTheme === 'dark' || (!savedTheme && prefersDarkScheme.matches)) {
        document.body.classList.add('dark-theme');
        themeToggle.querySelector('i').className = 'fas fa-sun';
    }
   
    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-theme');
        themeToggle.querySelector('i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
       
        // Save theme preference to localStorage
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
       
        // Update wavesurfer colors for all instances
        wavesurfers.forEach(wavesurfer => {
            if (wavesurfer) {
                if (isDark) {
                    wavesurfer.setOptions({
                        waveColor: '#454545',
                        progressColor: '#FF4588'
                    });
                } else {
                    wavesurfer.setOptions({
                        waveColor: '#c2c8d1',
                        progressColor: '#FF4588'
                    });
                }
                wavesurfer.drawBuffer();
            }
        });
    });
}

// DOM loaded event
document.addEventListener('DOMContentLoaded', () => {
    fetchPodcastData();
    setupThemeToggle();
    detectDeviceCapabilities();
    // Add custom visualization styles
    addVisualizationStyles();
   
    if (state.debug) {
        console.log("App initialized with settings:", {
            useWaveSurfer: state.useWaveSurfer,
            userAgent: navigator.userAgent,
            platform: navigator.platform
        });
    }
});

// Detect device capabilities for optimal performance
function detectDeviceCapabilities() {
    // Check if device is low-powered (mobile, older devices)
    const isLowPower = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
   
    // On low-power devices, use custom visualization instead of wavesurfer
    if (isLowPower) {
        state.useWaveSurfer = false;
    }
   
    // Add class to body for device-specific styling
    document.body.classList.toggle('low-power-device', isLowPower);
   
    if (state.debug) {
        console.log("Device capability detection:", {
            isLowPower,
            useWaveSurfer: state.useWaveSurfer,
            supportsWebAudio: typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined'
        });
    }
}

// Fetch podcast data
async function fetchPodcastData() {
    try {
        if (state.debug) console.log("Fetching podcast data...");
       
        const response = await fetch('data.json');
       
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
       
        const data = await response.json();
       
        if (state.debug) console.log("Podcast data loaded:", data);
       
        if (data && data.episodes) {
            renderFeaturedEpisode(data.episodes);
            renderEpisodes(data.episodes);
        } else {
            throw new Error('Invalid data format: missing episodes');
        }
    } catch (error) {
        console.error('Error fetching podcast data:', error);
        document.getElementById('episodes-container').innerHTML = `
            <div class="error-message">
                <p>Failed to load podcast episodes. Please try again later.</p>
                <p class="error-details">${error.message}</p>
            </div>
        `;
    }
}

// Render featured episode
function renderFeaturedEpisode(episodes) {
    const featuredEpisode = episodes.find(episode => episode.featured) || episodes[0];
    const featuredContainer = document.getElementById('featured-episode');
   
    if (state.debug) console.log("Rendering featured episode:", featuredEpisode);
   
    featuredContainer.innerHTML = `
        <img src="${featuredEpisode.image}" alt="${featuredEpisode.title}" class="featured-image">
        <div class="featured-content">
            <h3>${featuredEpisode.title}</h3>
            <p>${featuredEpisode.description}</p>
            <div class="episode-meta">
                <span class="episode-date">${formatDate(featuredEpisode.date)}</span>
                <span class="episode-duration">${featuredEpisode.duration}</span>
            </div>
            <div class="audio-container" data-episode-id="${featuredEpisode.id}">
                ${createAudioPlayer(featuredEpisode)}
            </div>
        </div>
    `;
   
    // Setup audio player
    setupAudioPlayer(featuredContainer.querySelector('.audio-container'), featuredEpisode);
}

// Render all episodes
function renderEpisodes(episodes) {
    const episodesContainer = document.getElementById('episodes-container');
    episodesContainer.innerHTML = '';
   
    if (state.debug) console.log("Rendering episode list:", episodes.length);
   
    episodes.forEach(episode => {
        if (!episode.featured) { // Skip featured episode as it's already displayed
            const episodeCard = document.createElement('div');
            episodeCard.className = 'episode-card';
            episodeCard.innerHTML = `
                <img src="${episode.image}" alt="${episode.title}" class="episode-thumbnail">
                <div class="episode-content">
                    <h3 class="episode-title">${episode.title}</h3>
                    <p class="episode-description">${episode.description}</p>
                    <div class="episode-meta">
                        <span class="episode-date">${formatDate(episode.date)}</span>
                        <span class="episode-duration">${episode.duration}</span>
                    </div>
                    <div class="audio-container" data-episode-id="${episode.id}">
                        ${createAudioPlayer(episode)}
                    </div>
                </div>
            `;
           
            episodesContainer.appendChild(episodeCard);
           
            // Setup audio player
            setupAudioPlayer(episodeCard.querySelector('.audio-container'), episode);
        }
    });
   
    // Setup filter buttons
    setupFilterButtons(episodes);
}

// Create audio player HTML
function createAudioPlayer(episode) {
    const template = document.getElementById('audio-player-template');
    const player = template.content.cloneNode(true);
   
    // Generate unique ID for waveform
    const waveformId = `waveform-${episode.id}`;
    player.querySelector('.waveform-container').id = waveformId;
   
    // Add loading indicator to waveform
    player.querySelector('.waveform-container').innerHTML = `
        <div class="waveform-loading">
            <span></span><span></span><span></span>
        </div>
    `;
   
    // Update download link
    const downloadBtn = player.querySelector('.download-btn');
    downloadBtn.href = episode.audioUrl;
    downloadBtn.setAttribute('aria-label', `Download ${episode.title}`);
   
    return new XMLSerializer().serializeToString(player);
}

// Setup audio player functionality
function setupAudioPlayer(container, episode) {
    if (state.debug) console.log(`Setting up audio player for episode ${episode.id}: ${episode.title}`);
   
    const playBtn = container.querySelector('.play-btn');
    const progressBar = container.querySelector('.progress');
    const currentTimeDisplay = container.querySelector('.current-time');
    const durationDisplay = container.querySelector('.duration');
    const volumeSlider = container.querySelector('.volume-slider');
    const progressContainer = container.querySelector('.progress-bar');
    const waveformContainer = container.querySelector('.waveform-container');
    const speedBtn = container.querySelector('.speed-btn');
   
   // In setupAudioPlayer function
const audio = new Audio();
audio.crossOrigin = "anonymous";  // Set this BEFORE setting src
audio.src = episode.audioUrl;

// Also add preload attribute
audio.preload = "metadata";

    if (state.debug) {
        console.log(`Audio element created for episode ${episode.id}:`, {
            src: audio.src,
            crossOrigin: audio.crossOrigin
        });
    }
   
    // Check if browser supports Web Audio API
    const webAudioSupported = typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined';
   
    // Initialize based on device capabilities
    if (state.useWaveSurfer && webAudioSupported) {
        setupWaveSurfer(waveformContainer, audio, episode);
    } else {
        setupCustomVisualizer(waveformContainer, audio, episode);
    }
   
    // Set initial duration
    audio.addEventListener('loadedmetadata', () => {
        durationDisplay.textContent = formatTime(audio.duration);
        if (state.debug) console.log(`Metadata loaded for episode ${episode.id}:`, {
            duration: audio.duration,
            formattedDuration: formatTime(audio.duration)
        });
    });
   
    // Log errors
    audio.addEventListener('error', (e) => {
        console.error(`Audio error for episode ${episode.id}:`, e.target.error);
        waveformContainer.classList.add('error');
        container.classList.add('load-error');
        container.querySelector('.waveform-loading').innerHTML = `
            <div class="error-message">Error loading audio</div>
        `;
    });
   
    // Debug loading process
    if (state.debug) {
        audio.addEventListener('loadstart', () => console.log(`Episode ${episode.id}: Audio loading started`));
        audio.addEventListener('canplay', () => console.log(`Episode ${episode.id}: Audio can start playing`));
        audio.addEventListener('canplaythrough', () => console.log(`Episode ${episode.id}: Audio can play through`));
    }
   
    // Update progress bar and time display during playback
    audio.addEventListener('timeupdate', () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = `${progress}%`;
        currentTimeDisplay.textContent = formatTime(audio.currentTime);
       
        // Update visualization progress
        const visualizer = visualizers.get(parseInt(episode.id));
        if (visualizer && visualizer.updateProgress) {
            visualizer.updateProgress(progress);
        }
       
        // Update now playing bar if this is the current audio
        if (state.currentlyPlaying === episode.id) {
            updateNowPlayingBar(episode, audio.currentTime, audio.duration);
        }
    });
   
    // Handle play button click
    playBtn.addEventListener('click', () => {
        const episodeId = parseInt(container.dataset.episodeId);
       
        if (state.debug) console.log(`Play button clicked for episode ${episodeId}`);
       
        // If another episode is currently playing, pause it
        if (state.currentlyPlaying && state.currentlyPlaying !== episode.id && state.currentAudio) {
            state.currentAudio.pause();
            const previousContainer = document.querySelector(`.audio-container[data-episode-id="${state.currentlyPlaying}"]`);
            if (previousContainer) {
                const previousPlayBtn = previousContainer.querySelector('.play-btn i');
                previousPlayBtn.className = 'fas fa-play';
                previousContainer.classList.remove('is-playing');
            }
           
            // Pause previous visualization
            const previousWavesurfer = wavesurfers.get(state.currentlyPlaying);
            if (previousWavesurfer) {
                previousWavesurfer.pause();
            }
           
            const previousVisualizer = visualizers.get(state.currentlyPlaying);
            if (previousVisualizer && previousVisualizer.pause) {
                previousVisualizer.pause();
            }
        }
       
        // Toggle play/pause for this episode
        if (state.currentlyPlaying === episode.id && state.isPlaying) {
            // Pause this episode
            audio.pause();
            playBtn.querySelector('i').className = 'fas fa-play';
            container.classList.remove('is-playing');
            state.isPlaying = false;
           
            // Pause visualization
            const wavesurfer = wavesurfers.get(episodeId);
            if (wavesurfer) {
                wavesurfer.pause();
            }
           
            const visualizer = visualizers.get(episodeId);
            if (visualizer && visualizer.pause) {
                visualizer.pause();
            }
           
            // Hide now playing bar with animation
            hideNowPlayingBar();
        } else {
            // Play this episode
            audio.play().then(() => {
                if (state.debug) console.log(`Playing episode ${episodeId}`);
               
                // Resume or start visualization
                const wavesurfer = wavesurfers.get(episodeId);
                if (wavesurfer) {
                    wavesurfer.play();
                }
               
                const visualizer = visualizers.get(episodeId);
                if (visualizer && visualizer.play) {
                    visualizer.play();
                }
               
            }).catch(error => {
                console.error(`Error playing episode ${episodeId}:`, error);
                container.classList.add('play-error');
            });
           
            playBtn.querySelector('i').className = 'fas fa-pause';
            container.classList.add('is-playing');
            state.currentlyPlaying = episode.id;
            state.currentAudio = audio;
            state.isPlaying = true;
           
            // Debug audio settings
            if (state.debug) {
                debugAudioConnection(audio, episode.id);
            }
           
            // Show now playing bar
            showNowPlayingBar(episode);
        }
    });
   
    // Handle volume change
    volumeSlider.addEventListener('input', () => {
        const volume = volumeSlider.value;
        audio.volume = volume;
       
        // Update volume for wavesurfer if exists
        const wavesurfer = wavesurfers.get(parseInt(episode.id));
        if (wavesurfer) {
            wavesurfer.setVolume(volume);
        }
       
        // Update volume icon based on level
        const volumeIcon = container.querySelector('.volume-container i');
        if (volume === '0') {
            volumeIcon.className = 'fas fa-volume-mute';
        } else if (volume < 0.5) {
            volumeIcon.className = 'fas fa-volume-down';
        } else {
            volumeIcon.className = 'fas fa-volume-up';
        }
    });
   
    // Handle progress bar click to seek
    progressContainer.addEventListener('click', (e) => {
        const clickPosition = (e.offsetX / progressContainer.offsetWidth);
        audio.currentTime = clickPosition * audio.duration;
       
        // Update wavesurfer position if exists
        const wavesurfer = wavesurfers.get(parseInt(episode.id));
        if (wavesurfer) {
            wavesurfer.seekTo(clickPosition);
        }
       
        // Update custom visualizer if exists
        const visualizer = visualizers.get(parseInt(episode.id));
        if (visualizer && visualizer.updateProgress) {
            visualizer.updateProgress(clickPosition * 100);
        }
    });
       
    // Handle waveform click for seeking
    waveformContainer.addEventListener('click', (e) => {
        const rect = waveformContainer.getBoundingClientRect();
        const clickPosition = (e.clientX - rect.left) / rect.width;
        audio.currentTime = clickPosition * audio.duration;
       
        if (state.debug) {
            console.log(`Waveform seek: ${clickPosition.toFixed(2)} -> ${formatTime(audio.currentTime)}`);
        }
       
        // If this was the current episode but paused, play it
        if (state.currentlyPlaying === episode.id && !state.isPlaying) {
            audio.play().then(() => {
                // Start visualization
                const wavesurfer = wavesurfers.get(parseInt(episode.id));
                if (wavesurfer) {
                    wavesurfer.play();
                }
               
                const visualizer = visualizers.get(parseInt(episode.id));
                if (visualizer && visualizer.play) {
                    visualizer.play();
                }
            }).catch(error => {
                console.error('Error playing after seek:', error);
            });
           
            playBtn.querySelector('i').className = 'fas fa-pause';
            container.classList.add('is-playing');
            state.isPlaying = true;
        }
    });
       
    // Handle playback speed
    if (speedBtn) {
        speedBtn.addEventListener('click', () => {
            let currentSpeed = parseFloat(speedBtn.textContent.replace('x', ''));
            let newSpeed;
           
            // Cycle through speeds: 1 -> 1.25 -> 1.5 -> 2 -> 0.75 -> 1
            if (currentSpeed === 1) newSpeed = 1.25;
            else if (currentSpeed === 1.25) newSpeed = 1.5;
            else if (currentSpeed === 1.5) newSpeed = 2;
            else if (currentSpeed === 2) newSpeed = 0.75;
            else newSpeed = 1;
           
            if (state.debug) {
                console.log(`Changing playback speed: ${currentSpeed}x -> ${newSpeed}x`);
            }
           
            // Set the new speed
            audio.playbackRate = newSpeed;
            speedBtn.textContent = `${newSpeed}x`;
            state.currentPlaybackRate = newSpeed;
           
            // Update wavesurfer playback rate if exists
            const wavesurfer = wavesurfers.get(parseInt(episode.id));
            if (wavesurfer) {
                wavesurfer.setPlaybackRate(newSpeed);
            }
           
            // Update now playing speed button if this is current episode
            if (state.currentlyPlaying === episode.id) {
                const nowPlayingBar = document.getElementById('now-playing-bar');
                const nowPlayingSpeedBtn = nowPlayingBar.querySelector('.now-playing-speed');
                if (nowPlayingSpeedBtn) {
                    nowPlayingSpeedBtn.textContent = `${newSpeed}x`;
                }
            }
        });
    }
       
    // Handle audio end
    audio.addEventListener('ended', () => {
        if (state.debug) console.log(`Playback ended for episode ${episode.id}`);
       
        playBtn.querySelector('i').className = 'fas fa-play';
        container.classList.remove('is-playing');
        progressBar.style.width = '0%';
        currentTimeDisplay.textContent = '0:00';
        state.isPlaying = false;
       
        // Reset visualization
        const wavesurfer = wavesurfers.get(parseInt(episode.id));
        if (wavesurfer) {
            wavesurfer.seekTo(0);
        }
       
        const visualizer = visualizers.get(parseInt(episode.id));
        if (visualizer && visualizer.reset) {
            visualizer.reset();
        }
       
        // Hide now playing bar
        hideNowPlayingBar();
    });
}

// Setup WaveSurfer
function setupWaveSurfer(waveformContainer, audio, episode) {
    if (state.debug) console.log(`Setting up WaveSurfer for episode ${episode.id}`);
   
    try {
        // Create wavesurfer instance
        const wavesurfer = WaveSurfer.create({
            container: `#${waveformContainer.id}`,
            waveColor: document.body.classList.contains('dark-theme') ? '#454545' : '#c2c8d1',
            progressColor: '#FF4588',
            cursorColor: 'transparent',
            barWidth: 2,
            barRadius: 2,
            barGap: 2,
            height: 60,
            responsive: true,
            hideScrollbar: true,
            backend: 'MediaElement',
            media: audio
        });
       
        // Store wavesurfer instance
        wavesurfers.set(parseInt(episode.id), wavesurfer);
       
        // Remove loading indicator when ready
        wavesurfer.on('ready', function() {
            if (state.debug) console.log(`WaveSurfer ready for episode ${episode.id}`);
            waveformContainer.querySelector('.waveform-loading').style.display = 'none';
        });
       
        wavesurfer.on('error', function(err) {
            console.error(`WaveSurfer error for episode ${episode.id}:`, err);
            waveformContainer.classList.add('error');
            setupCustomVisualizer(waveformContainer, audio, episode);
        });
       
    } catch (error) {
        console.error(`Error creating WaveSurfer for episode ${episode.id}:`, error);
        // Fall back to custom visualizer
        setupCustomVisualizer(waveformContainer, audio, episode);
    }
}

// Setup custom visualizer using Web Audio API
function setupCustomVisualizer(waveformContainer, audio, episode) {
    if (state.debug) console.log(`Setting up custom visualizer for episode ${episode.id}`);
   
    // Remove any existing loading indicator
    const loadingIndicator = waveformContainer.querySelector('.waveform-loading');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
   
    // Create visualization container
    waveformContainer.innerHTML = '<div class="wave-visualization"></div><div class="wave-progress"></div>';
    const visualizationContainer = waveformContainer.querySelector('.wave-visualization');
    const progressElement = waveformContainer.querySelector('.wave-progress');
   
    // Create bars for visualization
    const barCount = 64; // Number of bars in visualization
    for (let i = 0; i < barCount; i++) {
        const bar = document.createElement('div');
        bar.className = 'wave-bar';
        bar.style.height = '10%'; // Initial height before audio analysis
        visualizationContainer.appendChild(bar);
    }
   
    // Set up audio context and analyzer
    let audioContext, analyzer, dataArray, source;
    let animationId = null;
    let useFallbackVisualization = false;
   
    // Initialize audio analyzer
    function initAudioAnalyzer() {
        try {
            if (state.debug) console.log(`Initializing audio analyzer for episode ${episode.id}`);
           
            // Create audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
           
            // Store the audio context for cleanup
            state.audioContexts.set(parseInt(episode.id), audioContext);
           
            // Create analyzer node
            analyzer = audioContext.createAnalyser();
            analyzer.fftSize = 256; // Must be a power of 2
            analyzer.smoothingTimeConstant = 0.8; // Smoother transitions between frames
           
            // Ensure crossOrigin is set before creating media source
           // At the beginning of setupCustomVisualizer function
if (!audio.crossOrigin) {
    console.warn("Setting crossOrigin attribute");
    try {
        // Try to reset the audio element with proper CORS settings
        const currentTime = audio.currentTime;
        const wasPlaying = !audio.paused;
        
        audio.crossOrigin = "anonymous";
        
        // Sometimes we need to reset the source to apply CORS
        const originalSrc = audio.src;
        audio.src = "";
        audio.src = originalSrc;
        
        // Restore state
        audio.currentTime = currentTime;
        if (wasPlaying) audio.play();
    } catch (e) {
        console.error("Failed to apply CORS settings:", e);
    }
}
           
            // Connect audio element to analyzer
            source = audioContext.createMediaElementSource(audio);
            source.connect(analyzer);
            analyzer.connect(audioContext.destination);
           
            // Store analyzer for debugging
            audioAnalyzers.set(parseInt(episode.id), analyzer);
           
            // Create data array for frequency data
            const bufferLength = analyzer.frequencyBinCount; // Half of fftSize
            dataArray = new Uint8Array(bufferLength);
           
            if (state.debug) console.log(`Audio analyzer initialized for episode ${episode.id}`);
            return true;
        } catch (err) {
            console.error(`Could not create audio analyzer for episode ${episode.id}:`, err);
            useFallbackVisualization = true;
            return false;
        }
    }
   
    // Create custom visualizer object
    const customVisualizer = {
        // Update progress display
        updateProgress: (progress) => {
            progressElement.style.width = `${progress}%`;
        },
       
        // Start visualization
        play: () => {
            visualizationContainer.classList.add('playing');
           
            // Initialize audio analyzer if not already done
            if (!audioContext && !useFallbackVisualization) {
                if (!initAudioAnalyzer()) {
                    if (state.debug) console.log(`Falling back to basic visualization for episode ${episode.id}`);
                    useFallbackVisualization = true;
                }
            }
           
            // Resume audio context if suspended (autoplay policy)
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    if (state.debug) console.log(`Audio context resumed for episode ${episode.id}`);
                }).catch(err => {
                    console.error(`Error resuming audio context for episode ${episode.id}:`, err);
                    useFallbackVisualization = true;
                });
            }
           
            // Start the appropriate visualization
            if (useFallbackVisualization) {
                animateBasedOnPlaybackPosition();
            } else {
                visualize();
            }
        },
       
        // Stop visualization
        pause: () => {
            visualizationContainer.classList.remove('playing');
           
            // Cancel animation frame
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        },
       
        // Reset visualization
        reset: () => {
            progressElement.style.width = '0%';
            visualizationContainer.classList.remove('playing');
           
            // Reset all bars to minimal height
            const bars = visualizationContainer.querySelectorAll('.wave-bar');
            bars.forEach(bar => {
                bar.style.height = '10%';
            });
           
            // Cancel animation
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        },
       
        // Show error state
        showError: () => {
            waveformContainer.classList.add('error');
            progressElement.style.backgroundColor = 'rgba(255, 77, 77, 0.2)';
        },
       
        // Update theme colors
        updateTheme: (isDark) => {
            // Theme colors are handled by CSS via dark-theme class
        },
       
        // Clean up resources
        destroy: () => {
            if (state.debug) console.log(`Destroying visualizer for episode ${episode.id}`);
           
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
           
            // Disconnect and close audio context if possible
            if (source && audioContext) {
                try {
                    source.disconnect();
                    analyzer.disconnect();
                } catch (e) {
                    // Ignore disconnection errors
                    if (state.debug) console.log(`Error disconnecting audio nodes for episode ${episode.id}:`, e);
                }
            }
        }
    };
   
    // Real-time visualization function using frequency data
    function visualize() {
        if (!analyzer || !visualizationContainer.classList.contains('playing')) {
            return;
        }
       
        // Get frequency data
        analyzer.getByteFrequencyData(dataArray);
       
        // Check if we're getting all zeros (CORS blocking)
        const allZeros = dataArray.every(value => value === 0);
       
        if (allZeros && audio.currentTime > 0.5) {
            // CORS issue detected - switch to fallback visualization
            console.warn(`CORS restriction detected for episode ${episode.id}, switching to fallback visualization`);
            cancelAnimationFrame(animationId);
            useFallbackVisualization = true;
            animateBasedOnPlaybackPosition();
            return;
        }
       
        // Get the bars
        const bars = visualizationContainer.querySelectorAll('.wave-bar');
        const barCount = bars.length;
       
        // Calculate how many frequency bins to skip to cover full spectrum
        const step = Math.ceil(dataArray.length / barCount);
       
        // Update each bar's height based on frequency data
        for (let i = 0; i < barCount; i++) {
                        // Get frequency value from appropriate segment of the frequency data
                        let dataIndex = i * step;
                        if (dataIndex >= dataArray.length) dataIndex = dataArray.length - 1;
                        
                        // Get frequency value (0-255)
                        const value = dataArray[dataIndex];
                        
                        // Convert to percentage for bar height (min 5%, max 95%)
                        const heightPercentage = 5 + (value / 255) * 90;
                        
                        // Apply height to bar with a slight delay for staggered effect
                        setTimeout(() => {
                            bars[i].style.height = `${heightPercentage}%`;
                        }, i * 3);
                    }
                    
                    // Continue the visualization loop
                    animationId = requestAnimationFrame(visualize);
                }
                
                // Fallback visualization based on audio playback position
                function animateBasedOnPlaybackPosition() {
                    if (!audio || !visualizationContainer.classList.contains('playing')) return;
                    
                    const bars = visualizationContainer.querySelectorAll('.wave-bar');
                    const barCount = bars.length;
                    
                    // Calculate how far we are through the audio (0-1)
                    const progress = audio.currentTime / audio.duration;
                    
                    // Animate bars based on a sine wave pattern influenced by playback position
                    for (let i = 0; i < barCount; i++) {
                        // Create a moving wave effect
                        const phase = (i / barCount) * Math.PI * 20; // Controls wave frequency
                        const amplitude = 0.4 + (Math.sin(progress * Math.PI * 4) * 0.2); // Changes over time
                        
                        // Calculate height using sine wave (values between 0-1)
                        const sineValue = Math.sin(phase + (progress * Math.PI * 10)) * amplitude;
                        
                        // Convert to percentage height (minimum 10%, max 90%)
                        const heightPercentage = 20 + (sineValue + 0.6) * 60;
                        
                        // Apply the height with slight delay for staggered visual
                        setTimeout(() => {
                            bars[i].style.height = `${heightPercentage}%`;
                        }, i * 5);
                    }
                    
                    // Continue the animation loop
                    animationId = requestAnimationFrame(animateBasedOnPlaybackPosition);
                }
                
                // Store visualizer object
                visualizers.set(parseInt(episode.id), customVisualizer);
            }
            
            // Debug audio connection
            function debugAudioConnection(audio, episodeId) {
                console.log(`%c📢 AUDIO DEBUG: Episode ${episodeId}`, 'background:#FF4588;color:white;padding:4px;border-radius:3px;');
                console.log("- Audio element properties:", {
                    crossOrigin: audio.crossOrigin,
                    currentTime: audio.currentTime,
                    paused: audio.paused,
                    muted: audio.muted,
                    volume: audio.volume,
                    playbackRate: audio.playbackRate,
                    src: audio.src,
                    readyState: audio.readyState,
                    networkState: audio.networkState,
                    preload: audio.preload
                });
                
                // Test fetching the header directly
                fetch(audio.src, { method: 'HEAD' })
                    .then(response => {
                        console.log("- Fetch headers test:", response.ok ? "✅ Success" : "❌ Failed");
                        console.log("- Status:", response.status, response.statusText);
                        console.log("- Headers:");
                        response.headers.forEach((value, name) => {
                            console.log(`  ${name}: ${value}`);
                        });
                        
                        // Specifically check for CORS headers
                        const corsHeaders = [
                            'Access-Control-Allow-Origin',
                            'Access-Control-Allow-Methods',
                            'Access-Control-Allow-Headers',
                            'Access-Control-Expose-Headers'
                        ];
                        
                        console.log("- CORS Headers Check:");
                        corsHeaders.forEach(header => {
                            const value = response.headers.get(header);
                            console.log(`  ${header}: ${value || '❌ Not present'}`);
                        });
                    })
                    .catch(err => console.error("- Fetch test failed:", err));
                
                // Check for analyzer data
                const analyzer = audioAnalyzers.get(parseInt(episodeId));
                if (analyzer) {
                    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
                    analyzer.getByteFrequencyData(dataArray);
                    
                    // Check if all values are zero (indicating CORS issue)
                    const allZeros = dataArray.every(value => value === 0);
                    console.log("- Analyzer data:", allZeros ? "❌ All zeros (CORS issue)" : "✅ Contains frequency data");
                    
                    // Log a sample of the data
                    console.log("- Data sample:", Array.from(dataArray).slice(0, 10));
                } else {
                    console.log("- No analyzer found for this episode");
                }
            }
            
            // Show now playing bar
            function showNowPlayingBar(episode) {
                const nowPlayingBar = document.getElementById('now-playing-bar');
                
                nowPlayingBar.innerHTML = `
                    <div class="now-playing-info">
                        <img src="${episode.image}" alt="${episode.title}" class="now-playing-thumbnail">
                        <div>
                            <h4 class="now-playing-title">${episode.title}</h4>
                            <span class="now-playing-progress">0:00 / ${episode.duration}</span>
                        </div>
                    </div>
                    <div class="now-playing-controls">
                        <button class="speed-btn now-playing-speed">${state.currentPlaybackRate}x</button>
                        <button class="play-btn now-playing-pause"><i class="fas fa-pause"></i></button>
                        <a href="${episode.audioUrl}" class="download-btn" download><i class="fas fa-download"></i></a>
                    </div>
                `;
                
                // Add active class for animation
                nowPlayingBar.classList.add('active');
                
                // Setup pause button in now playing bar
                const pauseBtn = nowPlayingBar.querySelector('.now-playing-pause');
                pauseBtn.addEventListener('click', () => {
                    if (state.currentAudio && state.isPlaying) {
                        // Pause playback
                        state.currentAudio.pause();
                        
                        // Update all instances of this episode's play button
                        const containers = document.querySelectorAll(`.audio-container[data-episode-id="${episode.id}"]`);
                        containers.forEach(container => {
                            const playBtn = container.querySelector('.play-btn i');
                            playBtn.className = 'fas fa-play';
                            container.classList.remove('is-playing');
                        });
                        
                        // Pause visualization
                        const wavesurfer = wavesurfers.get(parseInt(episode.id));
                        if (wavesurfer) {
                            wavesurfer.pause();
                        }
                        
                        const visualizer = visualizers.get(parseInt(episode.id));
                        if (visualizer && visualizer.pause) {
                            visualizer.pause();
                        }
                        
                        pauseBtn.querySelector('i').className = 'fas fa-play';
                        state.isPlaying = false;
                    } else if (state.currentAudio) {
                        // Resume playback
                        state.currentAudio.play().then(() => {
                            if (state.debug) {
                                console.log(`Resumed playback from now playing bar for episode ${episode.id}`);
                            }
                            
                            // Resume visualization
                            const wavesurfer = wavesurfers.get(parseInt(episode.id));
                            if (wavesurfer) {
                                wavesurfer.play();
                            }
                            
                            const visualizer = visualizers.get(parseInt(episode.id));
                            if (visualizer && visualizer.play) {
                                visualizer.play();
                            }
                        });
                        
                        // Update all instances of this episode's play button
                        const containers = document.querySelectorAll(`.audio-container[data-episode-id="${episode.id}"]`);
                        containers.forEach(container => {
                            const playBtn = container.querySelector('.play-btn i');
                            playBtn.className = 'fas fa-pause';
                            container.classList.add('is-playing');
                        });
                        
                        pauseBtn.querySelector('i').className = 'fas fa-pause';
                        state.isPlaying = true;
                    }
                });
                
                // Setup speed button in now playing bar
                const speedBtn = nowPlayingBar.querySelector('.now-playing-speed');
                if (speedBtn) {
                    speedBtn.addEventListener('click', () => {
                        let currentSpeed = parseFloat(speedBtn.textContent.replace('x', ''));
                        let newSpeed;
                        
                        // Cycle through speeds: 1 -> 1.25 -> 1.5 -> 2 -> 0.75 -> 1
                        if (currentSpeed === 1) newSpeed = 1.25;
                        else if (currentSpeed === 1.25) newSpeed = 1.5;
                        else if (currentSpeed === 1.5) newSpeed = 2;
                        else if (currentSpeed === 2) newSpeed = 0.75;
                        else newSpeed = 1;
                        
                        if (state.debug) {
                            console.log(`Changing playback speed from now playing bar: ${currentSpeed}x -> ${newSpeed}x`);
                        }
                        
                        // Set the new speed
                        if (state.currentAudio) {
                            state.currentAudio.playbackRate = newSpeed;
                        }
                        
                        // Update wavesurfer playback rate if exists
                        const wavesurfer = wavesurfers.get(parseInt(episode.id));
                        if (wavesurfer) {
                            wavesurfer.setPlaybackRate(newSpeed);
                        }
                        
                        // Update global state
                        state.currentPlaybackRate = newSpeed;
                        
                        // Update UI
                        speedBtn.textContent = `${newSpeed}x`;
                        
                        // Update speed buttons in individual players
                        const containers = document.querySelectorAll(`.audio-container[data-episode-id="${episode.id}"]`);
                        containers.forEach(container => {
                            const episodeSpeedBtn = container.querySelector('.speed-btn');
                            if (episodeSpeedBtn) {
                                episodeSpeedBtn.textContent = `${newSpeed}x`;
                            }
                        });
                    });
                }
            }
            
            // Update now playing bar during playback
            function updateNowPlayingBar(episode, currentTime, duration) {
                const nowPlayingBar = document.getElementById('now-playing-bar');
                const progressDisplay = nowPlayingBar.querySelector('.now-playing-progress');
                
                if (progressDisplay) {
                    progressDisplay.textContent = `${formatTime(currentTime)} / ${episode.duration}`;
                }
            }
            
            // Hide now playing bar
            function hideNowPlayingBar() {
                const nowPlayingBar = document.getElementById('now-playing-bar');
                nowPlayingBar.classList.remove('active');
            }
            
            // Setup filter buttons
            function setupFilterButtons(episodes) {
                const filterBtns = document.querySelectorAll('.filter-btn');
                
                filterBtns.forEach(btn => {
                    btn.addEventListener('click', () => {
                        // Update active class
                        filterBtns.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        
                        // Filter episodes
                        const filter = btn.dataset.filter;
                        let filteredEpisodes = [];
                        
                        switch(filter) {
                            case 'latest':
                                filteredEpisodes = [...episodes].sort((a, b) =>
                                    new Date(b.date) - new Date(a.date)
                                );
                                break;
                            case 'popular':
                                filteredEpisodes = episodes.filter(episode => episode.popular);
                                if (filteredEpisodes.length === 0) {
                                    filteredEpisodes = episodes; // Fallback if no popular episodes
                                }
                                break;
                            default:
                                filteredEpisodes = episodes;
                        }
                        
                        if (state.debug) {
                            console.log(`Filter applied: ${filter}`, {
                                totalEpisodes: episodes.length,
                                filteredCount: filteredEpisodes.length
                            });
                        }
                        
                        // Re-render episodes
                        renderFeaturedEpisode(filteredEpisodes);
                        renderEpisodes(filteredEpisodes);
                    });
                });
            }
            
            // Add visualization styles
            function addVisualizationStyles() {
                const styleElement = document.createElement('style');
                styleElement.textContent = `
                    .waveform-loading {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100%;
                        gap: 8px;
                    }
                    
                    .waveform-loading span {
                        display: inline-block;
                        width: 10px;
                        height: 10px;
                        background-color: var(--primary-color);
                        border-radius: 50%;
                        animation: loading-bounce 1.4s infinite ease-in-out both;
                        opacity: 0.7;
                    }
                    
                    .waveform-loading span:nth-child(1) {
                        animation-delay: -0.32s;
                    }
                    
                    .waveform-loading span:nth-child(2) {
                        animation-delay: -0.16s;
                    }
                    
                    @keyframes loading-bounce {
                        0%, 80%, 100% { transform: scale(0); }
                        40% { transform: scale(1); }
                    }
                    
                    .wave-visualization {
                        display: flex;
                        align-items: flex-end;
                        justify-content: space-between;
                        height: 100%;
                        width: 100%;
                        padding: 0 2px;
                    }
                    
                    .wave-bar {
                        flex: 1;
                        background-color: var(--primary-color);
                        margin: 0 1px;
                        border-radius: 2px;
                        opacity: 0.5;
                        transition: height 0.2s ease;
                    }
                    
                    .dark-theme .wave-bar {
                        opacity: 0.7;
                    }
                    
                    .wave-progress {
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        height: 100%;
                        background-color: rgba(255, 69, 136, 0.3);
                        pointer-events: none;
                        width: 0%;
                    }
                    
                    .playing .wave-bar {
                        animation: pulse-animation 2s infinite;
                    }
                    
                    @keyframes pulse-animation {
                        0% { opacity: 0.5; }
                        50% { opacity: 0.8; }
                        100% { opacity: 0.5; }
                    }
                `;
                document.head.appendChild(styleElement);
            }
            
            // Helper function to format time in MM:SS
            function formatTime(seconds) {
                if (isNaN(seconds)) return '0:00';
                
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = Math.floor(seconds % 60);
                return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
            }
            
            // Helper function to format date
            function formatDate(dateString) {
                const options = { year: 'numeric', month: 'short', day: 'numeric' };
                return new Date(dateString).toLocaleDateString(undefined, options);
            }
            