const path = require('path');
const webpack = require('webpack');
const AssetsPlugin = require('assets-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const RtlCssPlugin = require('rtlcss-webpack-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const rootPath = path.join(__dirname, '/../');
const myArgs = process.argv.slice(2);
const analyzerMode = myArgs.indexOf('--analyze') !== -1 ? 'static' : 'disabled';

module.exports = production => {
  let stylesName = '[name].css';
  let rtlStylesName = 'rtl-[name].css';
  let jsChunkHashName = '';
  let outputPath = path.join(rootPath, 'dist');

  if (production) {
    outputPath = path.join(rootPath, 'prod/dist');
    stylesName = '[name].[chunkhash].css';
    rtlStylesName = 'rtl-[name].[fullhash].css';
    jsChunkHashName = '.[chunkhash]';
  }

  return {
    context: rootPath,
    devtool: 'eval-source-map',
    mode: 'development',
    entry: {
      main: path.join(rootPath, 'app/react/index.js'),
      nprogress: path.join(rootPath, 'node_modules/nprogress/nprogress.js'),
    },
    output: {
      path: outputPath,
      publicPath: '/',
      filename: `[name]${jsChunkHashName}.js`,
      chunkFilename: `[name]${jsChunkHashName}.bundle.js`,
    },
    resolve: {
      extensions: ['*', '.webpack.js', '.web.js', '.js', '.tsx', '.ts'],
    },
    resolveLoader: {
      modules: ['node_modules', path.join(__dirname, '/webpackLoaders')],
      extensions: ['.js', '.json', '.ts'],
      mainFields: ['loader', 'main'],
    },
    optimization: {
      splitChunks: {
        cacheGroups: {
          commons: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            chunks(chunk) {
              return !chunk.name.match(/LazyLoad/);
            },
          },
        },
      },
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx|ts|tsx)$/,
          include: path.join(rootPath, 'app'),
          exclude: /node_modules/,
          use: [
            {
              loader: 'babel-loader?cacheDirectory',
              options: {
                sourceMap: process.env.BABEL_ENV === 'debug',
              },
            },
          ],
        },
        {
          test: /\.s?[ac]ss$/,
          use: [
            MiniCssExtractPlugin.loader,
            { loader: 'css-loader', options: { url: false, sourceMap: true } },
            { loader: 'sass-loader', options: { sourceMap: true } },
          ],
        },
        {
          test: /world-countries/,
          loader: 'country-loader',
        },
      ],
    },
    plugins: [
      new webpack.ProvidePlugin({
        process: 'process/browser',
      }),
      new NodePolyfillPlugin({ includeAliases: ['path', 'url', 'util', 'Buffer'] }),
      new CleanWebpackPlugin(),
      new MiniCssExtractPlugin({
        filename: stylesName,
      }),
      new RtlCssPlugin({
        filename: rtlStylesName,
      }),
      new AssetsPlugin({
        path: outputPath,
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'node_modules/react-widgets/lib/fonts', to: 'fonts' },
          { from: 'node_modules/flag-icon-css/flags/4x3/', to: 'flags/4x3/' },
          { from: 'node_modules/pdfjs-dist/cmaps/', to: 'legacy_character_maps' },
          { from: 'node_modules/leaflet/dist/images/', to: 'CSS/images' },
          { from: 'node_modules/leaflet/dist/images/', to: 'images' },
        ],
      }),
      new BundleAnalyzerPlugin({ analyzerMode }),
    ],
  };
};
