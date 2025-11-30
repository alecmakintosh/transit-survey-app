diff --git a/README.md b/README.md
index 58beeaccd87e230076cab531b8f418f40b6d1aeb..7af54532c99adf6812342c274dfaeb7b0bef7037 100644
--- a/README.md
+++ b/README.md
@@ -1,70 +1,46 @@
-# Getting Started with Create React App
+# Future Toronto Transit Mapper
 
-This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).
+A React-based survey tool for exploring how upcoming Toronto transit expansions could affect daily trips. The app lets participants search for origins and destinations on a map, view suggested routes, and submit feedback on the Eglinton Crosstown LRT and Finch West LRT corridors. Responses are collected anonymously via Supabase, with an optional email for follow-up surveys.
 
-## Available Scripts
+## Getting started
 
-In the project directory, you can run:
+1. Install dependencies:
 
-### `npm start`
+   ```bash
+   npm install
+   ```
 
-Runs the app in the development mode.\
-Open [http://localhost:3000](http://localhost:3000) to view it in your browser.
+2. Configure environment variables for Supabase (create a `.env` file in the project root):
 
-The page will reload when you make changes.\
-You may also see any lint errors in the console.
+   ```env
+   REACT_APP_SUPABASE_URL=<your-supabase-url>
+   REACT_APP_SUPABASE_KEY=<your-supabase-anon-key>
+   ```
 
-### `npm test`
+3. Start the development server:
 
-Launches the test runner in the interactive watch mode.\
-See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.
+   ```bash
+   npm start
+   ```
 
-### `npm run build`
+   The app will be available at [http://localhost:3000](http://localhost:3000).
 
-Builds the app for production to the `build` folder.\
-It correctly bundles React in production mode and optimizes the build for the best performance.
+## Scripts
 
-The build is minified and the filenames include the hashes.\
-Your app is ready to be deployed!
+- `npm start` – run the development server.
+- `npm test` – execute the unit test suite (set `CI=true` to run once).
+- `npm run build` – create a production build in the `build` directory.
 
-See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.
+## Data preprocessing
 
-### `npm run eject`
+The optional `preprocess-gtfs.js` script can be used to optimize GTFS data before loading it into the app. It expects GTFS `routes`, `trips`, and `shapes` text files and writes a compressed JSON output for map rendering.
 
-**Note: this is a one-way operation. Once you `eject`, you can't go back!**
+## Project structure
 
-If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.
+Key source files live in `src/`:
 
-Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.
+- `pages/` – landing, map survey, privacy, and exit survey pages.
+- `supabaseClient.js` – initializes the Supabase client using the environment variables above.
+- `App.js` – router entry point.
 
-You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.
-
-## Learn More
-
-You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).
-
-To learn React, check out the [React documentation](https://reactjs.org/).
-
-### Code Splitting
-
-This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)
-
-### Analyzing the Bundle Size
-
-This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)
-
-### Making a Progressive Web App
-
-This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)
-
-### Advanced Configuration
-
-This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)
-
-### Deployment
-
-This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)
-
-### `npm run build` fails to minify
-
-This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
+Static assets and the app shell live in `public/`.
