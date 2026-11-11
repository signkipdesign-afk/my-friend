# 📞 MyFriend - Web Voice & Video Calling App

A modern, fast, and simple peer-to-peer (P2P) voice and video calling web application built with WebRTC. Users can sign in with their Gmail address, search and add friends, and make crystal-clear audio calls or high-definition video calls directly in the browser with zero backend maintenance!

---

## 🌟 Features

1. **Authentication**:
   - **Gmail Sign In**: Enter your Gmail address (e.g. `signkipdesign@gmail.com`) to instantly sign in with your personal ID.
   - **2 Demo Accounts**:
     - 👤 **Demo 1**: Rahul Kumar (`@rahul` • `rahul.demo@gmail.com`)
     - 👤 **Demo 2**: Anjali Menon (`@anjali` • `anjali.demo@gmail.com`)
   - **Custom Guest Login**: Enter any display name and username.

2. **Friends Management**:
   - 🔍 **Search & Add by Gmail**: Search a friend's Gmail or username to send a Friend Request.
   - 📬 **Incoming Friend Requests**: Real-time notifications with Accept and Decline buttons.
   - 👥 **Friends List**: Shows saved friends with one-tap calling buttons.

3. **Audio & Video Calling**:
   - 📞 **Audio Calling**: High-quality stereo audio with echo cancellation and real-time waveform visualizer.
   - 📹 **Video Calling**: High-definition video with full-screen remote view and floating selfie thumbnail (PiP).
   - 🔄 **Camera Toggle**: Turn camera on/off anytime during an active call.
   - 🎙️ **Microphone Mute/Unmute**: Toggle microphone during audio or video calls.
   - ⏱️ **Live Call Duration Timer**: Tracks exact conversation time.
   - 🛑 **End Call**: Smooth disconnect for both peers.

4. **Serverless Architecture**:
   - Client-side WebRTC + PeerJS cloud signaling.
   - Hosted live on GitHub Pages with HTTPS for full camera and microphone permissions.

---

## 🚀 Live Website

Access the live application at:
👉 **[https://signkipdesign-afk.github.io/my-friend/](https://signkipdesign-afk.github.io/my-friend/)**

---

## 💻 Run Locally

1. On Windows, double-click **`start.bat`**.
   Or run the following PowerShell command in the project directory:
   ```powershell
   powershell -ExecutionPolicy Bypass -File server.ps1
   ```
2. Your default browser will automatically open `http://localhost:3000`.

---

## 🧪 Testing Voice & Video Calls

1. In Tab 1, enter your Gmail: **`signkipdesign@gmail.com`** and click **Sign In**.
2. Open an **Incognito window (Private Tab)** or mobile phone: `https://signkipdesign-afk.github.io/my-friend/`
3. Sign in as **Anjali** (or another demo account).
4. Add each other to the **Friends List** using the search box.
5. In your Friends List, click:
   - **`📞 Audio`** for voice call, or
   - **`📹 Video`** for high-definition video call!
6. Click **Accept** on the other screen, grant camera/microphone permissions, and start video chatting!
