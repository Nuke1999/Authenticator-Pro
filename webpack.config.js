const webpack = require("webpack");
const path = require("path");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const TerserPlugin = require("terser-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = (env = {}, argv = {}) => {
  const isProd = Boolean(env.production) || argv.mode === "production";
  const shouldAnalyze = Boolean(env.analyze);

  return {
    entry: {
      popup: ["./src/setPublicPath.js", "./src/popup.js"],
      content: ["./src/setPublicPath.js", "./src/content.js"],
      background: ["./src/setPublicPath.js", "./background.js"],
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      clean: true,
    },
    mode: isProd ? "production" : "development",
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"],
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            "style-loader",
            "css-loader",
            {
              loader: "postcss-loader",
              options: {
                postcssOptions: {
                  config: path.resolve(__dirname, "postcss.config.js"),
                },
              },
            },
          ],
        },
      ],
    },
    resolve: {
      alias: {
        process: "process/browser.js",
      },
      fallback: {
        crypto: require.resolve("crypto-browserify"),
        buffer: require.resolve("buffer/"),
        stream: require.resolve("stream-browserify"),
        process: require.resolve("process/browser.js"),
        vm: require.resolve("vm-browserify"),
        https: require.resolve("https-browserify"),
        http: require.resolve("stream-http"),
        url: require.resolve("url/"),
      },
    },
    optimization: {
      minimize: isProd,
      minimizer: isProd ? [new TerserPlugin()] : [],
      usedExports: true,
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { from: "manifest.json", to: "manifest.json" },
          { from: "authenticator.html", to: "authenticator.html" },
          { from: "styles.css", to: "styles.css", noErrorOnMissing: true },
          { from: "icons", to: "icons", noErrorOnMissing: true },
          { from: "_locales", to: "_locales", noErrorOnMissing: true }
        ],
      }),
      new webpack.ProvidePlugin({
        process: "process/browser.js",
      }),
      new webpack.IgnorePlugin({
        resourceRegExp:
          /test_key\.pem|test_rsa_privkey\.pem|test_rsa_pubkey\.pem/,
        contextRegExp: /public-encrypt\/test/,
      }),
      ...(shouldAnalyze ? [new BundleAnalyzerPlugin()] : []),
    ],
  };
};
