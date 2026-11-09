// Main Application Logic: WebRTC Voice Calling, PeerJS, Audio Controls, & UI State

class CallApp {
    constructor() {
        this.peer = null;
        this.currentCall = null;
        this.currentDataConn = null;
        this.localStream = null;
        this.remoteAudioEl = document.getElementById('remoteAudio');
        
        this.callState = 'idle'; // idle | calling | incoming | connected
        this.callTimerInterval = null;
        this.callSeconds = 0;
        this.isMuted = false;
        
        this.activeCaller = null;
        this.activeTarget = null;
        this.ringTimeout = null;

        // Visualizer
        this.audioContext = null;
        this.analyser = null;
        this.animFrameId = null;
    }

    init() {
        authManager.init();

        // Bind events
        this.bindAuthEvents();
        this.bindCallEvents();

        // Check if user already logged in
        if (authManager.isLoggedIn()) {
            this.showMainApp(authManager.getUser());
        } else {
            this.showLoginScreen();
        }

        // Initialize Google Sign In Button
        this.initGoogleSignIn();
    }

    // Google Identity Services (GIS)
    initGoogleSignIn() {
        const checkGsi = setInterval(() => {
            if (window.google && window.google.accounts && window.google.accounts.id) {
                clearInterval(checkGsi);
                try {
                    // Pre-configured default client ID or configurable
                    const clientId = window.GOOGLE_CLIENT_ID || "1028751483863-placeholder.apps.googleusercontent.com";
                    window.google.accounts.id.initialize({
                        client_id: clientId,
                        callback: (res) => this.onGoogleSignInSuccess(res),
                        auto_select: false
                    });

                    const googleBtnContainer = document.getElementById('googleSignInBtn');
                    if (googleBtnContainer) {
                        window.google.accounts.id.renderButton(
                            googleBtnContainer,
                            { theme: "filled_blue", size: "large", shape: "pill", width: 280, text: "signin_with" }
                        );
                    }
                } catch (e) {
                    console.log("Google GIS initialized with standard fallbacks:", e);
                }
            }
        }, 300);

        // Clear after 6 seconds if offline/blocked
        setTimeout(() => clearInterval(checkGsi), 6000);
    }

    onGoogleSignInSuccess(response) {
        const user = authManager.handleGoogleCredentialResponse(response);
        if (user) {
            this.showToast(`Welcome ${user.name}!`, 'success');
            this.showMainApp(user);
        } else {
            this.showToast("Google sign in failed. Please try again.", 'error');
        }
    }

    bindAuthEvents() {
        // Demo User 1 (Rahul)
        document.getElementById('demoRahulBtn')?.addEventListener('click', () => {
            const user = authManager.loginAsDemo('rahul');
            if (user) this.showMainApp(user);
        });

        // Demo User 2 (Anjali)
        document.getElementById('demoAnjaliBtn')?.addEventListener('click', () => {
            const user = authManager.loginAsDemo('anjali');
            if (user) this.showMainApp(user);
        });

        // Gmail Direct Login form
        document.getElementById('gmailLoginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('gmailInput').value.trim();
            if (!email || !email.includes('@')) {
                this.showToast("Please enter a valid Gmail address", 'error');
                return;
            }
            const user = authManager.loginWithGmail(email);
            if (user) {
                this.showToast(`Logged in as ${user.email} 🟢`, 'success');
                this.showMainApp(user);
            }
        });

        // Custom Login form
        document.getElementById('customLoginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('customNameInput').value.trim();
            const username = document.getElementById('customUsernameInput').value.trim();
            if (!username) {
                this.showToast("Please enter a username", 'error');
                return;
            }
            const user = authManager.loginWithCustom(name, username);
            if (user) this.showMainApp(user);
        });

        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.cleanupCall();
            if (this.peer) {
                this.peer.destroy();
                this.peer = null;
            }
            authManager.logout();
            this.showLoginScreen();
            this.showToast("Logged out successfully", 'info');
        });
    }

    bindCallEvents() {
        // Direct Call form
        document.getElementById('callForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const targetUsername = document.getElementById('targetUsernameInput').value.trim().toLowerCase();
            this.startOutgoingCall(targetUsername);
        });

        // Quick Friend Shortcut Call
        document.getElementById('quickCallBtn')?.addEventListener('click', () => {
            const target = document.getElementById('quickCallBtn').dataset.target;
            if (target) {
                this.startOutgoingCall(target);
            }
        });

        // Cancel Outgoing Call
        document.getElementById('cancelOutgoingCallBtn')?.addEventListener('click', () => {
            this.cancelOutgoingCall("Call cancelled");
        });

        // Accept Incoming Call
        document.getElementById('acceptCallBtn')?.addEventListener('click', () => {
            this.acceptIncomingCall();
        });

        // Decline Incoming Call
        document.getElementById('declineCallBtn')?.addEventListener('click', () => {
            this.declineIncomingCall();
        });

        // Hangup Connected Call
        document.getElementById('endCallBtn')?.addEventListener('click', () => {
            this.hangupCall("Call ended");
        });

        // Mute / Unmute Button
        document.getElementById('muteToggleBtn')?.addEventListener('click', () => {
            this.toggleMute();
        });

        // Copy Username Button
        document.getElementById('copyUsernameBtn')?.addEventListener('click', () => {
            const user = authManager.getUser();
            if (user && user.username) {
                navigator.clipboard.writeText(user.username).then(() => {
                    this.showToast(`Username copied: @${user.username}`, 'success');
                }).catch(() => {
                    this.showToast(`Your username is: ${user.username}`, 'info');
                });
            }
        });
    }

    showLoginScreen() {
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('appSection').classList.add('hidden');
        this.hideAllCallOverlays();
    }

    showMainApp(user) {
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('appSection').classList.remove('hidden');

        // Update profile in UI
        document.getElementById('userAvatar').src = user.avatar;
        document.getElementById('userName').textContent = user.name;
        document.getElementById('userUsername').textContent = `@${user.username}`;
        document.getElementById('userEmail').textContent = user.email || '';

        // Configure Quick Call Friend shortcut button
        const quickContainer = document.getElementById('quickCallContainer');
        const quickBtn = document.getElementById('quickCallBtn');
        if (user.targetFriend) {
            quickContainer.classList.remove('hidden');
            quickBtn.dataset.target = user.targetFriend;
            quickBtn.innerHTML = `📞 Call ${user.targetFriendName} (<strong>@${user.targetFriend}</strong>)`;
        } else {
            // Default demo friend recommendation
            const recTarget = user.username === 'rahul' ? 'anjali' : 'rahul';
            quickContainer.classList.remove('hidden');
            quickBtn.dataset.target = recTarget;
            quickBtn.innerHTML = `📞 Quick Call <strong>@${recTarget}</strong>`;
        }

        // Initialize Peer connection with username
        this.initPeer(user.username);
    }

    formatPeerId(username) {
        return `myfriend_v1_${username.toLowerCase()}`;
    }

    initPeer(username) {
        if (this.peer) {
            this.peer.destroy();
        }

        const peerId = this.formatPeerId(username);
        const statusBadge = document.getElementById('networkStatusBadge');
        statusBadge.innerHTML = `<span class="status-dot connecting"></span> Connecting to network...`;

        try {
            this.peer = new Peer(peerId, {
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                console.log('Peer connected with ID:', id);
                statusBadge.innerHTML = `<span class="status-dot online"></span> Online & Ready`;
                this.showToast("Connected to voice network! 🟢", 'success');
            });

            this.peer.on('connection', (conn) => {
                this.handleIncomingDataConnection(conn);
            });

            this.peer.on('call', (mediaCall) => {
                this.handleIncomingMediaCall(mediaCall);
            });

            this.peer.on('error', (err) => {
                console.error("PeerJS error:", err);
                if (err.type === 'unavailable-id') {
                    statusBadge.innerHTML = `<span class="status-dot online"></span> Active in another window`;
                    this.showToast(`Username @${username} is active elsewhere or reconnecting.`, 'warning');
                } else if (err.type === 'peer-unavailable') {
                    this.showToast("User is offline or not found.", 'error');
                    this.cancelOutgoingCall("User is currently offline.");
                } else {
                    this.showToast(`Network notice: ${err.message || err.type}`, 'info');
                }
            });

            this.peer.on('disconnected', () => {
                statusBadge.innerHTML = `<span class="status-dot offline"></span> Disconnected. Reconnecting...`;
                if (this.peer && !this.peer.destroyed) {
                    this.peer.reconnect();
                }
            });

        } catch (e) {
            console.error("Peer init exception:", e);
            statusBadge.innerHTML = `<span class="status-dot offline"></span> Network error`;
        }
    }

    // Step 1: Handle Incoming Signal / Data Connection
    handleIncomingDataConnection(conn) {
        conn.on('data', (data) => {
            console.log("Received peer signal:", data);
            
            if (data.type === 'CALL_REQUEST') {
                if (this.callState !== 'idle') {
                    // Already in a call
                    conn.send({ type: 'CALL_BUSY' });
                    return;
                }
                this.activeCaller = data.caller;
                this.currentDataConn = conn;
                this.showIncomingCallScreen(data.caller);
            } 
            else if (data.type === 'CALL_ACCEPTED') {
                this.onOutgoingCallAccepted();
            } 
            else if (data.type === 'CALL_DECLINED') {
                this.cancelOutgoingCall("Call was declined by user.");
            } 
            else if (data.type === 'CALL_BUSY') {
                this.cancelOutgoingCall("User is currently busy on another call.");
            } 
            else if (data.type === 'CALL_ENDED') {
                this.hangupCall("Friend ended the call.");
            }
        });

        conn.on('close', () => {
            if (this.callState === 'calling' || this.callState === 'connected') {
                this.hangupCall("Call disconnected");
            }
        });
    }

    // Step 2: Outgoing Call Flow
    startOutgoingCall(targetUsername) {
        const currentUser = authManager.getUser();
        if (!currentUser) return;

        const cleanTarget = targetUsername.toLowerCase().trim().replace('@', '');
        if (!cleanTarget) {
            this.showToast("Please enter a valid friend's username", 'error');
            return;
        }

        if (cleanTarget === currentUser.username.toLowerCase()) {
            this.showToast("You cannot call yourself! Open another tab to test.", 'warning');
            return;
        }

        if (this.callState !== 'idle') {
            this.showToast("Already in a call or connecting.", 'warning');
            return;
        }

        this.callState = 'calling';
        this.activeTarget = cleanTarget;

        // UI Outgoing Screen
        document.getElementById('outgoingTargetName').textContent = `@${cleanTarget}`;
        document.getElementById('outgoingTargetAvatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanTarget}`;
        document.getElementById('outgoingStatusText').textContent = "Requesting call...";
        document.getElementById('outgoingCallModal').classList.remove('hidden');

        // Play Outgoing Ring Sound
        soundEffects.playOutgoingRing();

        // Connect Data Channel to send Call Request
        const remotePeerId = this.formatPeerId(cleanTarget);
        this.currentDataConn = this.peer.connect(remotePeerId, { reliable: true });

        this.currentDataConn.on('open', () => {
            document.getElementById('outgoingStatusText').textContent = "Ringing friend's device...";
            this.currentDataConn.send({
                type: 'CALL_REQUEST',
                caller: currentUser
            });
        });

        this.currentDataConn.on('data', (data) => {
            if (data.type === 'CALL_ACCEPTED') {
                this.onOutgoingCallAccepted();
            } else if (data.type === 'CALL_DECLINED') {
                this.cancelOutgoingCall("Friend declined the call.");
            } else if (data.type === 'CALL_BUSY') {
                this.cancelOutgoingCall("Friend is busy on another call.");
            } else if (data.type === 'CALL_ENDED') {
                this.hangupCall("Call ended");
            }
        });

        this.currentDataConn.on('error', (err) => {
            console.error("Data connection error:", err);
            this.cancelOutgoingCall("Friend is offline or unavailable.");
        });

        // 35s Ringing Timeout
        if (this.ringTimeout) clearTimeout(this.ringTimeout);
        this.ringTimeout = setTimeout(() => {
            if (this.callState === 'calling') {
                this.cancelOutgoingCall("No answer from friend.");
            }
        }, 35000);
    }

    cancelOutgoingCall(reason = "Call cancelled") {
        if (this.ringTimeout) clearTimeout(this.ringTimeout);
        soundEffects.stopAll();
        soundEffects.playEndSound();

        if (this.currentDataConn && this.currentDataConn.open) {
            this.currentDataConn.send({ type: 'CALL_CANCELLED' });
            this.currentDataConn.close();
        }

        this.cleanupCall();
        this.showToast(reason, 'info');
    }

    // Step 3: Incoming Call Screen
    showIncomingCallScreen(caller) {
        this.callState = 'incoming';
        document.getElementById('incomingCallerName').textContent = caller.name || `@${caller.username}`;
        document.getElementById('incomingCallerUsername').textContent = `@${caller.username}`;
        document.getElementById('incomingCallerAvatar').src = caller.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${caller.username}`;
        document.getElementById('incomingCallModal').classList.remove('hidden');

        // Play pleasant incoming ringtone
        soundEffects.playIncomingRing();

        // 35s Timeout to auto dismiss if unanswered
        if (this.ringTimeout) clearTimeout(this.ringTimeout);
        this.ringTimeout = setTimeout(() => {
            if (this.callState === 'incoming') {
                this.declineIncomingCall("Call missed.");
            }
        }, 35000);
    }

    declineIncomingCall(message = "Call declined") {
        if (this.ringTimeout) clearTimeout(this.ringTimeout);
        soundEffects.stopAll();
        soundEffects.playEndSound();

        if (this.currentDataConn && this.currentDataConn.open) {
            this.currentDataConn.send({ type: 'CALL_DECLINED' });
            this.currentDataConn.close();
        }

        this.cleanupCall();
        this.showToast(message, 'info');
    }

    // Step 4: Accept Call (Receiver Side)
    async acceptIncomingCall() {
        if (this.ringTimeout) clearTimeout(this.ringTimeout);
        soundEffects.stopAll();

        try {
            // Request Microphone Access
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });

            // Signal caller that call is accepted
            if (this.currentDataConn && this.currentDataConn.open) {
                this.currentDataConn.send({ type: 'CALL_ACCEPTED' });
            }

            document.getElementById('incomingCallModal').classList.add('hidden');
            this.setupConnectedCallView(this.activeCaller);

        } catch (err) {
            console.error("Microphone permission error:", err);
            this.showToast("Microphone access is required to make calls. Please allow microphone permissions.", 'error');
            this.declineIncomingCall("Could not access microphone.");
        }
    }

    // Incoming Media Call Handler (Receiver receives caller's WebRTC audio call)
    handleIncomingMediaCall(mediaCall) {
        console.log("Incoming WebRTC media call from peer...");
        this.currentCall = mediaCall;

        if (this.localStream) {
            mediaCall.answer(this.localStream);
        } else {
            navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                .then(stream => {
                    this.localStream = stream;
                    mediaCall.answer(stream);
                })
                .catch(err => {
                    console.error("Failed to answer media call:", err);
                });
        }

        mediaCall.on('stream', (remoteStream) => {
            this.handleRemoteStream(remoteStream);
        });

        mediaCall.on('close', () => {
            this.hangupCall("Call ended");
        });

        mediaCall.on('error', (err) => {
            console.error("Media call error:", err);
            this.hangupCall("Call encountered an error");
        });
    }

    // Step 5: Caller handles accepted call
    async onOutgoingCallAccepted() {
        if (this.ringTimeout) clearTimeout(this.ringTimeout);
        soundEffects.stopAll();

        try {
            // Request Caller Microphone
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });

            const remotePeerId = this.formatPeerId(this.activeTarget);
            console.log("Calling remote media peer:", remotePeerId);
            
            // Initiate WebRTC Audio Call
            this.currentCall = this.peer.call(remotePeerId, this.localStream);

            this.currentCall.on('stream', (remoteStream) => {
                this.handleRemoteStream(remoteStream);
            });

            this.currentCall.on('close', () => {
                this.hangupCall("Call ended");
            });

            this.currentCall.on('error', (err) => {
                console.error("Outgoing media call error:", err);
                this.hangupCall("Connection failed");
            });

            const targetInfo = {
                name: `@${this.activeTarget}`,
                username: this.activeTarget,
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${this.activeTarget}`
            };
            this.setupConnectedCallView(targetInfo);

        } catch (err) {
            console.error("Caller mic error:", err);
            this.showToast("Microphone permission denied. Cannot start audio call.", 'error');
            this.cancelOutgoingCall("Microphone permission denied");
        }
    }

    // Step 6: Handle connected remote audio
    handleRemoteStream(remoteStream) {
        console.log("Remote audio stream connected!");
        soundEffects.playConnectedSound();

        if (this.remoteAudioEl) {
            this.remoteAudioEl.srcObject = remoteStream;
            this.remoteAudioEl.play().catch(e => console.log("Audio play allowed on user interaction:", e));
        }

        // Setup sound visualizer on the audio stream
        this.startAudioVisualizer(remoteStream);
    }

    // Step 7: Connected Call Screen & Timer
    setupConnectedCallView(remoteUser) {
        this.callState = 'connected';
        this.hideAllCallOverlays();

        document.getElementById('activeCallModal').classList.remove('hidden');
        document.getElementById('connectedAvatar').src = remoteUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${remoteUser.username}`;
        document.getElementById('connectedName').textContent = remoteUser.name || `@${remoteUser.username}`;
        document.getElementById('connectedUsername').textContent = `@${remoteUser.username}`;

        // Reset and start call timer
        this.callSeconds = 0;
        this.updateTimerDisplay();
        if (this.callTimerInterval) clearInterval(this.callTimerInterval);
        this.callTimerInterval = setInterval(() => {
            this.callSeconds++;
            this.updateTimerDisplay();
        }, 1000);

        // Mute state reset
        this.isMuted = false;
        this.updateMuteUI();
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.callSeconds / 60);
        const seconds = this.callSeconds % 60;
        const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.getElementById('callDuration').textContent = formatted;
    }

    toggleMute() {
        if (!this.localStream) return;
        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            this.isMuted = !this.isMuted;
            audioTracks[0].enabled = !this.isMuted;
            this.updateMuteUI();
            this.showToast(this.isMuted ? "Microphone Muted 🔇" : "Microphone Active 🎙️", 'info');
        }
    }

    updateMuteUI() {
        const muteBtn = document.getElementById('muteToggleBtn');
        const muteIcon = document.getElementById('muteIcon');
        const muteLabel = document.getElementById('muteLabel');
        if (this.isMuted) {
            muteBtn.classList.add('muted');
            muteIcon.textContent = "🔇";
            muteLabel.textContent = "Unmute";
        } else {
            muteBtn.classList.remove('muted');
            muteIcon.textContent = "🎙️";
            muteLabel.textContent = "Mute";
        }
    }

    // Audio Visualizer
    startAudioVisualizer(stream) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            const source = this.audioContext.createMediaStreamSource(stream || this.localStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 64;
            source.connect(this.analyser);

            const canvas = document.getElementById('visualizerCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const draw = () => {
                this.animFrameId = requestAnimationFrame(draw);
                this.analyser.getByteFrequencyData(dataArray);

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const barWidth = (canvas.width / bufferLength) * 2;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height * 0.85;
                    const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
                    gradient.addColorStop(0, '#3b82f6');
                    gradient.addColorStop(1, '#10b981');

                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.roundRect(x, (canvas.height - barHeight) / 2, barWidth - 3, Math.max(barHeight, 4), 3);
                    ctx.fill();

                    x += barWidth;
                }
            };
            draw();
        } catch (e) {
            console.log("Audio visualizer initialization:", e);
        }
    }

    stopAudioVisualizer() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.audioContext) {
            try { this.audioContext.close(); } catch (e) {}
            this.audioContext = null;
        }
    }

    // Step 8: Hangup Call
    hangupCall(toastReason = "Call ended") {
        if (this.currentDataConn && this.currentDataConn.open) {
            this.currentDataConn.send({ type: 'CALL_ENDED' });
        }

        soundEffects.stopAll();
        soundEffects.playEndSound();

        const duration = document.getElementById('callDuration').textContent;
        this.cleanupCall();

        if (duration && duration !== "00:00") {
            this.showToast(`${toastReason} (Duration: ${duration})`, 'info');
        } else {
            this.showToast(toastReason, 'info');
        }
    }

    cleanupCall() {
        if (this.callTimerInterval) {
            clearInterval(this.callTimerInterval);
            this.callTimerInterval = null;
        }
        if (this.ringTimeout) {
            clearTimeout(this.ringTimeout);
            this.ringTimeout = null;
        }

        this.stopAudioVisualizer();

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.currentCall) {
            this.currentCall.close();
            this.currentCall = null;
        }

        if (this.currentDataConn) {
            this.currentDataConn.close();
            this.currentDataConn = null;
        }

        if (this.remoteAudioEl) {
            this.remoteAudioEl.srcObject = null;
        }

        this.callState = 'idle';
        this.activeCaller = null;
        this.activeTarget = null;
        this.isMuted = false;

        this.hideAllCallOverlays();
    }

    hideAllCallOverlays() {
        document.getElementById('outgoingCallModal')?.classList.add('hidden');
        document.getElementById('incomingCallModal')?.classList.add('hidden');
        document.getElementById('activeCallModal')?.classList.add('hidden');
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = `toast show ${type}`;

        setTimeout(() => {
            toast.className = 'toast';
        }, 3800);
    }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CallApp();
    window.app.init();
});
