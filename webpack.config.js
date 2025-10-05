const webpack = require("webpack");
const path = require("path");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = (env = {}) => {
  const isProd = !!env.production || process.env.NODE_ENV === "production";
  const analyzeBundle = !!env.analyze || process.env.ANALYZE === "true";

  const config = {
    entry: {
      popup: "./src/popup.js",
      content: "./src/content.js",
      background: "./background.js",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      clean: true,
    },
    resolve: {
      alias: {
        "process/browser": require.resolve("process/browser"),
      },
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
  };

  if (isProd) {
    config.mode = "production";
    config.devtool = "source-map";
    config.optimization = {
      minimize: true,
      minimizer: [new TerserPlugin()],
      usedExports: true,
    };
    if (analyzeBundle) {
      config.plugins.push(new BundleAnalyzerPlugin());
    }
  } else {
    config.mode = "development";
    config.devtool = "cheap-module-source-map";
  }

  return config;
};
