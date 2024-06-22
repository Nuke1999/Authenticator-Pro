// const webpack = require("webpack");
// const path = require("path");

// module.exports = {
//   entry: {
//     main: ["./popup.js"],
//   },
//   output: {
//     path: path.resolve(__dirname, "dist"),
//     filename: "bundle.js",
//   },
//   mode: "development",
//   devtool: "cheap-module-source-map",
//   resolve: {
//     fallback: {
//       crypto: require.resolve("crypto-browserify"),
//       buffer: require.resolve("buffer/"),
//       stream: require.resolve("stream-browserify"),
//       process: require.resolve("process/browser"),
//       vm: require.resolve("vm-browserify"),
//       https: require.resolve("https-browserify"),
//       http: require.resolve("stream-http"),
//       url: require.resolve("url/"),
//     },
//   },
//   plugins: [
//     new webpack.ProvidePlugin({
//       process: "process/browser",
//     }),
//     new webpack.IgnorePlugin({
//       resourceRegExp:
//         /test_key\.pem|test_rsa_privkey\.pem|test_rsa_pubkey\.pem/,
//       contextRegExp: /public-encrypt\/test/,
//     }),
//   ],
// };

const webpack = require("webpack");
const path = require("path");

module.exports = {
  entry: {
    popup: "./src/popup.js",
    content: "./src/content.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
  },
  mode: "development",
  devtool: "cheap-module-source-map",
  resolve: {
    fallback: {
      crypto: require.resolve("crypto-browserify"),
      buffer: require.resolve("buffer/"),
      stream: require.resolve("stream-browserify"),
      process: require.resolve("process/browser"),
      vm: require.resolve("vm-browserify"),
      https: require.resolve("https-browserify"),
      http: require.resolve("stream-http"),
      url: require.resolve("url/"),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
    new webpack.IgnorePlugin({
      resourceRegExp:
        /test_key\.pem|test_rsa_privkey\.pem|test_rsa_pubkey\.pem/,
      contextRegExp: /public-encrypt\/test/,
    }),
  ],
};
