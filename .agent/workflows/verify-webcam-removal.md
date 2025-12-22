---
description: Verify Removal of Webcam and Valid Profile Photo Functionality
---

1. **Verify Code Integrity**:
   - Check `client/src/components/PatientHeader.jsx` for any remaining references to `startWebcam`, `stopWebcam`, `videoRef`, `webcamStream`.
   - Ensure the new Profile Picture avatar code is present and correct.
   - Ensure the `showPhotoModal` logic is present and triggers the correct file-upload-only modal.

2. **Test Build (Optional but Recommended)**:
   - Run `npm run build` in the client directory to check for any build errors.

3. **Manual Verification Steps**:
   - Navigate to a Patient Chart.
   - Verify that the profile picture is now a subtle User avatar (teal/cyan gradient) instead of initials.
   - Click the profile picture. Verify that the "Add Patient Photo" modal opens.
   - Verify the modal ONLY allows file upload (no "Use Webcam" option).
   - Verify that clicking "Upload a photo" or the icon triggers the file selection dialog.
   - Upload a photo and verify it saves and updates the avatar.
