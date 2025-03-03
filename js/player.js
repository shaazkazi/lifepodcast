// Setup audio player functionality
function setupAudioPlayer(container, episode) {
    const playBtn = container.querySelector('.play-btn');
    const progressFill = container.querySelector('.progress-fill');
    const currentTimeDisplay = container.querySelector('.current-time');
    const durationDisplay = container.querySelector('.duration');
    const volumeSlider = container.querySelector('.volume-slider');
    const progressBar = container.querySelector('.progress-bar');
    const waveformContainer = container.querySelector('.waveform-container');
    const speedBtn = container.querySelector('.speed-btn');
    
    // Create audio element
    const audio = new Audio(episode.audioUrl);
    
    // Setup audio visualization
    let wavesurfer = null;
    let customVisualizer = null;
    
    if (state.useWaveSurfer) {
        // Use WaveSurfer visualization
        setupWaveSurfer();
    } else {
        // Use custom lightweight visualization
        setupCustomVisualizer();
    }
    
    // Set initial duration
    audio.addEventListener('loadedmetadata', () => {
        durationDisplay.textContent = formatTime(audio.duration);
    });
    
    // Update progress during playback
    audio.addEventListener('timeupdate', () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = `${progress}%`;
        currentTimeDisplay.textContent = formatTime(audio.currentTime);
        
        // Update custom visualizer progress if used
        if (customVisualizer) {
            customVisualizer.updateProgress(progress);
        }
        
        // Update now playing bar if this is the current audio
        if (state.currentlyPlaying === parseInt(episode.id)) {
            updatePlayerBar(episode, audio.currentTime, audio.duration);
        }
    });
    
    // Handle play button click
    playBtn.addEventListener('click', () => {
        const episodeId = parseInt(container.dataset.episodeId);
        
        // If another episode is currently playing, pause it
        if (state.currentlyPlaying && state.currentlyPlaying !== episodeId && state.currentAudio) {
            state.currentAudio.pause();
            
            // Update previous episode's UI elements
            const previousContainer = document.querySelector(`.audio-container[data-episode-id="${state.currentlyPlaying}"]`);
            if (previousContainer) {
                const previousPlayBtn = previousContainer.querySelector('.play-btn i');
                previousPlayBtn.className = 'fas fa-play';
                previousContainer.classList.remove('is-playing');
            }
            
            // Also pause any visualization
            const previousWavesurfer = wavesurfers.get(state.currentlyPlaying);
            if (previousWavesurfer) {
                previousWavesurfer.pause();
            }
        }
        
        // Toggle play/pause for this episode
        if (state.currentlyPlaying === episodeId && state.isPlaying) {
                        // Pause this episode
                        audio.pause();
                        playBtn.querySelector('i').className = 'fas fa-play';
                        container.classList.remove('is-playing');
                        state.isPlaying = false;
                        
                        // Pause visualization
                        if (wavesurfer) {
                            wavesurfer.pause();
                        } else if (customVisualizer) {
                            customVisualizer.pause();
                        }
                        
                        // Hide player bar
                        hidePlayerBar();
                    } else {
                        // Play this episode
                        audio.play().catch(err => {
                            console.error('Error playing audio:', err);
                            alert('Could not play audio. Please try again later.');
                        });
                        
                        playBtn.querySelector('i').className = 'fas fa-pause';
                        container.classList.add('is-playing');
                        state.currentlyPlaying = episodeId;
                        state.currentAudio = audio;
                        state.isPlaying = true;
                        
                        // Play visualization
                        if (wavesurfer) {
                            wavesurfer.play();
                        } else if (customVisualizer) {
                            customVisualizer.play();
                        }
                        
                        // Apply current playback rate
                        audio.playbackRate = state.currentPlaybackRate;
                        
                        // Show player bar
                        showPlayerBar(episode);
                    }
                });
                
                // Handle volume change
                if (volumeSlider) {
                    volumeSlider.addEventListener('input', () => {
                        const volume = parseFloat(volumeSlider.value);
                        audio.volume = volume;
                        
                        // Update volume icon based on level
                        const volumeIcon = container.querySelector('.volume-container i');
                        if (volumeIcon) {
                            if (volume === 0) {
                                volumeIcon.className = 'fas fa-volume-mute';
                            } else if (volume < 0.5) {
                                volumeIcon.className = 'fas fa-volume-down';
                            } else {
                                volumeIcon.className = 'fas fa-volume-up';
                            }
                        }
                        
                        // Also update wavesurfer volume if applicable
                        if (wavesurfer) {
                            wavesurfer.setVolume(volume);
                        }
                    });
                    
                    // Handle mute toggle on volume icon click
                    const volumeIcon = container.querySelector('.volume-container i');
                    if (volumeIcon) {
                        volumeIcon.addEventListener('click', () => {
                            if (audio.volume > 0) {
                                // Store the current volume to restore later
                                volumeIcon.dataset.lastVolume = audio.volume;
                                audio.volume = 0;
                                volumeSlider.value = 0;
                                volumeIcon.className = 'fas fa-volume-mute';
                                
                                if (wavesurfer) {
                                    wavesurfer.setVolume(0);
                                }
                            } else {
                                // Restore previous volume
                                const lastVolume = parseFloat(volumeIcon.dataset.lastVolume || 0.75);
                                audio.volume = lastVolume;
                                volumeSlider.value = lastVolume;
                                
                                volumeIcon.className = lastVolume < 0.5 ? 
                                    'fas fa-volume-down' : 'fas fa-volume-up';
                                    
                                if (wavesurfer) {
                                    wavesurfer.setVolume(lastVolume);
                                }
                            }
                        });
                    }
                }
                
                // Handle progress bar click to seek
                progressBar.addEventListener('click', (e) => {
                    const rect = progressBar.getBoundingClientRect();
                    const clickPosition = (e.clientX - rect.left) / rect.width;
                    const seekTime = clickPosition * audio.duration;
                    
                    // Prevent NaN errors
                    if (!isNaN(seekTime)) {
                        audio.currentTime = seekTime;
                        
                        // Update visualizations
                        if (wavesurfer) {
                            wavesurfer.seekTo(clickPosition);
                        } else if (customVisualizer) {
                            customVisualizer.updateProgress(clickPosition * 100);
                        }
                    }
                });
                
                // Handle waveform click for seeking
                waveformContainer.addEventListener('click', (e) => {
                    if (wavesurfer) {
                        // WaveSurfer handles seeking internally
                        return;
                    }
                    
                    // For custom visualizer, implement manual seeking
                    const rect = waveformContainer.getBoundingClientRect();
                    const clickPosition = (e.clientX - rect.left) / rect.width;
                    const seekTime = clickPosition * audio.duration;
                    
                    if (!isNaN(seekTime)) {
                        audio.currentTime = seekTime;
                        customVisualizer.updateProgress(clickPosition * 100);
                        
                        // If paused, play after seeking
                        if (!state.isPlaying && state.currentlyPlaying === parseInt(episode.id)) {
                            audio.play();
                            playBtn.querySelector('i').className = 'fas fa-pause';
                            container.classList.add('is-playing');
                            state.isPlaying = true;
                            customVisualizer.play();
                        }
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
                        
                        // Set the new speed
                        audio.playbackRate = newSpeed;
                        state.currentPlaybackRate = newSpeed;
                        speedBtn.textContent = `${newSpeed}x`;
                        
                        // Update wavesurfer if applicable
                        if (wavesurfer) {
                            wavesurfer.setPlaybackRate(newSpeed);
                        }
                        
                        // Update player bar speed button if showing
                        const playerBarSpeedBtn = document.querySelector('.player-bar-speed');
                        if (playerBarSpeedBtn && state.currentlyPlaying === parseInt(episode.id)) {
                            playerBarSpeedBtn.textContent = `${newSpeed}x`;
                        }
                    });
                }
                
                // Handle audio end
                audio.addEventListener('ended', () => {
                    playBtn.querySelector('i').className = 'fas fa-play';
                    container.classList.remove('is-playing');
                    progressFill.style.width = '0%';
                    currentTimeDisplay.textContent = '0:00';
                    state.isPlaying = false;
                    
                    // Reset visualization
                    if (wavesurfer) {
                        wavesurfer.stop();
                    } else if (customVisualizer) {
                        customVisualizer.reset();
                    }
                    
                    // Hide player bar
                    hidePlayerBar();
                });
                
                // Handle audio errors
                audio.addEventListener('error', (e) => {
                    console.error('Audio error:', e);
                    playBtn.querySelector('i').className = 'fas fa-exclamation-triangle';
                    playBtn.disabled = true;
                    
                    // Add error class to container
                    container.classList.add('audio-error');
                    container.classList.remove('is-playing');
                    
                    // Update visualization to show error
                    if (customVisualizer) {
                        customVisualizer.showError();
                    }
                });
                
                // Function to setup WaveSurfer
                function setupWaveSurfer() {
                    // Remove loading indicator when wavesurfer is created
                    const loadingIndicator = waveformContainer.querySelector('.waveform-loading');
                    
                    wavesurfer = WaveSurfer.create({
                        container: waveformContainer,
                        waveColor: document.body.classList.contains('dark-theme') ? '#454545' : '#c2c8d1',
                        progressColor: '#FF4588',
                        cursorColor: 'transparent',
                        barWidth: 2,
                        barRadius: 2,
                        barGap: 2,
                        height: 64,
                        responsive: true,
                        hideScrollbar: true,
                        backend: 'MediaElement',
                        media: audio
                    });
                    
                    // Store wavesurfer instance
                    wavesurfers.set(parseInt(episode.id), wavesurfer);
                    
                    // Remove loading indicator once waveform is ready
                    wavesurfer.once('ready', () => {
                        if (loadingIndicator) {
                            loadingIndicator.style.display = 'none';
                        }
                    });
                    
                    // Handle errors in waveform loading
                    wavesurfer.once('error', (err) => {
                        console.error('WaveSurfer error:', err);
                        
                        // Fall back to custom visualizer if wavesurfer fails
                        if (loadingIndicator) {
                            loadingIndicator.style.display = 'none';
                        }
                        
                        // Clean up failed wavesurfer
                        wavesurfer.destroy();
                        wavesurfers.delete(parseInt(episode.id));
                        wavesurfer = null;
                        
                        // Create custom visualizer as fallback
                        setupCustomVisualizer();
                    });
                    
                    // Add interaction for hover effect
                    waveformContainer.addEventListener('mouseenter', () => {
                        if (wavesurfer) {
                            waveformContainer.classList.add('interactive');
                        }
                    });
                    
                    waveformContainer.addEventListener('mouseleave', () => {
                        waveformContainer.classList.remove('interactive');
                    });
                }
                
    // Function to setup custom visualizer using Web Audio API
    function setupCustomVisualizer() {
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
    
        // Initialize audio analyzer
        function initAudioAnalyzer() {
            // Create audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
            // Create analyzer node
            analyzer = audioContext.createAnalyser();
            analyzer.fftSize = 256; // Must be a power of 2
            analyzer.smoothingTimeConstant = 0.8; // Smoother transitions between frames
        
            // Connect audio element to analyzer
            source = audioContext.createMediaElementSource(audio);
            source.connect(analyzer);
            analyzer.connect(audioContext.destination);
        
            // Create data array for frequency data
            const bufferLength = analyzer.frequencyBinCount; // Half of fftSize
            dataArray = new Uint8Array(bufferLength);
        }
    
        // Create custom visualizer object
        customVisualizer = {
            // Update progress display
            updateProgress: (progress) => {
                progressElement.style.width = `${progress}%`;
            },
        
            // Start visualization
            play: () => {
                visualizationContainer.classList.add('playing');
            
                // Initialize audio analyzer if not already done
                if (!audioContext) {
                    try {
                        initAudioAnalyzer();
                    } catch (err) {
                        console.error('Could not create audio analyzer:', err);
                        // Fall back to random animation if Web Audio API fails
                        animateRandomBars();
                        return;
                    }
                }
            
                // Resume audio context if suspended (autoplay policy)
                if (audioContext && audioContext.state === 'suspended') {
                    audioContext.resume();
                }
            
                // Start the visualization loop
                visualize();
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
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
            
                // Disconnect and close audio context if possible
                if (source && audioContext) {
                    try {
                        source.disconnect();
                        analyzer.disconnect();
                    } catch (e) {
                        // Ignore disconnection errors
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
    
        // Fallback animation with random values
        function animateRandomBars() {
            if (!visualizationContainer.classList.contains('playing')) return;
        
            const bars = visualizationContainer.querySelectorAll('.wave-bar');
            bars.forEach(bar => {
                // Only animate some bars for a more natural look
                if (Math.random() > 0.7) {
                    const newHeight = Math.floor(Math.random() * 50) + 10;
                    bar.style.height = `${newHeight}%`;
                }
            });
        
            // Continue animation if still playing
            if (state.isPlaying && state.currentlyPlaying === parseInt(episode.id)) {
                animationId = requestAnimationFrame(animateRandomBars);
            }
        }
    
        // Store the custom visualizer reference
        visualizers.set(parseInt(episode.id), customVisualizer);
    }
            // Show player bar with episode info
            function showPlayerBar(episode) {
                const playerBar = document.getElementById('player-bar');
                
                playerBar.innerHTML = `
                    <div class="player-bar-progress">
                        <div class="player-bar-progress-fill"></div>
                    </div>
                    <div class="player-bar-container">
                        <div class="player-bar-info">
                            <img src="${episode.image}" alt="${episode.title}" class="player-bar-thumbnail">
                            <div class="player-bar-details">
                                <div class="player-bar-title">${episode.title}</div>
                                <div class="player-bar-time">
                                    <span class="player-bar-current">0:00</span> / 
                                    <span class="player-bar-duration">${episode.duration}</span>
                                </div>
                            </div>
                        </div>
                        <div class="player-bar-controls">
                            <button class="speed-btn player-bar-speed">${state.currentPlaybackRate}x</button>
                            <button class="player-bar-play"><i class="fas fa-pause"></i></button>
                            <a href="${episode.audioUrl}" class="download-btn" download aria-label="Download episode">
                                <i class="fas fa-download"></i>
                            </a>
                        </div>
                    </div>
                `;
                
                // Make progress bar interactive for seeking
                const progressBar = playerBar.querySelector('.player-bar-progress');
                progressBar.addEventListener('click', (e) => {
                    if (!state.currentAudio) return;
                    
                    const rect = progressBar.getBoundingClientRect();
                    const clickPosition = (e.clientX - rect.left) / rect.width;
                    
                    // Set current time based on click position
                    state.currentAudio.currentTime = clickPosition * state.currentAudio.duration;
                    
                    // Update any active visualizations
                    const episodeId = state.currentlyPlaying;
                    const wavesurfer = wavesurfers.get(episodeId);
                    if (wavesurfer) {
                        wavesurfer.seekTo(clickPosition);
                    }
                    
                    const visualizer = visualizers.get(episodeId);
                    if (visualizer) {
                        visualizer.updateProgress(clickPosition * 100);
                    }
                });
                
                // Setup play/pause button
                const playBtn = playerBar.querySelector('.player-bar-play');
                playBtn.addEventListener('click', () => {
                    if (!state.currentAudio) return;
                    if (state.isPlaying) {
                        // Pause playback
                        state.currentAudio.pause();
                        playBtn.querySelector('i').className = 'fas fa-play';
                        state.isPlaying = false;
                        
                        // Update main player UI
                        const container = document.querySelector(`.audio-container[data-episode-id="${state.currentlyPlaying}"]`);
                        if (container) {
                            container.classList.remove('is-playing');
                            container.querySelector('.play-btn i').className = 'fas fa-play';
                        }
                        
                        // Pause visualization
                        const episodeId = state.currentlyPlaying;
                        const wavesurfer = wavesurfers.get(episodeId);
                        if (wavesurfer) {
                            wavesurfer.pause();
                        }
                        
                        const visualizer = visualizers.get(episodeId);
                        if (visualizer) {
                            visualizer.pause();
                        }
                    } else {
                        // Resume playback
                        state.currentAudio.play();
                        playBtn.querySelector('i').className = 'fas fa-pause';
                        state.isPlaying = true;
                        
                        // Update main player UI
                        const container = document.querySelector(`.audio-container[data-episode-id="${state.currentlyPlaying}"]`);
                        if (container) {
                            container.classList.add('is-playing');
                            container.querySelector('.play-btn i').className = 'fas fa-pause';
                        }
                        
                        // Resume visualization
                        const episodeId = state.currentlyPlaying;
                        const wavesurfer = wavesurfers.get(episodeId);
                        if (wavesurfer) {
                            wavesurfer.play();
                        }
                        
                        const visualizer = visualizers.get(episodeId);
                        if (visualizer) {
                            visualizer.play();
                        }
                    }
                });
                
                // Setup speed button
                const speedBtn = playerBar.querySelector('.player-bar-speed');
                speedBtn.addEventListener('click', () => {
                    let currentSpeed = parseFloat(speedBtn.textContent.replace('x', ''));
                    let newSpeed;
                    
                    // Cycle through speeds: 1 -> 1.25 -> 1.5 -> 2 -> 0.75 -> 1
                    if (currentSpeed === 1) newSpeed = 1.25;
                    else if (currentSpeed === 1.25) newSpeed = 1.5;
                    else if (currentSpeed === 1.5) newSpeed = 2;
                    else if (currentSpeed === 2) newSpeed = 0.75;
                    else newSpeed = 1;
                    
                    // Apply new speed
                    if (state.currentAudio) {
                        state.currentAudio.playbackRate = newSpeed;
                        state.currentPlaybackRate = newSpeed;
                    }
                    
                    // Update UI
                    speedBtn.textContent = `${newSpeed}x`;
                    
                    // Update episode player speed button
                    const episodeContainer = document.querySelector(`.audio-container[data-episode-id="${state.currentlyPlaying}"]`);
                    if (episodeContainer) {
                        const episodeSpeedBtn = episodeContainer.querySelector('.speed-btn');
                        if (episodeSpeedBtn) {
                            episodeSpeedBtn.textContent = `${newSpeed}x`;
                        }
                    }
                    
                    // Update wavesurfer playback rate if applicable
                    const wavesurfer = wavesurfers.get(state.currentlyPlaying);
                    if (wavesurfer) {
                        wavesurfer.setPlaybackRate(newSpeed);
                    }
                });
                
                // Activate player bar with animation
                playerBar.classList.add('active');
            }
            
            // Update player bar during playback
            function updatePlayerBar(episode, currentTime, duration) {
                const playerBar = document.getElementById('player-bar');
                if (!playerBar || !playerBar.classList.contains('active')) return;
                
                const currentTimeDisplay = playerBar.querySelector('.player-bar-current');
                const progressFill = playerBar.querySelector('.player-bar-progress-fill');
                
                if (currentTimeDisplay) {
                    currentTimeDisplay.textContent = formatTime(currentTime);
                }
                
                if (progressFill && !isNaN(duration) && duration > 0) {
                    const progress = (currentTime / duration) * 100;
                    progressFill.style.width = `${progress}%`;
                }
            }
            
            // Hide player bar
            function hidePlayerBar() {
                const playerBar = document.getElementById('player-bar');
                playerBar.classList.remove('active');
            }
            
            // Utility function to generate random values for visualizer
            function getRandomInt(min, max) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            }
}