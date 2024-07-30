// Development Webpack:

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

//Production webpack:

// const webpack = require("webpack");
// const path = require("path");
// const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
// const TerserPlugin = require("terser-webpack-plugin");

// module.exports = {
//   entry: {
//     popup: "./src/popup.js",
//     content: "./src/content.js",
//     options: "./src/options.js",
//     background: "./background.js",
//   },
//   output: {
//     path: path.resolve(__dirname, "dist"),
//     filename: "[name].js",
//     clean: true,
//   },
//   mode: "production",
//   devtool: "source-map",
//   module: {
//     rules: [
//       {
//         test: /\.js$/,
//         exclude: /node_modules/,
//         use: {
//           loader: "babel-loader",
//           options: {
//             presets: ["@babel/preset-env"],
//           },
//         },
//       },
//       {
//         test: /\.css$/,
//         use: [
//           "style-loader",
//           "css-loader",
//           {
//             loader: "postcss-loader",
//             options: {
//               postcssOptions: {
//                 config: path.resolve(__dirname, "postcss.config.js"),
//               },
//             },
//           },
//         ],
//       },
//     ],
//   },
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
//   optimization: {
//     minimize: true,
//     minimizer: [new TerserPlugin()],
//     usedExports: true,
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
//     new BundleAnalyzerPlugin(),
//   ],
// };
