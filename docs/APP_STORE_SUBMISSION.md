# Flip Flap - App Store Submission Materials

This document contains all the text, images, and information needed to submit Flip Flap to the Apple TV App Store.

---

## App Identity

### App Name (max 30 characters)
```
Flip Flap
```

### Subtitle (max 30 characters)
```
Retro Message Board
```

---

## App Store Description (max 4,000 characters)

```
Turn your Apple TV into a beautiful split-flap display.

Flip Flap transforms your television into a classic mechanical split-flap board, like those found in train stations and airports. Display custom messages with satisfying click-clack animations as each character flips into place.

HOW IT WORKS
1. Launch Flip Flap on your Apple TV
2. Scan the QR code with your phone
3. Type your message on the web remote
4. Watch it flip onto the big screen

FEATURES
- Authentic split-flap animation with realistic sound effects
- 21x6 character grid for multi-line messages
- Real-time updates via cloud sync
- Phone-based remote control (no app install needed)
- Automatic text centering and word wrap
- Supports letters, numbers, and common punctuation

PERFECT FOR
- Living rooms and offices
- Retail displays and signage
- Restaurants and cafes
- Event announcements
- Motivational quotes
- Welcome messages

Flip Flap requires no account creation. Simply launch the app and start displaying messages. Your phone connects instantly by scanning the on-screen QR code.

The display stays on continuously, making it ideal for always-on signage. Tap the remote to hide the QR code for a cleaner look.
```

---

## Promotional Text (max 170 characters)

*Can be updated anytime without app review*

```
Display messages in style. Turn your Apple TV into a retro split-flap board with satisfying animations and phone-based remote control.
```

---

## Keywords (max 100 characters, comma-separated)

```
split-flap,message board,display,signage,flipboard,retro,announcement,quotes,text,remote control
```

---

## App Category

**Primary Category:** Utilities
**Secondary Category:** Lifestyle

---

## Age Rating

**Rating:** 4+
**Content:** No objectionable content

---

## Screenshots

### Required Dimensions
| Resolution | Dimensions | Status |
|------------|------------|--------|
| Standard HD | 1920 x 1080 px | Required (at least 1) |
| 4K Ultra HD | 3840 x 2160 px | Optional |

### Format Requirements
- File type: PNG or JPEG
- Color space: RGB
- Resolution: 72 dpi
- No transparency

### Recommended Screenshots (capture via Xcode/QuickTime)

1. **Initial State** - App showing "SCAN THE QR CODE TO CHANGE THIS MESSAGE" with QR code visible
2. **Custom Message** - Display showing a sample message like "HELLO WORLD" or "WELCOME HOME"
3. **Quote Display** - Multi-line inspirational quote centered on screen
4. **Clean Display** - Message displayed with QR code hidden (tap to hide)

### How to Capture Screenshots

1. Connect Apple TV to Mac via USB-C
2. Open QuickTime Player on Mac
3. File → New Movie Recording
4. Click dropdown next to record button, select Apple TV
5. Navigate app to desired screen state
6. File → Export → As 1080p or 4K
7. Take screenshot from the video frame, or use Xcode's Debug → Capture Screenshot

---

## App Preview Video (Optional)

### Specifications
- Duration: 15-30 seconds recommended
- Resolution: 1920x1080 or 3840x2160
- Format: H.264, M4V, MP4, or MOV
- Frame rate: 30 fps
- Audio: Optional (256 kbps AAC)

### Suggested Content
1. App launches showing initial message
2. Phone scans QR code (show phone briefly)
3. User types message on phone
4. Split-flap display animates the new message
5. Final message displayed

---

## Privacy Policy

### Privacy Policy URL
You must host this at a publicly accessible URL. Suggested: `https://flipflap.dgrlabs.co/privacy.html`

### Privacy Policy Text

```
Privacy Policy for Flip Flap

Last updated: [DATE]

Flip Flap ("the App") is committed to protecting your privacy. This policy explains how we handle information when you use our Apple TV application.

INFORMATION WE COLLECT

The App collects minimal information necessary for functionality:

- Anonymous Authentication: We use Firebase Anonymous Authentication to create a temporary, anonymous session. No personal information (name, email, phone) is collected or required.

- Message Content: Messages you send to the display are temporarily stored in Firebase Firestore. Messages are associated only with a random room ID, not with any personal identifier.

- Room IDs: A random alphanumeric room ID is generated each time you launch the app. This ID is not linked to your identity.

INFORMATION WE DO NOT COLLECT

- Personal identification information
- Device identifiers or advertising IDs
- Location data
- Usage analytics or tracking data
- Contact information

DATA STORAGE AND RETENTION

- Messages are stored temporarily in Firebase cloud servers
- Messages may expire and be automatically deleted after 7 days
- No permanent record of messages is maintained
- Data is processed in accordance with Google Firebase's security practices

THIRD-PARTY SERVICES

The App uses Firebase (Google) for:
- Anonymous authentication
- Real-time message synchronization

Firebase's privacy policy: https://firebase.google.com/support/privacy

DATA SHARING

We do not sell, trade, or share your data with third parties for marketing purposes. Message content is only transmitted between your devices for display purposes.

CHILDREN'S PRIVACY

The App does not knowingly collect information from children under 13. The App contains no user accounts, social features, or mechanisms for children to share personal information.

CHANGES TO THIS POLICY

We may update this privacy policy from time to time. Changes will be reflected by updating the "Last updated" date.

CONTACT

If you have questions about this privacy policy, please contact:
[YOUR EMAIL ADDRESS]
```

---

## App Store Connect Checklist

### Before Submission
- [ ] Apple Developer Program membership active ($99/year)
- [ ] App builds and runs on physical Apple TV device
- [ ] Bundle ID registered in Apple Developer portal
- [ ] App icon assets in Xcode (400x240, 1280x768)
- [ ] Top shelf images in Xcode (1920x720, 2320x720)
- [ ] Privacy policy hosted at public URL
- [ ] Screenshots captured (minimum 1 at 1920x1080)

### App Store Connect Setup
- [ ] Create new App in App Store Connect
- [ ] Select tvOS platform
- [ ] Enter Bundle ID: `co.dgrlabs.flipflap`
- [ ] Enter SKU (unique identifier, e.g., `flipflap-tvos-001`)
- [ ] Select "Full Access" for user access

### Version Information
- [ ] Upload screenshots to tvOS section
- [ ] Optional: Upload app preview video
- [ ] Enter promotional text
- [ ] Enter description
- [ ] Enter keywords
- [ ] Enter support URL
- [ ] Enter marketing URL (optional)
- [ ] Enter privacy policy URL

### App Information
- [ ] Enter app name
- [ ] Enter subtitle
- [ ] Select primary category (Utilities)
- [ ] Select secondary category (Lifestyle)
- [ ] Set content rights (original content)
- [ ] Set age rating (complete questionnaire)

### App Privacy
- [ ] Complete App Privacy questionnaire
- [ ] Declare: "Data Not Collected" (if applicable)
- [ ] Or declare: "Data Not Linked to You" for anonymous auth tokens

### Pricing and Availability
- [ ] Set price (Free)
- [ ] Select availability (all territories or specific)
- [ ] Set release option (manual or automatic after approval)

### Build Upload
- [ ] Archive app in Xcode (Product → Archive)
- [ ] Upload to App Store Connect via Xcode Organizer
- [ ] Wait for build processing (5-30 minutes)
- [ ] Select build in App Store Connect

### Final Review
- [ ] Review all information for accuracy
- [ ] Ensure screenshots show app in use (not just splash screen)
- [ ] Verify privacy policy URL is accessible
- [ ] Submit for review

---

## App Privacy Questionnaire Answers

When completing the App Privacy section in App Store Connect:

**Does your app collect data?**
→ Yes (anonymous authentication tokens are technically collected)

**Data Types:**
- Identifiers → Device ID: No
- Identifiers → User ID: Yes (anonymous, not linked to identity)

**For User ID:**
- Used for: App Functionality
- Linked to user: No
- Used for tracking: No

*Alternative: If you want to simplify, you can answer "No" to data collection since anonymous tokens are not personally identifiable and are handled entirely by Firebase.*

---

## Support URL

Required field. Suggested options:
- GitHub repository: `https://github.com/cwooddgr/split-flap`
- Blog/website: `https://flipflap.dgrlabs.co/`
- Or create a simple support page with contact info

---

## What's New in This Version

*For version 1.0, this can be simple:*

```
Initial release of Flip Flap for Apple TV.
```

---

## Review Notes (Optional)

*Notes for the App Store review team:*

```
Flip Flap displays messages on Apple TV using a split-flap animation style.

To test:
1. Launch the app on Apple TV
2. A QR code appears in the bottom-right corner
3. Scan the QR code with any smartphone camera
4. This opens a web page where you can type messages
5. Messages appear on the Apple TV display with flip animation

No account or login is required. The app uses Firebase Anonymous Authentication for secure, private message delivery.

The web control page is hosted at: https://flipflap.dgrlabs.co/control.html
```

---

## Sources

- [Apple Screenshot Specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/)
- [App Store Submitting Guide](https://developer.apple.com/app-store/submitting/)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Creating Your Product Page](https://developer.apple.com/app-store/product-page/)
- [Manage App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
