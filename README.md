# Authenticator-Pro

Authenticator-Pro is a customizable authenticator extension that generates and autofills one-time passwords (OTPs) with various customization options.

## Features

- Add Secrets Easily: Add secrets via image URL, image file, or by scanning QR codes through the webcam with the Advanced Add Button.
- Autofill URL: Set unique URLs for each token to ensure OTP autofill works seamlessly across various websites via the token settings button.
- Clipboard Copying: Enable OTP copying by simply clicking on a token, saving time on manual entry.
- Chrome Sync: Syncs tokens on logged-in Chrome devices.
- Display Saved Secrets as QR Codes: View saved secrets in the form of QR codes for easy reference or scanning.
- Online Time Sync: Synchronize with online time to ensure OTPs are accurately generated.
- Password Protection: Securely lock OTPs and secrets behind a password, allowing access only after correct password input.
- Popup Mode: Opens the extension in a separate popup window, providing quick and convenient access to OTPs.
- Themes: Choose between dark and light modes to match your preference.
- Token Management: View, edit, and delete active OTP tokens within the extension.

<h3>Dark Theme</h3>
<img src="./images/main-dark-theme.png">

<h3>Light Theme</h3>
<img src="./images/main-light-theme.png">

## Work In Progress

- More themes
- Dynamic sizing
- Export Secrets & QR codes

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Nuke1999/Authenticator-Pro.git
   ```

2. Navigate to the project directory:

   ```bash
    cd Authenticator-Pro
   ```

3. Install dependencies:

   ```bash
    npm install
   ```

4. Build the project:

   ```bash
   npm run build
   ```

5. Load the extension in Chrome:
   - Go to 'chrome://extensions'
   - Enable "Developer mode"
   - Click "Loan unpacked" and select the root of the project.

## Usage

- Open the extension popup by clicking on the Authenticator Pro icon in the Chrome toolbar.

- Add a new token by entering a name and a secret, then click "Add Token".

- Customize the autofill URL for each token by clicking the gear icon next to the token.

- Enable or disable autofill and copy to clipboard functionality in the settings menu.

- The extension will automatically update OTPs periodically.

## Acknowledgements

This project uses open-source dependencies that are licensed under the MIT license:

- otplib - OTP (One Time Password) library
- qr-scanner - QR code scanner library
- qrcode - QR code generation library
- feathericons - open-source icons

## Contributing

1. Fork the repository
2. Create a new branch for the feature or bug fix
3. Make changes
4. Commit changes
5. Push to the branch
6. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
