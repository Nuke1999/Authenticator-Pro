# AuthenticatorPro

AuthenticatorPro is a customizable authenticator extension that allows users to generate and autofill one-time passwords (OTPs) for their favorite websites. This extension offers various customization options such as enabling/disabling autofill, setting specific URLs for autofill, and more.

## Features

- Generate OTPs for added security
- Autofill OTPs on specified websites
- Customize autofill URLs for different tokens
- Enable/disable autofill functionality
- Periodic OTP updates

## Work In Progress

- Future customization options: themes, popup size, font, etc.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Nuke1999/AuthenticatorPro.git
   ```

2. Navigate to the project directory:

   ```bash
    cd AuthenticatorPro
   ```

3. Install dependencies:

   ```bash
    npm install
   ```

4. Build the project:

   '''bash
   npm run build
   '''

5. Load the extension in Chrome:
   -Go to 'chrome://extensions/'
   -Enable "Developer mode"
   -Click "Loan dunpacked" and select the root of the project.

## Usage

-Open the extension popup by clicking on the AuthenticatorPro icon in the Chrome toolbar.
-Add a new token by entering a name and a secret, then click "Add Token".
-Customize the autofill URL for each token by clicking the gear icon next to the token.
-Enable or disable the autofill functionality using the checkbox in the popup.
-The extension will automatically update OTPs periodically.

## Contributing

1. Fork the repository
2. Create a new branch
3. Make changes and commit
4. Push to the branch
5. Create a new PR
