# 🚀 GaitAware Team Development Setup Guide

**Last Updated:** October 28, 2025  
**Build Link:** https://expo.dev/accounts/caelianzspn/projects/gait-aware/builds/89123963-dca0-4a87-9b91-7e2537a80aa1

---

## 📋 Table of Contents
1. [One-Time Setup](#one-time-setup)
2. [Daily Development Workflow](#daily-development-workflow)
3. [Testing Other Members' Features](#testing-others-features)
4. [Common Issues & Solutions](#common-issues)
5. [Quick Reference](#quick-reference)

---

## 🎯 One-Time Setup

### Prerequisites
- ✅ Android device or Android Emulator
- ✅ Node.js installed (v18 or higher)
- ✅ Git installed
- ✅ GitHub account with access to the repository

---

### Step 1: Clone the Repository

```bash
# Navigate to your workspace
cd ~/Desktop  # or wherever you work

# Clone the repository
git clone https://github.com/tjl0830/gait-aware.git

# Enter the project directory
cd gait-aware
```

---

### Step 2: Switch to Development Branch

```bash
# Fetch all branches
git fetch origin

# Switch to the main development branch
git checkout development

# Pull latest changes
git pull origin development
```

---

### Step 3: Install Dependencies

```bash
# Install all project dependencies
npm install
```

**Wait for it to complete** (may take 2-5 minutes)

---

### Step 4: Install Development Build on Your Device

#### **Option A: Using QR Code (Easiest)**

1. **Open the build link on your computer:**
   ```
   https://expo.dev/accounts/caelianzspn/projects/gait-aware/builds/89123963-dca0-4a87-9b91-7e2537a80aa1
   ```

2. **Click "Install" button** - A QR code will appear

3. **On your Android phone:**
   - Open Camera app
   - Scan the QR code
   - Tap the notification to open in browser
   - Download the `.apk` file

4. **Install the APK:**
   - Open the downloaded file
   - If you see "Unsafe app blocked", tap **"Install anyway"**
   - This is safe - you built this app!

5. **Done!** You should see the GaitAware app icon

#### **Option B: Direct Download**

1. Visit the build link above
2. Click the **Download** button
3. Transfer the `.apk` to your Android device
4. Install it

#### **Option C: Using Android Emulator**

1. Start your Android Emulator
2. Visit the build link
3. Click "Open with Expo Orbit" (if you have it)
   - OR drag and drop the downloaded `.apk` onto the emulator

---

### Step 5: Test Your Setup

```bash
# Start the development server
npx expo start
```

**You should see:**
```
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █▄▄███▄ ████▄█▄  ▀ █
█ █   █ █ ▀█ ▄ ▄ ▄▀▀▄▀█▄▀▀ 
█ █▄▄▄█ █▄ ▄▄▀▀█▄▄ ▄  ▄██ ▄
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄

› Press a │ open Android
```

**On your device:**
1. Open the **GaitAware** app
2. It should connect automatically and show the app!

**If it doesn't connect automatically:**
- Shake your device
- Tap "Scan QR Code"
- Scan the QR code from the terminal

✅ **Setup Complete!** You're ready to develop!

---

## 🔄 Daily Development Workflow

### Every Morning (or when starting work):

```bash
# 1. Make sure you're on development branch
git checkout development

# 2. Pull latest changes from the team
git pull origin development

# 3. Update dependencies (only if package.json changed)
npm install

# 4. Start development server
npx expo start
```

### Working on a Feature:

```bash
# 1. Create a new feature branch
git checkout -b feat/your-feature-name
# Example: git checkout -b feat/add-login-screen

# 2. Start development server
npx expo start

# 3. Open GaitAware app on your device (scan QR if needed)

# 4. Start coding!
# - Edit files in VS Code
# - Save your changes
# - App updates automatically in 2-3 seconds!

# 5. Test your changes on the device

# 6. When done for the day, commit your work:
git add .
git commit -m "feat: describe what you added"
git push origin feat/your-feature-name
```

---

## 👥 Testing Other Members' Features

### Scenario: You want to test teammate's work

```bash
# 1. Stop your current server (Ctrl+C)

# 2. Fetch all remote branches
git fetch origin

# 3. Switch to their branch
git checkout feat/their-feature-name

# 4. Install any new dependencies
npm install

# 5. Start server
npx expo start

# 6. Open app on your device - see their changes!
```

### Scenario: Team Code Review Session

**One person (usually the feature author):**
```bash
git checkout feat/feature-to-review
npx expo start
# Share the QR code
```

**Everyone else:**
- Open GaitAware app
- Scan the QR code
- Test the feature together!
- Provide feedback in real-time

---

## 🐛 Common Issues & Solutions

### Issue 1: "Cannot find module" error

**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

### Issue 2: App won't connect to dev server

**Solution:**
1. Make sure phone and computer are on **same WiFi network**
2. Shake device → Tap "Settings" → Enter the URL manually:
   ```
   exp://YOUR_COMPUTER_IP:8081
   ```
   (Find your IP in the terminal output)

### Issue 3: "Port 8081 already in use"

**Solution:**
```bash
# Kill the process and restart
npx expo start --clear
```

Or use a different port:
```bash
npx expo start --port 8082
```

### Issue 4: Changes not appearing

**Solution:**
1. In terminal, press `r` to reload
2. Or shake device → "Reload"
3. If still not working: `npx expo start --clear`

### Issue 5: Git conflicts when pulling

**Solution:**
```bash
# Stash your changes
git stash

# Pull latest
git pull origin development

# Apply your changes back
git stash pop

# Resolve any conflicts in VS Code
```

---

## 📱 Quick Reference

### Terminal Commands

```bash
# Start development server
npx expo start

# Reload app
Press 'r' in terminal

# Open Android
Press 'a' in terminal

# Clear cache
npx expo start --clear

# Stop server
Ctrl + C
```

### Device Shortcuts

```
Shake device → Open developer menu
  ├─ Reload
  ├─ Debug
  ├─ Settings
  └─ Scan QR Code
```

### Git Workflow

```bash
# Daily start
git checkout development
git pull origin development

# New feature
git checkout -b feat/feature-name

# Save work
git add .
git commit -m "feat: description"
git push origin feat/feature-name

# Test teammate's work
git fetch origin
git checkout feat/their-branch
npm install
npx expo start
```

---

## ⚡ Development Tips

### 1. Fast Reload is Your Friend
- Save file → See changes in 2-3 seconds
- No need to rebuild the app!

### 2. Work in Feature Branches
- Never work directly on `main` or `development`
- Always create: `feat/`, `fix/`, `style/` branches

### 3. Commit Often
- Commit after completing small tasks
- Use meaningful commit messages
- Push at least once per work session

### 4. Test on Real Device
- Emulator is good, but real device is better
- Test different screen sizes if possible

### 5. Communicate with Team
- Push your work before end of day
- Pull latest code before starting work
- Ask for code reviews on significant changes

---

## 🔄 When Do We Need to Rebuild?

### ✅ **NO REBUILD NEEDED** for:
- UI changes
- Logic updates
- New React components
- Bug fixes
- Style changes
- Content updates

**Just save and see instant updates!**

### ❌ **REBUILD REQUIRED** for:
- Adding native modules (very rare)
- Changing `app.json` configuration
- Updating native dependencies

**When this happens:**
- Notify the team
- One person builds: `eas build --platform android --profile development`
- Share new build link
- Everyone reinstalls the app

---

## 📞 Need Help?

**Common Questions:**

**Q: Do I need an Expo account?**  
A: No! Only the person who builds needs one.

**Q: Can multiple people code at the same time?**  
A: Yes! Each person runs their own `npx expo start`.

**Q: What if I mess something up?**  
A: Don't worry! Use git to revert:
```bash
git checkout -- .  # Discard all changes
```

**Q: How do I update to the latest code?**  
A: `git pull origin development` then `npm install`

---

## 🎯 Summary Checklist

**One-Time Setup:**
- [ ] Clone repository
- [ ] Install dependencies (`npm install`)
- [ ] Install dev build on device
- [ ] Test with `npx expo start`

**Daily Development:**
- [ ] `git pull origin development`
- [ ] `npx expo start`
- [ ] Open app on device
- [ ] Code → Save → Test
- [ ] Commit and push

**Before Leaving:**
- [ ] Commit your work
- [ ] Push to your branch
- [ ] Stop server (Ctrl+C)

---

## 🎉 You're All Set!

Now you can develop GaitAware efficiently with the team!

**Remember:** The dev build makes everything fast - no more waiting for rebuilds! 🚀

---

**Questions?** Ask in the team chat or check the troubleshooting section above.
