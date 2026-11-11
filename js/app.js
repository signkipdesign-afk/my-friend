// Main Application Logic: WebRTC Voice & Video Calling, PeerJS, Audio/Video Controls, Friends System & UI State

class CallApp {
    constructor() {
        this.peer = null;
        this.currentCall = null;
        this.currentDataConn = null;
        this.localStream = null;
        
        // Media elements
        this.remoteAudioEl = document.getElementById('remoteAudio');
        this.remoteVideoEl = document.getElementById('remoteVideo');
        this.localVideoEl = document.getElementById('localVideo');
        
        // Call state
        this.callState = 'idle'; // idle | calling | incoming | connected
        this.currentCallType = 'audio'; // 'audio' | 'video'
        this.incomingCallType = 'audio';
        this.callTimerInterval = null;
        this.callSeconds = 0;
        this.isMuted = false;
        this.isCameraOn = false;
        
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
        this.bindFriendEvents();
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
                    const clientId = window.GOOGLE_CLIENT_ID || "";
                    if (!clientId) {
                        return; // Use direct Gmail login if no client ID is set
                    }
                    window.google.accounts.id.initialize({
                        client_id: clientId,
                        callback: (res) => this.onGoogleSignInSuccess(res),
                        auto_select: false
                    });

                    const googleWrapper = document.getElementById('googleButtonWrapper');
                    const googleBtnContainer = document.getElementById('googleSignInBtn');
                    if (googleWrapper && googleBtnContainer) {
                        googleWrapper.style.display = 'flex';
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

        setTimeout(() => clearInterval(checkGsi), 4000);
    }

    onGoogleSignInSuccess(response) {
        const user = authManager.handleGoogleCredentialResponse(response);
        if (user) {
            this.showToast(`Welcome, ${user.name}!`, 'success');
            this.showMainApp(user);
        } else {
            this.showToast("Google sign in failed. Please try again.", 'error');
        }
    }

    bindAuthEvents() {
        // Direct Gmail Login Form
        const handleGmailLogin = (e) => {
            if (e) e.preventDefault();
            const input = document.getElementById('gmailInput');
            if (!input) return;
            const email = input.value.trim();
            if (!email || !email.includes('@')) {
                this.showToast("Please enter a valid Gmail address (e.g. yourname@gmail.com)", 'error');
                return;
            }
            const user = authManager.loginWithGmail(email);
            if (user) {
                this.showToast(`Signed in as ${user.email} 🟢`, 'success');
                this.showMainApp(user);
            } else {
                this.showToast("Could not sign in with this email.", 'error');
            }
        };

        const gmailForm = document.getElementById('gmailLoginForm');
        gmailForm?.addEventListener('submit', handleGmailLogin);
        document.getElementById('gmailSubmitBtn')?.addEventListener('click', handleGmailLogin);

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

    // ==========================================
    // FRIENDS MANAGEMENT & SEARCH
    // ==========================================
    bindFriendEvents() {
        const addFriendForm = document.getElementById('addFriendForm');
        addFriendForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('friendEmailInput');
            if (!input) return;
            const query = input.value.trim().toLowerCase();
            if (!query) return;

            this.sendFriendRequest(query);
            input.value = '';
        });
    }

    sendFriendRequest(targetQuery) {
        const currentUser = authManager.getUser();
        if (!currentUser) return;

        let targetUsername = targetQuery;
        let targetEmail = targetQuery;
        if (targetQuery.includes('@')) {
            targetUsername = targetQuery.split('@')[0].replace(/[^a-z0-9_-]/g, '');
        } else {
            targetUsername = targetQuery.replace(/[^a-z0-9_-]/g, '');
            targetEmail = `${targetUsername}@gmail.com`;
        }

        if (!targetUsername) {
            this.showToast("Please enter a valid Gmail address or username", 'error');
            return;
        }

        if (targetUsername === currentUser.username.toLowerCase()) {
            this.showToast("You cannot add yourself as a friend!", 'warning');
            return;
        }

        const existingFriends = authManager.getFriends();
        if (existingFriends.some(f => f.username.toLowerCase() === targetUsername)) {
            this.showToast(`${targetUsername} is already in your Friends List!`, 'info');
            return;
        }

        const friendObj = {
            username: targetUsername,
            name: targetUsername.charAt(0).toUpperCase() + targetUsername.slice(1),
            email: targetEmail,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${targetUsername}`
        };
        authManager.addFriend(friendObj);
        this.renderFriendsList();

        try {
            const remotePeerId = this.formatPeerId(targetUsername);
            const conn = this.peer.connect(remotePeerId, { reliable: true });
            conn.on('open', () => {
                conn.send({
                    type: 'FRIEND_REQUEST',
                    sender: currentUser
                });
            });
            conn.on('error', (err) => {
                console.log("Friend request connection notice:", err);
            });
        } catch (e) {
            console.log("Notice sending friend request:", e);
        }

        this.showToast(`Friend added: ${targetEmail} 👥`, 'success');
    }

    renderFriendsList() {
        const container = document.getElementById('friendsListContainer');
        const countBadge = document.getElementById('friendsCountBadge');
        if (!container) return;

        const friends = authManager.getFriends();
        if (countBadge) countBadge.textContent = friends.length;

        if (friends.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    No friends added yet.<br>
                    Enter your friend's Gmail address above to add them!
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        friends.forEach(friend => {
            const item = document.createElement('div');
            item.className = 'friend-item';
            item.innerHTML = `
                <div class="friend-left">
                    <img src="${friend.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.username}`}" alt="${friend.name}" class="friend-avatar">
                    <div>
                        <div class="friend-name">${friend.name || friend.username}</div>
                        <div class="friend-meta">${friend.email || `@${friend.username}`}</div>
                    </div>
                </div>
                <div class="friend-right">
                    <button class="btn-call-friend" data-username="${friend.username}" title="Voice Call">
                        📞 Audio
                    </button>
                    <button class="btn-video-friend" data-username="${friend.username}" title="Video Call">
                        📹 Video
                    </button>
                    <button class="btn-remove-friend" data-username="${friend.username}" title="Remove Friend">
                        🗑️
                    </button>
                </div>
            `;

            // Audio call button
            item.querySelector('.btn-call-friend').addEventListener('click', () => {
                this.startOutgoingCall(friend.username, 'audio');
            });

            // Video call button
            item.querySelector('.btn-video-friend').addEventListener('click', () => {
                this.startOutgoingCall(friend.username, 'video');
            });

            // Remove friend button
            item.querySelector('.btn-remove-friend').addEventListener('click', () => {
                authManager.removeFriend(friend.username);
                this.renderFriendsList();
                this.showToast(`Removed @${friend.username} from friends`, 'info');
            });

            container.appendChild(item);
        });
    }

    renderPendingRequests() {
        const section = document.getElementById('pendingRequestsSection');
        const container = document.getElementById('pendingRequestsList');
        const countBadge = document.getElementById('pendingCountBadge');
        if (!section || !container) return;

        const requests = authManager.getPendingRequests();
        if (countBadge) countBadge.textContent = requests.length;

        if (requests.length === 0) {
            section.classList.add('hidden');
            container.innerHTML = '';
            return;
        }

        section.classList.remove('hidden');
        container.innerHTML = '';

        requests.forEach(req => {
            const card = document.createElement('div');
            card.className = 'pending-card';
            card.innerHTML = `
                <div class="pending-info">
                    <img src="${req.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.username}`}" alt="${req.name}" class="pending-avatar">
                    <div>
                        <div style="font-weight: 600; font-size: 0.9rem;">${req.name || req.username}</div>
                        <div style="font-size: 0.75rem; color: #94a3b8;">${req.email || `@${req.username}`}</div>
                    </div>
                </div>
                <div class="pending-actions">
                    <button class="btn-sm btn-success accept-req-btn">Accept</button>
                    <button class="btn-sm btn-danger decline-req-btn">Decline</button>
                </div>
            `;

            card.querySelector('.accept-req-btn').addEventListener('click', () => {
                authManager.addFriend(req);
                authManager.removePendingRequest(req.username);
                this.renderPendingRequests();
                this.renderFriendsList();

                try {
                    const remotePeerId = this.formatPeerId(req.username);
                    const conn = this.peer.connect(remotePeerId, { reliable: true });
                    conn.on('open', () => {
                        conn.send({
                            type: 'FRIEND_REQUEST_ACCEPTED',
                            sender: authManager.getUser()
                        });
                    });
                } catch (e) {}

                this.showToast(`Added ${req.name || req.username} to your Friends List! 🟢`, 'success');
            });

            card.querySelector('.decline-req-btn').addEventListener('click', () => {
                authManager.removePendingRequest(req.username);
                this.renderPendingRequests();
                this.showToast("Friend request declined", 'info');
            });

            container.appendChild(card);
        });
    }

    bindCallEvents() {
        // Direct Audio Call
        document.getElementById('makeCallBtn')?.addEventListener('click', () => {
            const targetUsername = document.getElementById('targetUsernameInput').value.trim().toLowerCase();
            this.startOutgoingCall(targetUsername, 'audio');
        });

        // Direct Video Call
        document.getElementById('makeVideoCallBtn')?.addEventListener('click', () => {
            const targetUsername = document.getElementById('targetUsernameInput').value.trim().toLowerCase();
            this.startOutgoingCall(targetUsername, 'video');
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
            this.declineIncomingCall("Call declined");
        });

        // Hangup Connected Call
        document.getElementById('endCallBtn')?.addEventListener('click', () => {
            this.hangupCall("Call ended");
        });

        // Mute / Unmute Button
        document.getElementById('muteToggleBtn')?.addEventListener('click', () => {
            this.toggleMute();
        });

        // Camera Toggle Button
        document.getElementById('cameraToggleBtn')?.addEventListener('click', () => {
            this.toggleCamera();
        });

        // Copy Username Button
        document.getElementById('copyUsernameBtn')?.addEventListener('click', () => {
            const user = authManager.getUser();
            if (user && user.username) {
                const textToCopy = user.email || user.username;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    this.showToast(`Copied to clipboard: ${textToCopy}`, 'success');
                }).catch(() => {
                    this.showToast(`Your ID is: ${textToCopy}`, 'info');
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

        // Render Friends System
        this.renderFriendsList();
        this.renderPendingRequests();

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
                statusBadge.innerHTML = `<span class="status-dot online"></span> Online & Ready for Calls`;
                this.showToast("Voice & Video network connected 🟢", 'success');
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
                    statusBadge.innerHTML = `<span class="status-dot online"></span> Active in another tab`;
                } else if (err.type === 'peer-unavailable') {
                    this.showToast("Friend is currently offline or username not found.", 'error');
                    this.cancelOutgoingCall("User is currently offline.");
                } else {
                    this.showToast(`Network notice: ${err.type || err.message}`, 'info');
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

            // Friend Request Handshake
            if (data.type === 'FRIEND_REQUEST') {
                authManager.addPendingRequest(data.sender);
                this.renderPendingRequests();
                this.showToast(`New Friend Request from ${data.sender.name || data.sender.email}! 📬`, 'info');
                return;
            }
            else if (data.type === 'FRIEND_REQUEST_ACCEPTED') {
                authManager.addFriend(data.sender);
                this.renderFriendsList();
                this.showToast(`${data.sender.name || data.sender.email} accepted your friend request! 🟢`, 'success');
                return;
            }
            
            // Call Handshake (Audio or Video)
            if (data.type === 'CALL_REQUEST') {
                if (this.callState !== 'idle') {
                    conn.send({ type: 'CALL_BUSY' });
                    return;
                }
                this.activeCaller = data.caller;
                this.incomingCallType = data.callType || 'audio';
                this.currentDataConn = conn;
                this.showIncomingCallScreen(data.caller, this.incomingCallType);
            } 
            else if (data.type === 'CALL_ACCEPTED') {
                this.onOutgoingCallAccepted(data.callType || this.currentCallType);
            } 
            else if (data.type === 'CALL_DECLINED') {
                this.cancelOutgoingCall("Friend declined the call.");
            } 
            else if (data.type === 'CALL_BUSY') {
                this.cancelOutgoingCall("Friend is busy on another call.");
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

    // Step 2: Outgoing Call Flow (Supports 'audio' and 'video')
    startOutgoingCall(targetUsername, callType = 'audio') {
        const currentUser = authManager.getUser();
        if (!currentUser) return;

        let cleanTarget = targetUsername.toLowerCase().trim().replace('@', '');
        if (cleanTarget.includes('@')) {
            cleanTarget = cleanTarget.split('@')[0].replace(/[^a-z0-9_-]/g, '');
        }

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
        this.currentCallType = callType;
        this.activeTarget = cleanTarget;

        // UI Outgoing Screen
        const badge = document.getElementById('outgoingCallTypeBadge');
        if (badge) {
            badge.textContent = callType === 'video' ? '📹 Video Call' : '📞 Audio Call';
            badge.className = `call-type-badge ${callType === 'video' ? 'badge-video' : 'badge-audio'}`;
        }

        document.getElementById('outgoingTargetName').textContent = `@${cleanTarget}`;
        document.getElementById('outgoingTargetAvatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanTarget}`;
        document.getElementById('outgoingStatusText').textContent = callType === 'video' 
            ? "Requesting high-definition video call..." 
            : "Requesting voice call...";
        document.getElementById('outgoingCallModal').classList.remove('hidden');

        // Play Outgoing Ring Sound
        soundEffects.playOutgoingRing();

        // Connect Data Channel to send Call Request
        const remotePeerId = this.formatPeerId(cleanTarget);
        this.currentDataConn = this.peer.connect(remotePeerId, { reliable: true });

        this.currentDataConn.on('open', () => {
            document.getElementById('outgoingStatusText').textContent = "Ringing friend's phone...";
            this.currentDataConn.send({
                type: 'CALL_REQUEST',
                callType: callType,
                caller: currentUser
            });
        });

        this.currentDataConn.on('data', (data) => {
            if (data.type === 'CALL_ACCEPTED') {
                this.onOutgoingCallAccepted(data.callType || this.currentCallType);
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
    showIncomingCallScreen(caller, callType = 'audio') {
        this.callState = 'incoming';
        this.incomingCallType = callType;

        const badge = document.getElementById('incomingCallTypeBadge');
        if (badge) {
            badge.textContent = callType === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Audio Call';
            badge.className = `call-type-badge ${callType === 'video' ? 'badge-video' : 'badge-audio'}`;
        }

        document.getElementById('incomingCallerName').textContent = caller.name || `@${caller.username}`;
        document.getElementById('incomingCallerUsername').textContent = `@${caller.username}`;
        document.getElementById('incomingCallerAvatar').src = caller.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${caller.username}`;
        document.getElementById('incomingCallModal').classList.remove('hidden');

        // Play pleasant incoming ringtone
        soundEffects.playIncomingRing();

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

        const isVideo = this.incomingCallType === 'video';
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false
        };

        try {
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (mediaErr) {
                if (isVideo) {
                    console.warn("Video camera unavailable, falling back to audio only:", mediaErr);
                    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                } else {
                    throw mediaErr;
                }
            }

            // Setup local video element if video track exists
            if (this.localStream.getVideoTracks().length > 0) {
                this.isCameraOn = true;
                if (this.localVideoEl) {
                    this.localVideoEl.srcObject = this.localStream;
                    this.localVideoEl.play().catch(e => console.log("Local video play notice:", e));
                }
            } else {
                this.isCameraOn = false;
            }

            // Signal caller that call is accepted
            if (this.currentDataConn && this.currentDataConn.open) {
                this.currentDataConn.send({
                    type: 'CALL_ACCEPTED',
                    callType: this.incomingCallType
                });
            }

            document.getElementById('incomingCallModal').classList.add('hidden');
            this.setupConnectedCallView(this.activeCaller, this.incomingCallType);

        } catch (err) {
            console.error("Media permission error:", err);
            this.showToast("Microphone/Camera access required. Please grant browser permissions.", 'error');
            this.declineIncomingCall("Could not access media devices.");
        }
    }

    // Incoming Media Call Handler
    handleIncomingMediaCall(mediaCall) {
        console.log("Incoming WebRTC media call from peer...");
        this.currentCall = mediaCall;

        if (this.localStream) {
            mediaCall.answer(this.localStream);
        } else {
            const isVideo = this.incomingCallType === 'video';
            navigator.mediaDevices.getUserMedia({
                audio: true,
                video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false
            }).then(stream => {
                this.localStream = stream;
                if (stream.getVideoTracks().length > 0) {
                    this.isCameraOn = true;
                    if (this.localVideoEl) {
                        this.localVideoEl.srcObject = stream;
                        this.localVideoEl.play().catch(e => {});
                    }
                }
                mediaCall.answer(stream);
            }).catch(err => {
                console.error("Failed to acquire stream to answer:", err);
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
    async onOutgoingCallAccepted(callType = this.currentCallType) {
        if (this.ringTimeout) clearTimeout(this.ringTimeout);
        soundEffects.stopAll();

        const isVideo = callType === 'video';
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false
        };

        try {
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (mediaErr) {
                if (isVideo) {
                    console.warn("Camera unavailable, fallback to audio:", mediaErr);
                    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                } else {
                    throw mediaErr;
                }
            }

            if (this.localStream.getVideoTracks().length > 0) {
                this.isCameraOn = true;
                if (this.localVideoEl) {
                    this.localVideoEl.srcObject = this.localStream;
                    this.localVideoEl.play().catch(e => {});
                }
            } else {
                this.isCameraOn = false;
            }

            const remotePeerId = this.formatPeerId(this.activeTarget);
            console.log("Calling remote media peer:", remotePeerId);
            
            // Initiate WebRTC Call with localStream
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
            this.setupConnectedCallView(targetInfo, callType);

        } catch (err) {
            console.error("Caller media error:", err);
            this.showToast("Microphone/Camera permission denied. Cannot start call.", 'error');
            this.cancelOutgoingCall("Permission denied");
        }
    }

    // Step 6: Handle connected remote audio and video stream
    handleRemoteStream(remoteStream) {
        console.log("Remote media stream connected!");
        soundEffects.playConnectedSound();

        // Attach audio
        if (this.remoteAudioEl) {
            this.remoteAudioEl.srcObject = remoteStream;
            this.remoteAudioEl.play().catch(e => console.log("Audio play allowed on user interaction:", e));
        }

        const hasRemoteVideo = remoteStream.getVideoTracks().length > 0;
        const hasLocalVideo = this.localStream && this.localStream.getVideoTracks().length > 0;

        if (hasRemoteVideo || hasLocalVideo) {
            // Switch to Video Mode UI
            document.getElementById('activeCallCard').classList.add('video-mode');
            document.getElementById('videoStage').classList.remove('hidden');
            document.getElementById('audioStage').classList.add('hidden');

            if (this.remoteVideoEl) {
                this.remoteVideoEl.srcObject = remoteStream;
                this.remoteVideoEl.play().catch(e => console.log("Remote video play notice:", e));
            }
        } else {
            // Audio-only Mode
            document.getElementById('activeCallCard').classList.remove('video-mode');
            document.getElementById('videoStage').classList.add('hidden');
            document.getElementById('audioStage').classList.remove('hidden');

            this.startAudioVisualizer(remoteStream);
        }

        this.updateCameraUI();
    }

    // Step 7: Connected Call Screen & Timer
    setupConnectedCallView(remoteUser, callType = 'audio') {
        this.callState = 'connected';
        this.hideAllCallOverlays();

        const activeModal = document.getElementById('activeCallModal');
        const activeCard = document.getElementById('activeCallCard');
        const videoStage = document.getElementById('videoStage');
        const audioStage = document.getElementById('audioStage');

        activeModal.classList.remove('hidden');

        // Populate names & avatars
        document.getElementById('connectedAvatar').src = remoteUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${remoteUser.username}`;
        document.getElementById('connectedName').textContent = remoteUser.name || `@${remoteUser.username}`;
        document.getElementById('connectedUsername').textContent = `@${remoteUser.username}`;
        document.getElementById('videoConnectedName').textContent = remoteUser.name || `@${remoteUser.username}`;

        if (callType === 'video') {
            activeCard.classList.add('video-mode');
            videoStage.classList.remove('hidden');
            audioStage.classList.add('hidden');
        } else {
            activeCard.classList.remove('video-mode');
            videoStage.classList.add('hidden');
            audioStage.classList.remove('hidden');
        }

        // Reset and start call timer
        this.callSeconds = 0;
        this.updateTimerDisplay();
        if (this.callTimerInterval) clearInterval(this.callTimerInterval);
        this.callTimerInterval = setInterval(() => {
            this.callSeconds++;
            this.updateTimerDisplay();
        }, 1000);

        // Control states
        this.isMuted = false;
        this.updateMuteUI();
        this.updateCameraUI();
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.callSeconds / 60);
        const seconds = this.callSeconds % 60;
        const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        const audioTimer = document.getElementById('callDuration');
        const videoTimer = document.getElementById('videoCallDuration');
        if (audioTimer) audioTimer.textContent = formatted;
        if (videoTimer) videoTimer.textContent = formatted;
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
        if (!muteBtn) return;

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

    // Toggle Camera On/Off during active call
    async toggleCamera() {
        if (!this.localStream) return;

        const videoTracks = this.localStream.getVideoTracks();

        if (videoTracks.length > 0) {
            // Already has video track: toggle enable/disable
            this.isCameraOn = !this.isCameraOn;
            videoTracks[0].enabled = this.isCameraOn;
            this.updateCameraUI();
            this.showToast(this.isCameraOn ? "Camera Turned On 📹" : "Camera Turned Off 🚫", 'info');
        } else {
            // Did not have video track: dynamically request camera stream
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
                });
                const newVideoTrack = newStream.getVideoTracks()[0];
                this.localStream.addTrack(newVideoTrack);

                if (this.localVideoEl) {
                    this.localVideoEl.srcObject = this.localStream;
                    this.localVideoEl.play().catch(e => {});
                }

                // Add to WebRTC peer connection
                if (this.currentCall && this.currentCall.peerConnection) {
                    const senders = this.currentCall.peerConnection.getSenders();
                    const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                    if (videoSender) {
                        videoSender.replaceTrack(newVideoTrack);
                    } else {
                        this.currentCall.peerConnection.addTrack(newVideoTrack, this.localStream);
                    }
                }

                // Switch UI to Video Mode
                document.getElementById('activeCallCard').classList.add('video-mode');
                document.getElementById('videoStage').classList.remove('hidden');
                document.getElementById('audioStage').classList.add('hidden');

                this.isCameraOn = true;
                this.updateCameraUI();
                this.showToast("Camera Turned On 📹", 'success');
            } catch (err) {
                console.error("Camera access error:", err);
                this.showToast("Could not access camera device.", 'error');
            }
        }
    }

    updateCameraUI() {
        const camBtn = document.getElementById('cameraToggleBtn');
        const camIcon = document.getElementById('cameraIcon');
        const camLabel = document.getElementById('cameraLabel');
        if (!camBtn) return;

        if (this.isCameraOn) {
            camBtn.classList.remove('off');
            camIcon.textContent = "📹";
            camLabel.textContent = "Cam On";
        } else {
            camBtn.classList.add('off');
            camIcon.textContent = "🚫";
            camLabel.textContent = "Cam Off";
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

        if (this.remoteVideoEl) {
            this.remoteVideoEl.srcObject = null;
        }

        if (this.localVideoEl) {
            this.localVideoEl.srcObject = null;
        }

        const activeCard = document.getElementById('activeCallCard');
        if (activeCard) {
            activeCard.classList.remove('video-mode');
        }

        const videoStage = document.getElementById('videoStage');
        if (videoStage) {
            videoStage.classList.add('hidden');
        }

        const audioStage = document.getElementById('audioStage');
        if (audioStage) {
            audioStage.classList.remove('hidden');
        }

        this.callState = 'idle';
        this.activeCaller = null;
        this.activeTarget = null;
        this.isMuted = false;
        this.isCameraOn = false;

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
